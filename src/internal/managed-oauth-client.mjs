const MAX_RESPONSE_BYTES = 64 * 1024
const DEFAULT_REQUEST_TIMEOUT_MS = 30 * 1000
const MAX_TIMER_DELAY_MS = 2_147_483_647

export class ManagedOAuthClientError extends Error {
  constructor() {
    super("The managed Grok OAuth request failed")
    this.name = "ManagedOAuthClientError"
  }
}

export function createManagedOAuthClient({
  contract,
  fetch,
  now,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}) {
  validateContract(contract)
  if (typeof fetch !== "function" || typeof now !== "function" || !isTimeout(requestTimeoutMs)) {
    throw new TypeError("Invalid managed OAuth client dependencies")
  }

  const request = async ({ endpoint, form, signal }) => {
    validateRequest(endpoint, form, contract)
    const deadline = createDeadline(signal, requestTimeoutMs)
    let response
    let body
    try {
      response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        headers: new Headers({
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        }),
        body: new URLSearchParams(form).toString(),
        signal: deadline.signal,
      })
      if (
        response === null ||
        typeof response !== "object" ||
        !Number.isSafeInteger(response.status) ||
        !response.headers ||
        typeof response.headers.get !== "function"
      ) throw new ManagedOAuthClientError()
      const contentType = response.headers.get("content-type")
      if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/json")) {
        throw new ManagedOAuthClientError()
      }
      body = await readBoundedBody(response)
      return { status: response.status, contentType, body }
    } catch (error) {
      if (error instanceof ManagedOAuthClientError || error instanceof TypeError) throw error
      if (signal?.aborted && error?.name === "AbortError") throw error
      throw new ManagedOAuthClientError()
    } finally {
      deadline.dispose()
      body = undefined
      response = undefined
    }
  }

  return Object.freeze({
    request,

    async revoke({ refreshToken, signal } = {}) {
      if (!isBoundedString(refreshToken, 16 * 1024)) throw new ManagedOAuthClientError()
      const deadline = createDeadline(signal, requestTimeoutMs)
      let response
      try {
        response = await fetch(contract.revocationEndpoint, {
          method: "POST",
          redirect: "error",
          headers: new Headers({
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
          }),
          body: new URLSearchParams({
            client_id: contract.clientId,
            token: refreshToken,
            token_type_hint: "refresh_token",
          }).toString(),
          signal: deadline.signal,
        })
        if (response === null || typeof response !== "object" || response.status !== 200) {
          throw new ManagedOAuthClientError()
        }
      } catch (error) {
        if (error instanceof ManagedOAuthClientError || error instanceof TypeError) throw error
        if (signal?.aborted && error?.name === "AbortError") throw error
        throw new ManagedOAuthClientError()
      } finally {
        deadline.dispose()
        response = undefined
        refreshToken = undefined
      }
    },

    async refreshGrant({ refreshToken, scopes, signal } = {}) {
      if (!isBoundedString(refreshToken, 16 * 1024) || !sameScopes(scopes, contract.requiredScopes)) {
        throw new ManagedOAuthClientError()
      }
      let response
      let value
      try {
        response = await request({
          endpoint: contract.tokenEndpoint,
          form: {
            client_id: contract.clientId,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            scope: scopes.join(" "),
          },
          signal,
        })
        if (response.status !== 200) throw new ManagedOAuthClientError()
        value = JSON.parse(response.body)
        validateTokenResponse(value, contract.requiredScopes)
        const currentTime = now()
        if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
          throw new ManagedOAuthClientError()
        }
        return Object.freeze({
          accessToken: value.access_token,
          ...(value.refresh_token === undefined ? {} : { refreshToken: value.refresh_token }),
          expiresAt: new Date(currentTime.getTime() + value.expires_in * 1000).toISOString(),
          scopes: Object.freeze(value.scope.split(" ").filter(Boolean)),
        })
      } catch (error) {
        if (error instanceof ManagedOAuthClientError || error instanceof TypeError) throw error
        if (error?.name === "AbortError") throw error
        throw new ManagedOAuthClientError()
      } finally {
        value = undefined
        response = undefined
        refreshToken = undefined
      }
    },
  })
}

function createDeadline(callerSignal, timeoutMs) {
  if (callerSignal !== undefined && (
    callerSignal === null ||
    typeof callerSignal !== "object" ||
    typeof callerSignal.addEventListener !== "function" ||
    typeof callerSignal.removeEventListener !== "function" ||
    typeof callerSignal.aborted !== "boolean"
  )) throw new TypeError("Invalid managed OAuth abort signal")
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(callerSignal.reason)
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs)
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      callerSignal?.removeEventListener("abort", abortFromCaller)
    },
  }
}

function isTimeout(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIMER_DELAY_MS
}

function validateContract(contract) {
  if (
    !isPlainObject(contract) ||
    contract.issuer !== "https://auth.x.ai" ||
    !isBoundedString(contract.clientId, 256) ||
    contract.tokenEndpoint !== "https://auth.x.ai/oauth2/token" ||
    contract.revocationEndpoint !== "https://auth.x.ai/oauth2/revoke" ||
    (contract.deviceAuthorizationEndpoint !== undefined &&
      contract.deviceAuthorizationEndpoint !== "https://auth.x.ai/oauth2/device/code") ||
    !Array.isArray(contract.requiredScopes) ||
    contract.requiredScopes.length === 0 ||
    contract.requiredScopes.length > 16 ||
    !contract.requiredScopes.every((scope) => isBoundedString(scope, 128)) ||
    new Set(contract.requiredScopes).size !== contract.requiredScopes.length
  ) {
    throw new TypeError("Invalid managed OAuth contract")
  }
}

function validateRequest(endpoint, form, contract) {
  if (!isPlainObject(form)) throw new TypeError("Invalid managed OAuth request")
  const keys = Object.keys(form).sort()
  const deviceKeys = ["client_id", "scope"]
  const refreshKeys = ["client_id", "grant_type", "refresh_token", "scope"]
  const deviceTokenKeys = ["client_id", "device_code", "grant_type"]
  const matches = (expected) => keys.length === expected.length && keys.every((key, index) => key === expected[index])
  if (
    endpoint !== contract.tokenEndpoint &&
    endpoint !== contract.deviceAuthorizationEndpoint
  ) throw new TypeError("Invalid managed OAuth request")
  if (
    (endpoint === contract.deviceAuthorizationEndpoint && !matches(deviceKeys)) ||
    (endpoint === contract.tokenEndpoint && !matches(refreshKeys) && !matches(deviceTokenKeys)) ||
    !Object.values(form).every((value) => isBoundedString(value, 16 * 1024)) ||
    form.client_id !== contract.clientId
  ) throw new TypeError("Invalid managed OAuth request")
}

function validateTokenResponse(value, requiredScopes) {
  if (
    !isPlainObject(value) ||
    !isBoundedString(value.access_token, 16 * 1024) ||
    (value.refresh_token !== undefined && !isBoundedString(value.refresh_token, 16 * 1024)) ||
    value.token_type !== "Bearer" ||
    !Number.isSafeInteger(value.expires_in) ||
    value.expires_in < 60 ||
    value.expires_in > 86_400 ||
    !isBoundedString(value.scope, 2048) ||
    !sameScopes(value.scope.split(" ").filter(Boolean), requiredScopes)
  ) throw new ManagedOAuthClientError()
}

async function readBoundedBody(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    if (typeof response.text !== "function") throw new ManagedOAuthClientError()
    const body = await response.text()
    if (typeof body !== "string" || Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new ManagedOAuthClientError()
    }
    return body
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let total = 0
  let body = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) throw new ManagedOAuthClientError()
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) throw new ManagedOAuthClientError()
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    return body
  } finally {
    reader.releaseLock()
  }
}

function sameScopes(scopes, requiredScopes) {
  return (
    Array.isArray(scopes) &&
    scopes.length === requiredScopes.length &&
    scopes.every((scope) => isBoundedString(scope, 128)) &&
    new Set(scopes).size === scopes.length &&
    requiredScopes.every((scope) => scopes.includes(scope))
  )
}

function isBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

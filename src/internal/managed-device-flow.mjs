const MAX_RESPONSE_BYTES = 64 * 1024
const USER_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/

export class ManagedDeviceFlowError extends Error {
  constructor() {
    super("The Grok device authorization response is invalid or unsupported")
    this.name = "ManagedDeviceFlowError"
  }
}

export function createManagedDeviceFlow({ contract, now, request, sleep = sleepWithSignal }) {
  validateContract(contract)
  if (typeof now !== "function" || typeof request !== "function" || typeof sleep !== "function") {
    throw new TypeError("Invalid managed device flow dependencies")
  }

  const privateSessions = new WeakMap()

  return Object.freeze({
    async begin({ signal } = {}) {
      let response
      let body
      let value

      try {
        response = await request({
          endpoint: contract.deviceAuthorizationEndpoint,
          form: {
            client_id: contract.clientId,
            scope: contract.scopes.join(" "),
          },
          signal,
        })
        if (
          !isPlainObject(response) ||
          response.status !== 200 ||
          typeof response.contentType !== "string" ||
          !response.contentType.toLowerCase().startsWith("application/json") ||
          typeof response.body !== "string" ||
          Buffer.byteLength(response.body, "utf8") > MAX_RESPONSE_BYTES
        ) {
          throw new ManagedDeviceFlowError()
        }
        body = response.body
        value = JSON.parse(body)
        validateDeviceAuthorization(value, contract)

        const currentTime = now()
        if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
          throw new ManagedDeviceFlowError()
        }
        const expiresAt = new Date(currentTime.getTime() + value.expires_in * 1000)
        const publicStatus = Object.freeze({
          verificationUri: value.verification_uri,
          verificationUriComplete: value.verification_uri_complete,
          userCode: value.user_code,
          expiresAt: expiresAt.toISOString(),
        })
        const session = Object.freeze({ public: publicStatus })
        privateSessions.set(session, {
          deviceCode: value.device_code,
          expiresAt: expiresAt.getTime(),
          intervalMs: value.interval * 1000,
          waiting: false,
        })
        return session
      } catch (error) {
        if (error instanceof ManagedDeviceFlowError || error instanceof TypeError) throw error
        if (error?.name === "AbortError") throw error
        throw new ManagedDeviceFlowError()
      } finally {
        value = undefined
        body = undefined
        response = undefined
      }
    },

    async waitForGrant(session, { signal } = {}) {
      const privateSession = privateSessions.get(session)
      if (privateSession === undefined || privateSession.waiting) {
        throw new ManagedDeviceFlowError()
      }

      privateSession.waiting = true
      let response
      let body
      let value
      let intervalMs = privateSession.intervalMs

      try {
        while (true) {
          assertSessionNotExpired(privateSession, now)
          await sleep(intervalMs, { signal })
          assertSessionNotExpired(privateSession, now)

          response = await request({
            endpoint: contract.tokenEndpoint,
            form: {
              client_id: contract.clientId,
              device_code: privateSession.deviceCode,
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            },
            signal,
          })
          body = readJsonResponseBody(response)
          value = JSON.parse(body)

          if (response.status === 400 && isPlainObject(value)) {
            if (value.error === "authorization_pending") {
              continue
            }
            if (value.error === "slow_down") {
              intervalMs += 5_000
              continue
            }
          }

          if (response.status !== 200) throw new ManagedDeviceFlowError()
          const grant = normalizeTokenGrant(value, contract, now)
          privateSessions.delete(session)
          return grant
        }
      } catch (error) {
        if (error instanceof ManagedDeviceFlowError || error instanceof TypeError) throw error
        if (error?.name === "AbortError") throw error
        throw new ManagedDeviceFlowError()
      } finally {
        privateSession.waiting = false
        value = undefined
        body = undefined
        response = undefined
      }
    },
  })
}

function assertSessionNotExpired(privateSession, now) {
  const currentTime = now()
  if (
    !(currentTime instanceof Date) ||
    !Number.isFinite(currentTime.getTime()) ||
    currentTime.getTime() >= privateSession.expiresAt
  ) {
    throw new ManagedDeviceFlowError()
  }
}

function readJsonResponseBody(response) {
  if (
    !isPlainObject(response) ||
    !Number.isSafeInteger(response.status) ||
    typeof response.contentType !== "string" ||
    !response.contentType.toLowerCase().startsWith("application/json") ||
    typeof response.body !== "string" ||
    Buffer.byteLength(response.body, "utf8") > MAX_RESPONSE_BYTES
  ) {
    throw new ManagedDeviceFlowError()
  }
  return response.body
}

function normalizeTokenGrant(value, contract, now) {
  if (
    !isPlainObject(value) ||
    !isBoundedString(value.access_token, 16 * 1024) ||
    !isBoundedString(value.refresh_token, 16 * 1024) ||
    value.token_type !== "Bearer" ||
    !Number.isSafeInteger(value.expires_in) ||
    value.expires_in < 60 ||
    value.expires_in > 86_400 ||
    !isBoundedString(value.scope, 2048)
  ) {
    throw new ManagedDeviceFlowError()
  }

  const scopes = value.scope.split(" ").filter(Boolean)
  if (
    scopes.length !== contract.scopes.length ||
    new Set(scopes).size !== scopes.length ||
    !contract.scopes.every((scope) => scopes.includes(scope))
  ) {
    throw new ManagedDeviceFlowError()
  }

  const currentTime = now()
  if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
    throw new ManagedDeviceFlowError()
  }

  return Object.freeze({
    version: 1,
    issuer: contract.verificationOrigin,
    clientId: contract.clientId,
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: new Date(currentTime.getTime() + value.expires_in * 1000).toISOString(),
    scopes: Object.freeze([...contract.scopes]),
    generation: 1,
  })
}

function sleepWithSignal(delayMs, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
      return
    }

    const finish = () => {
      signal?.removeEventListener("abort", abort)
      resolve()
    }
    const abort = () => {
      clearTimeout(timeout)
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
    }
    const timeout = setTimeout(finish, delayMs)
    signal?.addEventListener("abort", abort, { once: true })
  })
}

function validateContract(contract) {
  if (
    !isPlainObject(contract) ||
    !isBoundedString(contract.clientId, 256) ||
    contract.deviceAuthorizationEndpoint !== "https://auth.x.ai/oauth2/device/code" ||
    contract.tokenEndpoint !== "https://auth.x.ai/oauth2/token" ||
    contract.verificationOrigin !== "https://auth.x.ai" ||
    typeof contract.verificationPath !== "string" ||
    !contract.verificationPath.startsWith("/oauth2/device/") ||
    contract.verificationPath.length > 256 ||
    !Array.isArray(contract.scopes) ||
    contract.scopes.length === 0 ||
    contract.scopes.length > 16 ||
    !contract.scopes.every((scope) => isBoundedString(scope, 128)) ||
    new Set(contract.scopes).size !== contract.scopes.length
  ) {
    throw new TypeError("Invalid managed device flow contract")
  }
}

function validateDeviceAuthorization(value, contract) {
  if (
    !isPlainObject(value) ||
    !isBoundedString(value.device_code, 4096) ||
    !isBoundedString(value.user_code, 64) ||
    !USER_CODE_PATTERN.test(value.user_code) ||
    !Number.isSafeInteger(value.expires_in) ||
    value.expires_in < 60 ||
    value.expires_in > 1800 ||
    !Number.isSafeInteger(value.interval) ||
    value.interval < 1 ||
    value.interval > 60
  ) {
    throw new ManagedDeviceFlowError()
  }

  const verification = parseUrl(value.verification_uri)
  const complete = parseUrl(value.verification_uri_complete)
  if (
    verification.origin !== contract.verificationOrigin ||
    verification.pathname !== contract.verificationPath ||
    verification.search !== "" ||
    verification.hash !== "" ||
    complete.origin !== contract.verificationOrigin ||
    complete.pathname !== contract.verificationPath ||
    complete.hash !== "" ||
    complete.searchParams.size !== 1 ||
    complete.searchParams.get("user_code") !== value.user_code
  ) {
    throw new ManagedDeviceFlowError()
  }
}

function parseUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new ManagedDeviceFlowError()
  let url
  try {
    url = new URL(value)
  } catch {
    throw new ManagedDeviceFlowError()
  }
  if (url.username !== "" || url.password !== "") throw new ManagedDeviceFlowError()
  return url
}

function isBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

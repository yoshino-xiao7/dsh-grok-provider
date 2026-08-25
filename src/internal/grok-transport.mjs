const BASE_URL = "https://cli-chat-proxy.grok.com"
const MAX_JSON_RESPONSE_BYTES = 256 * 1024
const MAX_REQUEST_BYTES = 16 * 1024 * 1024
const DEFAULT_MODEL_TIMEOUT_MS = 30 * 1000
const DEFAULT_RESPONSE_TIMEOUT_MS = 10 * 60 * 1000
const MAX_TIMER_DELAY_MS = 2_147_483_647

export class GrokTransportError extends Error {
  constructor(status) {
    super("The Grok Build transport request failed")
    this.name = "GrokTransportError"
    if (status !== undefined) this.status = status
  }
}

export function createGrokTransport({
  credentialSource,
  fetch,
  attributionHeaders,
  clientIdentifier,
  clientVersion,
  modelTimeoutMs = DEFAULT_MODEL_TIMEOUT_MS,
  responseTimeoutMs = DEFAULT_RESPONSE_TIMEOUT_MS,
}) {
  if (
    !credentialSource ||
    typeof credentialSource.withAccessToken !== "function" ||
    typeof fetch !== "function" ||
    typeof attributionHeaders !== "function" ||
    !isHeaderValue(clientIdentifier) ||
    !isHeaderValue(clientVersion) ||
    !isTimeout(modelTimeoutMs) ||
    !isTimeout(responseTimeoutMs)
  ) {
    throw new TypeError("Invalid Grok transport dependencies")
  }

  return Object.freeze({
    async listModels({ signal } = {}) {
      const deadline = createDeadline(signal, modelTimeoutMs)
      try {
        return await credentialSource.withAccessToken(async (accessToken) => {
          let response
          try {
            response = await fetch(`${BASE_URL}/v1/models`, {
              method: "GET",
              redirect: "error",
              headers: buildHeaders({
                accessToken,
                attributionHeaders,
                clientIdentifier,
                clientVersion,
              }),
              signal: deadline.signal,
            })
            validateJsonResponse(response)
            if (response.status !== 200) throw new GrokTransportError(response.status)
            return await readBoundedText(response, MAX_JSON_RESPONSE_BYTES)
          } catch (error) {
            if (error instanceof GrokTransportError) throw error
            if (signal?.aborted && error?.name === "AbortError") throw error
            throw new GrokTransportError()
          } finally {
            response = undefined
            accessToken = undefined
          }
        })
      } finally {
        deadline.dispose()
      }
    },

    async *streamResponses(request, { signal } = {}) {
      if (!isPlainObject(request) || request.stream !== true || request.store !== false) {
        throw new TypeError("Invalid Grok Responses request")
      }
      let body
      try {
        body = JSON.stringify(request)
      } catch {
        throw new TypeError("Invalid Grok Responses request")
      }
      if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES) {
        throw new TypeError("Invalid Grok Responses request")
      }

      let response
      let source
      const deadline = createDeadline(signal, responseTimeoutMs)
      try {
        response = await credentialSource.withAccessToken(async (accessToken) => {
          const headers = buildHeaders({
            accessToken,
            attributionHeaders,
            clientIdentifier,
            clientVersion,
          })
          headers.set("Content-Type", "application/json")
          return fetch(`${BASE_URL}/v1/responses`, {
            method: "POST",
            redirect: "error",
            headers,
            body,
            signal: deadline.signal,
          })
        })
        validateEventStreamResponse(response)
        if (response.status !== 200) throw new GrokTransportError(response.status)
        source = response.body
        for await (const chunk of source) {
          if (!(chunk instanceof Uint8Array)) throw new GrokTransportError(response.status)
          yield chunk
        }
      } catch (error) {
        if (error instanceof GrokTransportError) throw error
        if (signal?.aborted && error?.name === "AbortError") throw error
        throw new GrokTransportError()
      } finally {
        deadline.dispose()
        source = undefined
        response = undefined
        body = undefined
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
  )) throw new TypeError("Invalid Grok transport abort signal")
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

function buildHeaders({ accessToken, attributionHeaders, clientIdentifier, clientVersion }) {
  if (!isHeaderValue(accessToken)) throw new GrokTransportError()
  const attribution = attributionHeaders()
  if (!isPlainObject(attribution)) throw new GrokTransportError()

  const headers = new Headers()
  for (const [name, value] of Object.entries(attribution)) {
    if (!isHeaderValue(name) || !isHeaderValue(value)) throw new GrokTransportError()
    headers.set(name, value)
  }
  headers.set("Accept", "application/json")
  headers.set("Authorization", `Bearer ${accessToken}`)
  headers.set("X-XAI-Token-Auth", "xai-grok-cli")
  headers.set("x-grok-client-version", clientVersion)
  headers.set("x-grok-client-identifier", clientIdentifier)
  return headers
}

function validateJsonResponse(response) {
  validateResponseShape(response)
  const contentType = response.headers.get("content-type")
  if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/json")) {
    throw new GrokTransportError(response.status)
  }
}

function validateEventStreamResponse(response) {
  validateResponseShape(response)
  const contentType = response.headers.get("content-type")
  if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("text/event-stream")) {
    throw new GrokTransportError(response.status)
  }
  if (!response.body || typeof response.body[Symbol.asyncIterator] !== "function") {
    throw new GrokTransportError(response.status)
  }
}

function validateResponseShape(response) {
  if (
    response === null ||
    typeof response !== "object" ||
    !Number.isSafeInteger(response.status) ||
    response.status < 100 ||
    response.status > 599 ||
    !response.headers ||
    typeof response.headers.get !== "function"
  ) {
    throw new GrokTransportError()
  }
}

async function readBoundedText(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== "function") {
    if (typeof response.text !== "function") throw new GrokTransportError(response.status)
    const text = await response.text()
    if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new GrokTransportError(response.status)
    }
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let byteLength = 0
  let text = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) throw new GrokTransportError(response.status)
      byteLength += value.byteLength
      if (byteLength > maxBytes) throw new GrokTransportError(response.status)
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return text
  } finally {
    reader.releaseLock()
  }
}

function isHeaderValue(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 16 * 1024 && !/[\r\n\0]/u.test(value)
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

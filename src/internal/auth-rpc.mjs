import { AuthDriverUnavailableError, AuthLoginBusyError } from "./auth-controller.mjs"

export function createAuthRpcHandler({ controller }) {
  if (
    !controller ||
    typeof controller.status !== "function" ||
    typeof controller.beginLogin !== "function" ||
    typeof controller.cancel !== "function" ||
    typeof controller.logout !== "function"
  ) throw new TypeError("Invalid Grok auth RPC controller")

  return async function handleAuthRpc(endpoint, payload, signal) {
    if (signal?.aborted) return cancelled()
    try {
      if (endpoint === "status") {
        if (!hasExactKeys(payload, [])) return badRequest()
        const status = serializable(await controller.status())
        return ok({ kind: "status", status })
      }
      if (endpoint === "login") {
        if (!hasExactKeys(payload, [])) return badRequest()
        const session = await controller.beginLogin()
        const status = serializable(session.public)
        return ok({ kind: "login-started", status, sessionId: status.sessionId })
      }
      if (endpoint === "cancel") {
        const cancellation = parseCancelPayload(payload)
        if (cancellation === undefined) return badRequest()
        return ok({
          kind: controller.cancel(cancellation.sessionId) ? "cancelled" : "not-running",
          status: serializable(await controller.status()),
        })
      }
      if (endpoint === "logout") {
        if (!hasExactKeys(payload, [])) return badRequest()
        const outcome = await controller.logout({ signal })
        if (outcome.kind === "confirmation-required") {
          return ok({
            kind: "logout-confirmation-required",
            confirmationId: outcome.confirmationId,
            expiresAt: outcome.expiresAt,
          })
        }
        return ok({ kind: `logout-${outcome.kind}`, status: serializable(await controller.status()) })
      }
      return badRequest()
    } catch (error) {
      if (error instanceof AuthLoginBusyError) {
        return ok({ kind: "busy", status: serializable(await controller.status()) })
      }
      if (error instanceof AuthDriverUnavailableError) {
        return ok({ kind: "unavailable", status: serializable(await controller.status()) })
      }
      return signal?.aborted ? cancelled() : internal()
    }
  }
}

function parseCancelPayload(payload) {
  if (
    !hasExactKeys(payload, ["sessionId"]) ||
    typeof payload.sessionId !== "string" ||
    payload.sessionId.length === 0 ||
    payload.sessionId.length > 128
  ) return undefined
  return payload
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index])
}

function serializable(value) {
  const text = JSON.stringify(value)
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 64 * 1024) {
    throw new TypeError("Invalid Grok auth RPC response")
  }
  return JSON.parse(text)
}

function ok(value) {
  return { ok: true, value }
}

function badRequest() {
  return {
    ok: false,
    error: { code: "bad-request", message: "Invalid Grok auth RPC request", details: { issues: [] } },
  }
}

function cancelled() {
  return {
    ok: false,
    error: { code: "cancelled", message: "The Grok auth operation was cancelled", details: {} },
  }
}

function internal() {
  return {
    ok: false,
    error: { code: "internal", message: "The Grok auth operation failed", details: {} },
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const OUTCOMES = new Set(["succeeded", "cancelled", "failed"])

export class AuthLoginBusyError extends Error {
  constructor() {
    super("A Grok login or logout is already running")
    this.name = "AuthLoginBusyError"
  }
}

export class AuthDriverUnavailableError extends Error {
  constructor() {
    super("The official Grok authentication driver is unavailable")
    this.name = "AuthDriverUnavailableError"
  }
}

export function createAuthController({ registry, randomUUID, now = () => new Date(), driver }) {
  if (
    !registry ||
    typeof registry.invalidate !== "function" ||
    typeof registry.status !== "function" ||
    typeof randomUUID !== "function" ||
    typeof now !== "function"
  ) throw new TypeError("Invalid Grok auth controller dependencies")

  let installed
  let active
  let state
  let confirmation
  let closing = false
  if (driver !== undefined) install(driver)

  function install(nextDriver) {
    if (!nextDriver || typeof nextDriver.begin !== "function") {
      throw new TypeError("Invalid Grok auth driver")
    }
    const token = Object.freeze({})
    installed = { driver: nextDriver, token }
    return () => {
      if (installed?.token === token) installed = undefined
    }
  }

  return Object.freeze({
    installDriver: install,

    status() {
      return Object.freeze({
        ...registry.status(),
        driver: installed !== undefined,
        ...(state === undefined ? {} : { session: Object.freeze({ ...state }) }),
      })
    },

    async beginLogin() {
      if (active !== undefined || closing) throw new AuthLoginBusyError()
      if (installed === undefined) throw new AuthDriverUnavailableError()

      const sessionId = createId(randomUUID, "Invalid Grok auth session id")
      const abortController = new AbortController()
      let started
      try {
        started = await installed.driver.begin({ signal: abortController.signal })
      } catch {
        state = { state: "failed", sessionId }
        registry.invalidate()
        throw new AuthDriverUnavailableError()
      }
      if (
        !isPlainObject(started) ||
        Object.keys(started).length !== 1 ||
        !started.completion ||
        typeof started.completion.then !== "function"
      ) throw new TypeError("Invalid Grok auth driver session")

      const publicState = Object.freeze({ sessionId, state: "running" })
      state = publicState
      const settled = Promise.resolve(started.completion).then(
        (outcome) => normalizeOutcome(outcome),
        () => Object.freeze({ kind: abortController.signal.aborted ? "cancelled" : "failed" }),
      ).then((outcome) => {
        state = { state: outcome.kind, sessionId }
        active = undefined
        registry.invalidate()
        return outcome
      })

      const session = Object.freeze({
        public: publicState,
        cancel() {
          abortController.abort()
        },
        async wait({ signal } = {}) {
          if (!signal) return settled
          if (signal.aborted) {
            abortController.abort(signal.reason)
            return settled
          }
          const abort = () => abortController.abort(signal.reason)
          signal.addEventListener("abort", abort, { once: true })
          try {
            return await settled
          } finally {
            signal.removeEventListener("abort", abort)
          }
        },
      })
      active = session
      return session
    },

    cancel(sessionId) {
      if (active === undefined || active.public.sessionId !== sessionId) return false
      active.cancel()
      return true
    },

    async shutdown() {
      if (active === undefined) return false
      active.cancel()
      await active.wait()
      return true
    },

    async logout({ signal } = {}) {
      if (closing) throw new AuthLoginBusyError()
      if (installed === undefined || typeof installed.driver.logout !== "function") {
        throw new AuthDriverUnavailableError()
      }
      const currentTime = now()
      if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
        throw new TypeError("Invalid Grok auth controller clock")
      }
      if (confirmation === undefined || confirmation.expiresAt <= currentTime.getTime()) {
        const confirmationId = createId(randomUUID, "Invalid Grok logout confirmation id")
        const expiresAt = currentTime.getTime() + 30_000
        confirmation = { confirmationId, expiresAt }
        return Object.freeze({
          kind: "confirmation-required",
          confirmationId,
          expiresAt: new Date(expiresAt).toISOString(),
        })
      }

      confirmation = undefined
      closing = true
      try {
        if (active !== undefined) {
          active.cancel()
          await active.wait()
        }
        let outcome
        try {
          outcome = normalizeOutcome(await installed.driver.logout({ signal }))
        } catch {
          outcome = Object.freeze({ kind: signal?.aborted ? "cancelled" : "failed" })
        }
        registry.invalidate()
        return outcome
      } finally {
        closing = false
      }
    },
  })
}

function normalizeOutcome(outcome) {
  if (!isPlainObject(outcome) || !OUTCOMES.has(outcome.kind) || Object.keys(outcome).length !== 1) {
    return Object.freeze({ kind: "failed" })
  }
  return Object.freeze({ kind: outcome.kind })
}

function createId(randomUUID, message) {
  const value = randomUUID()
  if (typeof value !== "string" || value.length === 0 || value.length > 128) throw new TypeError(message)
  return value
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

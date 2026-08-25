const MODES = ["official-cli", "managed-device"]
const OUTCOMES = new Set(["succeeded", "cancelled", "failed"])

export class AuthLoginBusyError extends Error {
  constructor() {
    super("A Grok login is already running for this authentication mode")
    this.name = "AuthLoginBusyError"
  }
}

export class AuthDriverUnavailableError extends Error {
  constructor() {
    super("The requested Grok authentication driver is unavailable")
    this.name = "AuthDriverUnavailableError"
  }
}

export function createAuthController({ registry, randomUUID, now = () => new Date(), drivers = {} }) {
  if (
    !registry ||
    typeof registry.select !== "function" ||
    typeof registry.invalidate !== "function" ||
    typeof registry.status !== "function" ||
    typeof randomUUID !== "function" ||
    typeof now !== "function" ||
    !isPlainObject(drivers)
  ) throw new TypeError("Invalid Grok auth controller dependencies")

  const installed = new Map()
  const active = new Map()
  const states = new Map()
  const confirmations = new Map()
  const closing = new Set()
  for (const mode of MODES) {
    if (drivers[mode] !== undefined) install(mode, drivers[mode])
  }

  function install(mode, driver) {
    requireMode(mode)
    if (!driver || typeof driver.begin !== "function") throw new TypeError("Invalid Grok auth driver")
    const token = Object.freeze({})
    installed.set(mode, { driver, token })
    return () => {
      if (installed.get(mode)?.token === token) installed.delete(mode)
    }
  }

  return Object.freeze({
    installDriver: install,

    use(mode) {
      requireMode(mode)
      confirmations.clear()
      registry.select(mode)
    },

    status() {
      const registryStatus = registry.status()
      const sessions = {}
      for (const mode of MODES) {
        const state = states.get(mode)
        if (state !== undefined) sessions[mode] = Object.freeze({ ...state })
      }
      return Object.freeze({
        ...registryStatus,
        drivers: Object.freeze({
          "official-cli": installed.has("official-cli"),
          "managed-device": installed.has("managed-device"),
        }),
        sessions: Object.freeze(sessions),
      })
    },

    async beginLogin(mode) {
      requireMode(mode)
      if (active.has(mode) || closing.has(mode)) throw new AuthLoginBusyError()
      const installedDriver = installed.get(mode)
      if (installedDriver === undefined) throw new AuthDriverUnavailableError()

      const sessionId = randomUUID()
      if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 128) {
        throw new TypeError("Invalid Grok auth session id")
      }
      const abortController = new AbortController()
      let started
      try {
        started = await installedDriver.driver.begin({ signal: abortController.signal })
      } catch {
        states.set(mode, { state: "failed", sessionId })
        registry.invalidate()
        throw new AuthDriverUnavailableError()
      }
      if (!isPlainObject(started) || !started.completion || typeof started.completion.then !== "function") {
        throw new TypeError("Invalid Grok auth driver session")
      }

      const managedPublic = copyManagedPublic(started.public)
      const publicState = Object.freeze({
        sessionId,
        mode,
        state: "running",
        ...managedPublic,
      })
      states.set(mode, { state: "running", sessionId, ...managedPublic })
      const settled = Promise.resolve(started.completion).then(
        (outcome) => normalizeOutcome(outcome),
        () => Object.freeze({ kind: abortController.signal.aborted ? "cancelled" : "failed" }),
      ).then((outcome) => {
        states.set(mode, { state: outcome.kind, sessionId })
        active.delete(mode)
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
      active.set(mode, session)
      return session
    },

    cancel(mode, sessionId) {
      requireMode(mode)
      const session = active.get(mode)
      if (session === undefined || session.public.sessionId !== sessionId) return false
      session.cancel()
      return true
    },

    async shutdown(mode) {
      requireMode(mode)
      const session = active.get(mode)
      if (session === undefined) return false
      session.cancel()
      await session.wait()
      return true
    },

    async logout(mode, { signal } = {}) {
      requireMode(mode)
      if (closing.has(mode)) throw new AuthLoginBusyError()
      const installedDriver = installed.get(mode)
      if (installedDriver === undefined || typeof installedDriver.driver.logout !== "function") {
        throw new AuthDriverUnavailableError()
      }
      const currentTime = now()
      if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
        throw new TypeError("Invalid Grok auth controller clock")
      }
      const confirmation = confirmations.get(mode)
      if (confirmation === undefined || confirmation.expiresAt <= currentTime.getTime()) {
        const confirmationId = randomUUID()
        if (typeof confirmationId !== "string" || confirmationId.length === 0 || confirmationId.length > 128) {
          throw new TypeError("Invalid Grok logout confirmation id")
        }
        const expiresAt = currentTime.getTime() + 30_000
        confirmations.set(mode, { confirmationId, expiresAt })
        return Object.freeze({
          kind: "confirmation-required",
          confirmationId,
          expiresAt: new Date(expiresAt).toISOString(),
        })
      }

      confirmations.delete(mode)
      closing.add(mode)
      try {
        const session = active.get(mode)
        if (session !== undefined) {
          session.cancel()
          await session.wait()
        }
        let outcome
        try {
          outcome = normalizeOutcome(await installedDriver.driver.logout({ signal }))
        } catch {
          outcome = Object.freeze({ kind: signal?.aborted ? "cancelled" : "failed" })
        }
        registry.invalidate()
        return outcome
      } finally {
        closing.delete(mode)
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

function copyManagedPublic(value) {
  if (value === undefined) return {}
  if (
    !isPlainObject(value) ||
    typeof value.verificationUri !== "string" ||
    typeof value.verificationUriComplete !== "string" ||
    typeof value.userCode !== "string" ||
    typeof value.expiresAt !== "string"
  ) throw new TypeError("Invalid managed device public status")
  return {
    verificationUri: value.verificationUri,
    verificationUriComplete: value.verificationUriComplete,
    userCode: value.userCode,
    expiresAt: value.expiresAt,
  }
}

function requireMode(mode) {
  if (!MODES.includes(mode)) throw new TypeError("Invalid Grok authentication mode")
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

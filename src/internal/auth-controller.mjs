const OUTCOMES = new Set(["succeeded", "cancelled", "failed", "cleanup-failed"])
const FAILURE_REASONS = new Set([
  "cli-missing",
  "cli-invalid",
  "auth-network-timeout",
  "login-timeout",
  "cli-failed",
])

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
  let refreshing
  let shutdownWait
  let state
  let confirmation
  let closing
  let quarantined = false
  if (driver !== undefined) install(driver)

  function install(nextDriver) {
    if (!nextDriver || typeof nextDriver.begin !== "function") {
      throw new TypeError("Invalid Grok auth driver")
    }
    const token = Object.freeze({})
    installed = { driver: nextDriver, token }
    quarantined = false
    confirmation = undefined
    return () => {
      if (installed?.token === token) {
        installed = undefined
        quarantined = false
        confirmation = undefined
      }
    }
  }

  return Object.freeze({
    installDriver: install,

    async status() {
      return Object.freeze({
        ...await registry.status(),
        driver: installed !== undefined && !quarantined,
        ...(state === undefined ? {} : { session: Object.freeze({ ...state }) }),
      })
    },

    async beginLogin() {
      if (active !== undefined || refreshing !== undefined || closing || shutdownWait !== undefined) {
        throw new AuthLoginBusyError()
      }
      if (installed === undefined || quarantined) throw new AuthDriverUnavailableError()

      const sessionId = createId(randomUUID, "Invalid Grok auth session id")
      const abortController = new AbortController()
      const driverRegistration = installed
      const publicState = Object.freeze({ sessionId, state: "running" })
      state = publicState
      confirmation = undefined
      let resolveStarted
      let rejectStarted
      const startedReady = new Promise((resolve, reject) => {
        resolveStarted = resolve
        rejectStarted = reject
      })
      const settled = startedReady.then(
        (started) => Promise.resolve(started.completion).then(
          (outcome) => normalizeOutcome(outcome),
          () => Object.freeze({ kind: abortController.signal.aborted ? "cancelled" : "failed" }),
        ),
        () => Object.freeze({ kind: abortController.signal.aborted ? "cancelled" : "failed" }),
      ).then((outcome) => {
        const registrationIsCurrent = installed?.token === driverRegistration.token
        const cleanupFailed = outcome.kind === "cleanup-failed"
        if (cleanupFailed && registrationIsCurrent) {
          quarantined = true
          confirmation = undefined
        }
        const publicOutcome = cleanupFailed || !registrationIsCurrent
          ? Object.freeze({ kind: "failed" })
          : abortController.signal.aborted
            ? Object.freeze({ kind: "cancelled" })
            : outcome
        state = {
          state: publicOutcome.kind,
          sessionId,
          ...(publicOutcome.kind === "failed" && publicOutcome.reason !== undefined
            ? { reason: publicOutcome.reason }
            : {}),
        }
        if (active === session) active = undefined
        registry.invalidate()
        return publicOutcome
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

      let started
      try {
        started = await driverRegistration.driver.begin({ signal: abortController.signal })
      } catch {
        rejectStarted(new AuthDriverUnavailableError())
        await settled
        throw new AuthDriverUnavailableError()
      }
      if (
        !isPlainObject(started) ||
        Object.keys(started).length !== 1 ||
        !started.completion ||
        typeof started.completion.then !== "function"
      ) {
        rejectStarted(new TypeError("Invalid Grok auth driver session"))
        await settled
        throw new TypeError("Invalid Grok auth driver session")
      }
      resolveStarted(started)
      return session
    },

    cancel(sessionId) {
      if (active === undefined || active.public.sessionId !== sessionId) return false
      active.cancel()
      return true
    },

    async shutdown() {
      if (shutdownWait !== undefined) return shutdownWait
      const operations = [active, refreshing, closing].filter((operation) => operation !== undefined)
      if (operations.length === 0) return false
      let resolveShutdown
      let rejectShutdown
      const wait = new Promise((resolve, reject) => {
        resolveShutdown = resolve
        rejectShutdown = reject
      })
      shutdownWait = wait
      for (const operation of operations) operation.cancel()
      Promise.all(operations.map((operation) => operation.wait())).then(
        () => resolveShutdown(true),
        rejectShutdown,
      )
      try {
        return await wait
      } finally {
        if (shutdownWait === wait) shutdownWait = undefined
      }
    },

    async refresh({ signal } = {}) {
      if (active !== undefined || refreshing !== undefined || closing || shutdownWait !== undefined) {
        throw new AuthLoginBusyError()
      }
      if (installed === undefined || quarantined || typeof installed.driver.refresh !== "function") {
        throw new AuthDriverUnavailableError()
      }

      const driverRegistration = installed
      const abortController = new AbortController()
      const abortFromCaller = () => abortController.abort(signal.reason)
      if (signal?.aborted) abortFromCaller()
      else signal?.addEventListener("abort", abortFromCaller, { once: true })
      confirmation = undefined

      let operation
      const settled = Promise.resolve().then(() => {
        if (installed?.token !== driverRegistration.token || quarantined) {
          throw new AuthDriverUnavailableError()
        }
        abortController.signal.throwIfAborted()
        return driverRegistration.driver.refresh({ signal: abortController.signal })
      }).then(
        (outcome) => normalizeOutcome(outcome),
        () => Object.freeze({ kind: abortController.signal.aborted ? "cancelled" : "failed" }),
      ).then((outcome) => {
        const registrationIsCurrent = installed?.token === driverRegistration.token
        const cleanupFailed = outcome.kind === "cleanup-failed"
        if (cleanupFailed && registrationIsCurrent) {
          quarantined = true
          confirmation = undefined
        }
        if (!registrationIsCurrent || quarantined || cleanupFailed) {
          return Object.freeze({ kind: "failed" })
        }
        if (abortController.signal.aborted) return Object.freeze({ kind: "cancelled" })
        return outcome
      }).finally(() => {
        signal?.removeEventListener("abort", abortFromCaller)
        if (refreshing === operation) refreshing = undefined
        registry.invalidate()
      })
      operation = Object.freeze({
        driverToken: driverRegistration.token,
        cancel() {
          abortController.abort()
        },
        wait() {
          return settled
        },
      })
      refreshing = operation
      return settled
    },

    async logout({ signal } = {}) {
      if (closing !== undefined || refreshing !== undefined || shutdownWait !== undefined) {
        throw new AuthLoginBusyError()
      }
      if (installed === undefined || quarantined || typeof installed.driver.logout !== "function") {
        throw new AuthDriverUnavailableError()
      }
      const currentTime = now()
      if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
        throw new TypeError("Invalid Grok auth controller clock")
      }
      if (
        confirmation === undefined ||
        confirmation.driverToken !== installed.token ||
        confirmation.expiresAt <= currentTime.getTime()
      ) {
        const confirmationId = createId(randomUUID, "Invalid Grok logout confirmation id")
        const expiresAt = currentTime.getTime() + 30_000
        confirmation = { confirmationId, expiresAt, driverToken: installed.token }
        return Object.freeze({
          kind: "confirmation-required",
          confirmationId,
          expiresAt: new Date(expiresAt).toISOString(),
        })
      }

      confirmation = undefined
      const driverRegistration = installed
      const loginOperation = active
      loginOperation?.cancel()
      const abortController = new AbortController()
      const abortFromCaller = () => abortController.abort(signal.reason)
      if (signal?.aborted) abortFromCaller()
      else signal?.addEventListener("abort", abortFromCaller, { once: true })

      let operation
      const settled = Promise.resolve().then(async () => {
        if (loginOperation !== undefined) {
          await loginOperation.wait()
        }
        if (installed?.token !== driverRegistration.token || quarantined) {
          return Object.freeze({ kind: "failed" })
        }
        let outcome
        try {
          abortController.signal.throwIfAborted()
          outcome = normalizeOutcome(await driverRegistration.driver.logout({
            signal: abortController.signal,
          }))
        } catch {
          outcome = Object.freeze({ kind: abortController.signal.aborted ? "cancelled" : "failed" })
        }
        const registrationIsCurrent = installed?.token === driverRegistration.token
        const cleanupFailed = outcome.kind === "cleanup-failed"
        if (cleanupFailed && registrationIsCurrent) {
          quarantined = true
          confirmation = undefined
        }
        const publicOutcome = cleanupFailed || !registrationIsCurrent || quarantined
          ? Object.freeze({ kind: "failed" })
          : abortController.signal.aborted
            ? Object.freeze({ kind: "cancelled" })
            : outcome
        return publicOutcome
      }).finally(() => {
        signal?.removeEventListener("abort", abortFromCaller)
        if (closing === operation) closing = undefined
        registry.invalidate()
      })
      operation = Object.freeze({
        driverToken: driverRegistration.token,
        cancel() {
          abortController.abort()
        },
        wait() {
          return settled
        },
      })
      closing = operation
      return settled
    },
  })
}

function normalizeOutcome(outcome) {
  if (!isPlainObject(outcome) || !OUTCOMES.has(outcome.kind)) {
    return Object.freeze({ kind: "failed" })
  }
  const keys = Object.keys(outcome)
  if (outcome.kind === "failed") {
    if (keys.length === 1) return Object.freeze({ kind: "failed" })
    if (keys.length === 2 && FAILURE_REASONS.has(outcome.reason)) {
      return Object.freeze({ kind: "failed", reason: outcome.reason })
    }
    return Object.freeze({ kind: "failed" })
  }
  if (keys.length !== 1) return Object.freeze({ kind: "failed" })
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

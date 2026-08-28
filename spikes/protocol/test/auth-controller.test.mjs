import assert from "node:assert/strict"
import test from "node:test"

import { createAuthController } from "../../../src/internal/auth-controller.mjs"
import { createAuthRegistry } from "../../../src/internal/auth-registry.mjs"

test("one login session exposes only public state, cancels, and invalidates auth generation", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  registry.install({ id: "official", async withAccessToken(operation) { return operation("fixture") } })
  let finish
  const controller = createAuthController({
    registry,
    randomUUID: () => "fixture-session-id",
    driver: {
        async begin({ signal }) {
          return {
            completion: new Promise((resolve) => {
              finish = () => resolve(signal.aborted ? { kind: "cancelled" } : { kind: "succeeded" })
            }),
          }
        },
    },
  })

  const session = await controller.beginLogin()
  assert.deepEqual(session.public, {
    sessionId: "fixture-session-id",
    state: "running",
  })
  assert.equal(JSON.stringify(session).includes("completion"), false)
  await assert.rejects(controller.beginLogin(), { name: "AuthLoginBusyError" })

  assert.equal(controller.cancel("stale-session"), false)
  assert.equal(controller.cancel("fixture-session-id"), true)
  finish()
  assert.deepEqual(await session.wait(), { kind: "cancelled" })
  assert.equal((await registry.status()).generation, 2)
  assert.deepEqual((await controller.status()).session, {
    state: "cancelled",
    sessionId: "fixture-session-id",
  })
})

test("concurrent login starts reserve one single-flight session", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let beginCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => `concurrent-login-${beginCalls + 1}`,
    driver: {
      async begin() {
        beginCalls += 1
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
    },
  })

  const attempts = await Promise.allSettled([
    controller.beginLogin(),
    controller.beginLogin(),
  ])

  assert.equal(beginCalls, 1)
  assert.equal(attempts.filter(({ status }) => status === "fulfilled").length, 1)
  const rejected = attempts.find(({ status }) => status === "rejected")
  assert.equal(rejected?.reason?.name, "AuthLoginBusyError")
  const session = attempts.find(({ status }) => status === "fulfilled")?.value
  assert.deepEqual(await session.wait(), { kind: "succeeded" })
})

test("capability shutdown cancels and waits for the active login before returning", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let completionSettled = false
  const controller = createAuthController({
    registry,
    randomUUID: () => "shutdown-session",
    driver: {
        async begin({ signal }) {
          return {
            completion: new Promise((resolve) => signal.addEventListener("abort", () => {
              completionSettled = true
              resolve({ kind: "succeeded" })
            }, { once: true })),
          }
        },
    },
  })
  await controller.beginLogin()

  assert.equal(await controller.shutdown(), true)
  assert.equal(completionSettled, true)
  assert.equal((await controller.status()).session.state, "cancelled")
})

test("shutdown fences a confirmed logout that arrives after its operation snapshot", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let finishLogin
  let logoutCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => "shutdown-fence",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
      async begin() {
        return {
          completion: new Promise((resolve) => {
            finishLogin = () => resolve({ kind: "succeeded" })
          }),
        }
      },
      async logout() {
        logoutCalls += 1
        return { kind: "succeeded" }
      },
    },
  })
  await controller.beginLogin()
  assert.equal((await controller.logout()).kind, "confirmation-required")

  const shutdown = controller.shutdown()
  const competingLogout = controller.logout()
  finishLogin()
  const [competingResult] = await Promise.allSettled([competingLogout])

  assert.equal(competingResult.status, "rejected")
  assert.equal(competingResult.reason?.name, "AuthLoginBusyError")
  assert.equal(await shutdown, true)
  assert.equal(logoutCalls, 0)
})

test("cleanup failure quarantines login until the driver is replaced", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let sequence = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => `cleanup-session-${sequence += 1}`,
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "cleanup-failed" }) }
      },
    },
  })

  const failed = await controller.beginLogin()
  assert.deepEqual(await failed.wait(), { kind: "failed" })
  assert.equal((await controller.status()).driver, false)
  await assert.rejects(controller.beginLogin(), { name: "AuthDriverUnavailableError" })

  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
  })
  assert.equal((await controller.status()).driver, true)
  const recovered = await controller.beginLogin()
  assert.deepEqual(await recovered.wait(), { kind: "succeeded" })
})

test("a stale cleanup failure cannot quarantine a replacement driver", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let finishStaleLogin
  const controller = createAuthController({
    registry,
    randomUUID: () => "stale-cleanup-session",
    driver: {
      async begin() {
        return {
          completion: new Promise((resolve) => {
            finishStaleLogin = () => resolve({ kind: "cleanup-failed" })
          }),
        }
      },
    },
  })

  const staleSession = await controller.beginLogin()
  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
  })
  finishStaleLogin()

  assert.deepEqual(await staleSession.wait(), { kind: "failed" })
  assert.equal((await controller.status()).driver, true)
  const replacementSession = await controller.beginLogin()
  assert.deepEqual(await replacementSession.wait(), { kind: "succeeded" })
})

test("a stale successful login cannot report success after driver replacement", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let finishStaleLogin
  const controller = createAuthController({
    registry,
    randomUUID: () => "stale-success-session",
    driver: {
      async begin() {
        return {
          completion: new Promise((resolve) => {
            finishStaleLogin = () => resolve({ kind: "succeeded" })
          }),
        }
      },
    },
  })

  const staleSession = await controller.beginLogin()
  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
  })
  finishStaleLogin()

  assert.deepEqual(await staleSession.wait(), { kind: "failed" })
  assert.equal((await controller.status()).driver, true)
  const replacementSession = await controller.beginLogin()
  assert.deepEqual(await replacementSession.wait(), { kind: "succeeded" })
})

test("logout requires a second same-mode confirmation inside thirty seconds", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  registry.install({ id: "official", async withAccessToken(operation) { return operation("fixture") } })
  let logoutCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => "fixture-confirmation",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
        async begin() { return { completion: Promise.resolve({ kind: "succeeded" }) } },
        async logout() { logoutCalls += 1; return { kind: "succeeded" } },
    },
  })

  assert.deepEqual(await controller.logout(), {
    kind: "confirmation-required",
    confirmationId: "fixture-confirmation",
    expiresAt: "2030-01-01T00:00:30.000Z",
  })
  assert.equal(logoutCalls, 0)
  assert.deepEqual(await controller.logout(), { kind: "succeeded" })
  assert.equal(logoutCalls, 1)
  assert.equal((await registry.status()).generation, 2)
})

test("a confirmed official logout excludes a new browser login until it settles", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let finishLogout
  const controller = createAuthController({
    registry,
    randomUUID: () => "operation-id",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
        async begin() { return { completion: Promise.resolve({ kind: "succeeded" }) } },
        async logout() {
          return new Promise((resolve) => { finishLogout = () => resolve({ kind: "succeeded" }) })
        },
    },
  })
  assert.equal((await controller.logout()).kind, "confirmation-required")
  const logout = controller.logout()

  await assert.rejects(controller.beginLogin(), { name: "AuthLoginBusyError" })
  finishLogout()
  assert.deepEqual(await logout, { kind: "succeeded" })
  assert.equal((await controller.beginLogin()).public.state, "running")
})

test("confirmed logout owns and cancels a login while driver begin is pending", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let finishBegin
  let logoutCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => "pending-begin-operation",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
      async begin({ signal }) {
        return new Promise((resolve) => {
          finishBegin = () => resolve({
            completion: Promise.resolve(signal.aborted ? { kind: "cancelled" } : { kind: "succeeded" }),
          })
        })
      },
      async logout() {
        logoutCalls += 1
        return { kind: "succeeded" }
      },
    },
  })
  assert.equal((await controller.logout()).kind, "confirmation-required")

  const login = controller.beginLogin()
  assert.equal((await controller.logout()).kind, "confirmation-required")
  const logout = controller.logout()
  assert.equal(logoutCalls, 0)
  finishBegin()

  const session = await login
  assert.deepEqual(await session.wait(), { kind: "cancelled" })
  assert.deepEqual(await logout, { kind: "succeeded" })
  assert.equal(logoutCalls, 1)
})

test("login cleanup failure during logout never invokes the quarantined driver again", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let logoutCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => "cleanup-during-logout",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
      async begin({ signal }) {
        return {
          completion: new Promise((resolve) => signal.addEventListener("abort", () => {
            resolve({ kind: "cleanup-failed" })
          }, { once: true })),
        }
      },
      async logout() {
        logoutCalls += 1
        return { kind: "succeeded" }
      },
    },
  })
  await controller.beginLogin()

  assert.equal((await controller.logout()).kind, "confirmation-required")
  assert.deepEqual(await controller.logout(), { kind: "failed" })
  assert.equal(logoutCalls, 0)
  assert.equal((await controller.status()).driver, false)
})

test("logout cleanup failure is public failure and quarantines the driver", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  const controller = createAuthController({
    registry,
    randomUUID: () => "logout-cleanup-failure",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async logout() {
        return { kind: "cleanup-failed" }
      },
    },
  })

  assert.equal((await controller.logout()).kind, "confirmation-required")
  assert.deepEqual(await controller.logout(), { kind: "failed" })
  assert.equal((await controller.status()).driver, false)
  await assert.rejects(controller.beginLogin(), { name: "AuthDriverUnavailableError" })
})

test("shutdown aborts and waits for a confirmed logout", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let logoutSettled = false
  const controller = createAuthController({
    registry,
    randomUUID: () => "shutdown-logout",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async logout({ signal }) {
        return new Promise((resolve) => signal.addEventListener("abort", () => {
          logoutSettled = true
          resolve({ kind: "succeeded" })
        }, { once: true }))
      },
    },
  })
  assert.equal((await controller.logout()).kind, "confirmation-required")

  const logout = controller.logout()
  await Promise.resolve()
  assert.equal(await controller.shutdown(), true)
  assert.equal(logoutSettled, true)
  assert.deepEqual(await logout, { kind: "cancelled" })
})

test("a stale successful logout cannot report success after driver replacement", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let finishStaleLogout
  let replacementLogoutCalls = 0
  let confirmationSequence = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => `stale-logout-${confirmationSequence += 1}`,
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async logout() {
        return new Promise((resolve) => {
          finishStaleLogout = () => resolve({ kind: "succeeded" })
        })
      },
    },
  })
  assert.equal((await controller.logout()).kind, "confirmation-required")
  const staleLogout = controller.logout()
  await Promise.resolve()

  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
    async logout() {
      replacementLogoutCalls += 1
      return { kind: "succeeded" }
    },
  })
  finishStaleLogout()

  assert.deepEqual(await staleLogout, { kind: "failed" })
  assert.equal((await controller.status()).driver, true)
  assert.equal((await controller.logout()).kind, "confirmation-required")
  assert.equal(replacementLogoutCalls, 0)
})

test("logout confirmation never carries across driver replacement", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let sequence = 0
  let replacementLogoutCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => `replacement-confirmation-${sequence += 1}`,
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async logout() {
        return { kind: "succeeded" }
      },
    },
  })
  assert.deepEqual(await controller.logout(), {
    kind: "confirmation-required",
    confirmationId: "replacement-confirmation-1",
    expiresAt: "2030-01-01T00:00:30.000Z",
  })

  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
    async logout() {
      replacementLogoutCalls += 1
      return { kind: "succeeded" }
    },
  })

  assert.deepEqual(await controller.logout(), {
    kind: "confirmation-required",
    confirmationId: "replacement-confirmation-2",
    expiresAt: "2030-01-01T00:00:30.000Z",
  })
  assert.equal(replacementLogoutCalls, 0)
})

test("refresh cleanup failure quarantines until the driver is replaced", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  const controller = createAuthController({
    registry,
    randomUUID: () => "refresh-cleanup-failure",
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async refresh() {
        return { kind: "cleanup-failed" }
      },
    },
  })

  assert.deepEqual(await controller.refresh(), { kind: "failed" })
  assert.equal((await controller.status()).driver, false)
  await assert.rejects(controller.refresh(), { name: "AuthDriverUnavailableError" })

  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
    async refresh() {
      return { kind: "succeeded" }
    },
  })
  assert.deepEqual(await controller.refresh(), { kind: "succeeded" })
})

test("stale refresh cleanup cannot quarantine or overlap a replacement driver", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let finishStaleRefresh
  let replacementRefreshCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => "stale-refresh-cleanup",
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async refresh() {
        return new Promise((resolve) => {
          finishStaleRefresh = () => resolve({ kind: "cleanup-failed" })
        })
      },
    },
  })

  const staleRefresh = controller.refresh()
  await Promise.resolve()
  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
    async refresh() {
      replacementRefreshCalls += 1
      return { kind: "succeeded" }
    },
  })
  await assert.rejects(controller.beginLogin(), { name: "AuthLoginBusyError" })
  finishStaleRefresh()

  assert.deepEqual(await staleRefresh, { kind: "failed" })
  assert.equal((await controller.status()).driver, true)
  assert.deepEqual(await controller.refresh(), { kind: "succeeded" })
  assert.equal(replacementRefreshCalls, 1)
})

test("driver replacement before refresh dispatch prevents the stale CLI action", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let staleRefreshCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => "refresh-before-dispatch",
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async refresh() {
        staleRefreshCalls += 1
        return { kind: "succeeded" }
      },
    },
  })

  const staleRefresh = controller.refresh()
  controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
    async refresh() {
      return { kind: "succeeded" }
    },
  })

  assert.deepEqual(await staleRefresh, { kind: "failed" })
  assert.equal(staleRefreshCalls, 0)
  assert.equal((await controller.status()).driver, true)
})

test("shutdown aborts and waits for an in-flight refresh", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  let refreshSettled = false
  const controller = createAuthController({
    registry,
    randomUUID: () => "shutdown-refresh",
    driver: {
      async begin() {
        return { completion: Promise.resolve({ kind: "succeeded" }) }
      },
      async refresh({ signal }) {
        return new Promise((resolve) => signal.addEventListener("abort", () => {
          refreshSettled = true
          resolve({ kind: "succeeded" })
        }, { once: true }))
      },
    },
  })

  const refresh = controller.refresh()
  await Promise.resolve()
  assert.equal(await controller.shutdown(), true)
  assert.equal(refreshSettled, true)
  assert.deepEqual(await refresh, { kind: "cancelled" })
})

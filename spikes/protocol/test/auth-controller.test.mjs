import assert from "node:assert/strict"
import test from "node:test"

import { createAuthController } from "../../../src/internal/auth-controller.mjs"
import { createAuthRegistry } from "../../../src/internal/auth-registry.mjs"

test("one login session exposes only public state, cancels, and invalidates auth generation", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  registry.install({ id: "official" })
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
  assert.equal(registry.status().generation, 2)
  assert.deepEqual(controller.status().session, {
    state: "cancelled",
    sessionId: "fixture-session-id",
  })
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
              resolve({ kind: "cancelled" })
            }, { once: true })),
          }
        },
    },
  })
  await controller.beginLogin()

  assert.equal(await controller.shutdown(), true)
  assert.equal(completionSettled, true)
  assert.equal(controller.status().session.state, "cancelled")
})

test("logout requires a second same-mode confirmation inside thirty seconds", async () => {
  const registry = createAuthRegistry({
    createTransport: (source) => ({ source }),
  })
  registry.install({ id: "official" })
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
  assert.equal(registry.status().generation, 2)
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

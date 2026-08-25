import assert from "node:assert/strict"
import test from "node:test"

import { createAuthController } from "../../../src/internal/auth-controller.mjs"
import { createAuthRegistry } from "../../../src/internal/auth-registry.mjs"

test("one login session exposes only public state, cancels, and invalidates auth generation", async () => {
  const registry = createAuthRegistry({
    initialMode: "official-cli",
    createTransport: (source) => ({ source }),
  })
  registry.install("official-cli", { id: "official" })
  let finish
  const controller = createAuthController({
    registry,
    randomUUID: () => "fixture-session-id",
    drivers: {
      "official-cli": {
        async begin({ signal }) {
          return {
            completion: new Promise((resolve) => {
              finish = () => resolve(signal.aborted ? { kind: "cancelled" } : { kind: "succeeded" })
            }),
          }
        },
      },
    },
  })

  const session = await controller.beginLogin("official-cli")
  assert.deepEqual(session.public, {
    sessionId: "fixture-session-id",
    mode: "official-cli",
    state: "running",
  })
  assert.equal(JSON.stringify(session).includes("completion"), false)
  await assert.rejects(controller.beginLogin("official-cli"), { name: "AuthLoginBusyError" })

  assert.equal(controller.cancel("official-cli", "stale-session"), false)
  assert.equal(controller.cancel("official-cli", "fixture-session-id"), true)
  finish()
  assert.deepEqual(await session.wait(), { kind: "cancelled" })
  assert.equal(registry.status().generation, 2)
  assert.deepEqual(controller.status().sessions["official-cli"], {
    state: "cancelled",
    sessionId: "fixture-session-id",
  })
})

test("capability shutdown cancels and waits for the active login before returning", async () => {
  const registry = createAuthRegistry({
    initialMode: "official-cli",
    createTransport: (source) => ({ source }),
  })
  let completionSettled = false
  const controller = createAuthController({
    registry,
    randomUUID: () => "shutdown-session",
    drivers: {
      "official-cli": {
        async begin({ signal }) {
          return {
            completion: new Promise((resolve) => signal.addEventListener("abort", () => {
              completionSettled = true
              resolve({ kind: "cancelled" })
            }, { once: true })),
          }
        },
      },
    },
  })
  await controller.beginLogin("official-cli")

  assert.equal(await controller.shutdown("official-cli"), true)
  assert.equal(completionSettled, true)
  assert.equal(controller.status().sessions["official-cli"].state, "cancelled")
})

test("logout requires a second same-mode confirmation inside thirty seconds", async () => {
  const registry = createAuthRegistry({
    initialMode: "official-cli",
    createTransport: (source) => ({ source }),
  })
  registry.install("official-cli", { id: "official" })
  let logoutCalls = 0
  const controller = createAuthController({
    registry,
    randomUUID: () => "fixture-confirmation",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    drivers: {
      "official-cli": {
        async begin() { return { completion: Promise.resolve({ kind: "succeeded" }) } },
        async logout() { logoutCalls += 1; return { kind: "succeeded" } },
      },
    },
  })

  assert.deepEqual(await controller.logout("official-cli"), {
    kind: "confirmation-required",
    confirmationId: "fixture-confirmation",
    expiresAt: "2030-01-01T00:00:30.000Z",
  })
  assert.equal(logoutCalls, 0)
  assert.deepEqual(await controller.logout("official-cli"), { kind: "succeeded" })
  assert.equal(logoutCalls, 1)
  assert.equal(registry.status().generation, 2)
})

test("a running managed session remains recoverable from public status after a Web reload", async () => {
  const registry = createAuthRegistry({
    initialMode: "managed-device",
    createTransport: (source) => ({ source }),
  })
  const controller = createAuthController({
    registry,
    randomUUID: () => "managed-session",
    drivers: {
      "managed-device": {
        async begin() {
          return {
            public: {
              verificationUri: "https://auth.x.ai/oauth2/device/verify",
              verificationUriComplete: "https://auth.x.ai/oauth2/device/verify?user_code=ABCD-EFGH",
              userCode: "ABCD-EFGH",
              expiresAt: "2030-01-01T00:10:00.000Z",
            },
            completion: new Promise(() => {}),
          }
        },
      },
    },
  })

  await controller.beginLogin("managed-device")
  assert.deepEqual(controller.status().sessions["managed-device"], {
    state: "running",
    sessionId: "managed-session",
    verificationUri: "https://auth.x.ai/oauth2/device/verify",
    verificationUriComplete: "https://auth.x.ai/oauth2/device/verify?user_code=ABCD-EFGH",
    userCode: "ABCD-EFGH",
    expiresAt: "2030-01-01T00:10:00.000Z",
  })
})

test("a confirmed logout excludes a new login until credential revocation settles", async () => {
  const registry = createAuthRegistry({
    initialMode: "managed-device",
    createTransport: (source) => ({ source }),
  })
  let finishLogout
  const controller = createAuthController({
    registry,
    randomUUID: () => "operation-id",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    drivers: {
      "managed-device": {
        async begin() { return { completion: Promise.resolve({ kind: "succeeded" }) } },
        async logout() {
          return new Promise((resolve) => { finishLogout = () => resolve({ kind: "succeeded" }) })
        },
      },
    },
  })
  assert.equal((await controller.logout("managed-device")).kind, "confirmation-required")
  const logout = controller.logout("managed-device")

  await assert.rejects(controller.beginLogin("managed-device"), { name: "AuthLoginBusyError" })
  finishLogout()
  assert.deepEqual(await logout, { kind: "succeeded" })
  assert.equal((await controller.beginLogin("managed-device")).public.state, "running")
})

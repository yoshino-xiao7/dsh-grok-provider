import assert from "node:assert/strict"
import test from "node:test"

import { AuthLoginBusyError } from "../../../src/internal/auth-controller.mjs"
import { createAuthRpcHandler } from "../../../src/internal/auth-rpc.mjs"

test("the Web auth RPC accepts only closed payloads and never throws controller failures", async () => {
  const controller = {
    status: () => ({ selectedMode: "official-cli", generation: 2, drivers: {}, sessions: {} }),
    use: () => { throw new Error("fixture secret-like internal detail") },
    beginLogin: async () => ({ public: { sessionId: "s1", mode: "official-cli", state: "running" } }),
    cancel: (mode, sessionId) => mode === "official-cli" && sessionId === "s1",
    logout: async () => ({ kind: "confirmation-required", confirmationId: "c1", expiresAt: "2030-01-01T00:00:30.000Z" }),
  }
  const handler = createAuthRpcHandler({ controller })
  const signal = new AbortController().signal

  assert.deepEqual(await handler("status", {}, signal), {
    ok: true,
    value: { kind: "status", status: controller.status() },
  })
  assert.deepEqual(await handler("login", { authMode: "official-cli" }, signal), {
    ok: true,
    value: {
      kind: "login-started",
      status: { sessionId: "s1", mode: "official-cli", state: "running" },
      sessionId: "s1",
    },
  })
  assert.deepEqual(await handler("cancel", { authMode: "official-cli", sessionId: "s1" }, signal), {
    ok: true,
    value: { kind: "cancelled", status: controller.status() },
  })
  assert.deepEqual(await handler("cancel", { authMode: "official-cli" }, signal), {
    ok: false,
    error: { code: "bad-request", message: "Invalid Grok auth RPC request", details: { issues: [] } },
  })
  assert.deepEqual(await handler("status", { extra: true }, signal), {
    ok: false,
    error: { code: "bad-request", message: "Invalid Grok auth RPC request", details: { issues: [] } },
  })
  assert.deepEqual(await handler("use", { authMode: "managed-device" }, signal), {
    ok: false,
    error: { code: "internal", message: "The Grok auth operation failed", details: {} },
  })
})

test("the Web auth RPC reports login contention as a closed business outcome", async () => {
  const status = { selectedMode: "official-cli", generation: 2, drivers: {}, sessions: {} }
  const handler = createAuthRpcHandler({ controller: {
    status: () => status,
    use() {},
    async beginLogin() { throw new AuthLoginBusyError() },
    cancel: () => false,
    async logout() { return { kind: "failed" } },
  } })

  assert.deepEqual(await handler("login", { authMode: "official-cli" }, new AbortController().signal), {
    ok: true,
    value: { kind: "busy", status },
  })
})

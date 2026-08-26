import assert from "node:assert/strict"
import test from "node:test"

import { AuthLoginBusyError } from "../../../src/internal/auth-controller.mjs"
import { createAuthRpcHandler } from "../../../src/internal/auth-rpc.mjs"

test("the Web auth RPC accepts only closed payloads and never throws controller failures", async () => {
  const controller = {
    status: () => ({ generation: 2, available: true, driver: true }),
    beginLogin: async () => ({ public: { sessionId: "s1", state: "running" } }),
    cancel: (sessionId) => sessionId === "s1",
    logout: async () => ({ kind: "confirmation-required", confirmationId: "c1", expiresAt: "2030-01-01T00:00:30.000Z" }),
  }
  const handler = createAuthRpcHandler({ controller })
  const signal = new AbortController().signal

  assert.deepEqual(await handler("status", {}, signal), {
    ok: true,
    value: { kind: "status", status: await controller.status() },
  })
  assert.deepEqual(await handler("login", {}, signal), {
    ok: true,
    value: {
      kind: "login-started",
      status: { sessionId: "s1", state: "running" },
      sessionId: "s1",
    },
  })
  assert.deepEqual(await handler("cancel", { sessionId: "s1" }, signal), {
    ok: true,
    value: { kind: "cancelled", status: await controller.status() },
  })
  assert.deepEqual(await handler("cancel", {}, signal), {
    ok: false,
    error: { code: "bad-request", message: "Invalid Grok auth RPC request", details: { issues: [] } },
  })
  assert.deepEqual(await handler("status", { extra: true }, signal), {
    ok: false,
    error: { code: "bad-request", message: "Invalid Grok auth RPC request", details: { issues: [] } },
  })
  assert.deepEqual(await handler("use", { authMode: "managed-device" }, signal), {
    ok: false,
    error: { code: "bad-request", message: "Invalid Grok auth RPC request", details: { issues: [] } },
  })
})

test("the Web auth RPC reports login contention as a closed business outcome", async () => {
  const status = { generation: 2, available: true, driver: true }
  const handler = createAuthRpcHandler({ controller: {
    status: () => status,
    async beginLogin() { throw new AuthLoginBusyError() },
    cancel: () => false,
    async logout() { return { kind: "failed" } },
  } })

  assert.deepEqual(await handler("login", {}, new AbortController().signal), {
    ok: true,
    value: { kind: "busy", status },
  })
})

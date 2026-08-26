import assert from "node:assert/strict"
import test from "node:test"

import { createGrokCommandHandler } from "../../../src/internal/grok-command-handler.mjs"

test("the TUI handler routes closed commands without exposing internal state", async () => {
  const calls = []
  const controller = {
    status() {
      return {
        generation: 4,
        available: true,
        driver: true,
        session: { state: "running", sessionId: "fixture" },
      }
    },
    async beginLogin() {
      calls.push(["login"])
      return { public: { sessionId: "fixture", state: "running" }, wait: async () => ({ kind: "succeeded" }) }
    },
    cancel(sessionId) { calls.push(["cancel", sessionId]); return true },
    async logout() { calls.push(["logout"]); return { kind: "confirmation-required" } },
  }
  const handler = createGrokCommandHandler({ controller })

  assert.deepEqual(await handler({ rawInput: " status", signal: new AbortController().signal }), {
    kind: "success",
    text: "Grok official CLI auth: running",
  })
  assert.deepEqual(await handler({ rawInput: " login", signal: new AbortController().signal }), {
    kind: "success",
    text: "Grok official CLI login succeeded",
  })
  assert.deepEqual(await handler({ rawInput: " cancel", signal: new AbortController().signal }), {
    kind: "success",
    text: "Grok login cancellation requested",
  })
  assert.deepEqual(await handler({ rawInput: " status extra", signal: new AbortController().signal }), {
    kind: "error",
    text: "Usage: /grok status|login|cancel|logout",
  })
  assert.deepEqual(await handler({ rawInput: " logout", signal: new AbortController().signal }), {
    kind: "success",
    text: "Repeat /grok logout within 30 seconds to confirm",
  })
  assert.deepEqual(calls, [
    ["login"],
    ["cancel", "fixture"],
    ["logout"],
  ])
})

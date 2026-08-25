import assert from "node:assert/strict"
import test from "node:test"

import { createGrokCommandHandler } from "../../../src/internal/grok-command-handler.mjs"

test("the TUI handler routes closed commands without exposing internal state", async () => {
  const calls = []
  const controller = {
    status() {
      return {
        selectedMode: "official-cli",
        generation: 4,
        drivers: { "official-cli": true, "managed-device": false },
        sessions: { "official-cli": { state: "running", sessionId: "fixture" } },
      }
    },
    use(mode) { calls.push(["use", mode]) },
    async beginLogin(mode) {
      calls.push(["login", mode])
      return { public: { sessionId: "fixture", mode, state: "running" }, wait: async () => ({ kind: "succeeded" }) }
    },
    cancel(mode, sessionId) { calls.push(["cancel", mode, sessionId]); return true },
  }
  const handler = createGrokCommandHandler({ controller })

  assert.deepEqual(await handler({ rawInput: " status", signal: new AbortController().signal }), {
    kind: "success",
    text: "Grok auth: official-cli; official-cli=running; managed-device=unavailable",
  })
  assert.deepEqual(await handler({ rawInput: " use managed-device", signal: new AbortController().signal }), {
    kind: "success",
    text: "Grok auth mode selected: managed-device",
  })
  assert.deepEqual(await handler({ rawInput: " login official-cli", signal: new AbortController().signal }), {
    kind: "success",
    text: "Grok official-cli login succeeded",
  })
  assert.deepEqual(await handler({ rawInput: " cancel", signal: new AbortController().signal }), {
    kind: "success",
    text: "Grok login cancellation requested",
  })
  assert.deepEqual(await handler({ rawInput: " status extra", signal: new AbortController().signal }), {
    kind: "error",
    text: "Usage: /grok status|use <mode>|login [mode]|cancel|logout <mode>",
  })
  assert.deepEqual(calls, [
    ["use", "managed-device"],
    ["login", "official-cli"],
    ["cancel", "official-cli", "fixture"],
  ])
})

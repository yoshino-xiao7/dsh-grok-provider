import assert from "node:assert/strict"
import test from "node:test"

import { createAccountDashboard } from "../../../src/internal/account-dashboard.mjs"

test("dashboard projects safe dynamic model capabilities and billing independently", async () => {
  const dashboard = createAccountDashboard({
    listModels: async () => [{
      provider: "grok", id: "grok-fixture", name: "Grok Fixture", description: "Fixture",
      inputModalities: ["text"], context: { contextWindow: 500000 },
      reasoning: { efforts: [{ id: "high", name: "High" }], defaultEffort: "high" },
    }],
    getBilling: async () => '{"config":{"creditUsagePercent":20}}',
    now: () => new Date("2030-01-01T00:00:00Z"),
  })

  assert.deepEqual(await dashboard(), {
    fetchedAt: "2030-01-01T00:00:00.000Z",
    models: { state: "ready", items: [{
      id: "grok-fixture", name: "Grok Fixture", description: "Fixture", contextWindow: 500000,
      reasoning: { efforts: [{ id: "high", name: "High" }], defaultEffort: "high" },
      capabilities: { textInput: true, streaming: true, functionTools: true },
    }] },
    quota: { state: "ready", usedPercent: 20, remainingPercent: 80 },
  })
})

test("dashboard isolates model and quota failures into closed unavailable states", async () => {
  const dashboard = createAccountDashboard({
    listModels: async () => { throw new Error("model secret") },
    getBilling: async () => { throw new Error("billing secret") },
    now: () => new Date("2030-01-01T00:00:00Z"),
  })
  assert.deepEqual(await dashboard(), {
    fetchedAt: "2030-01-01T00:00:00.000Z",
    models: { state: "unavailable", items: [] },
    quota: { state: "unavailable" },
  })
})

test("invalid model projection cannot suppress a valid quota summary", async () => {
  const dashboard = createAccountDashboard({
    listModels: () => [{ id: "invalid-model" }],
    getBilling: () => '{"config":{"creditUsagePercent":40}}',
    now: () => new Date("2030-01-01T00:00:00Z"),
  })
  assert.deepEqual(await dashboard(), {
    fetchedAt: "2030-01-01T00:00:00.000Z",
    models: { state: "unavailable", items: [] },
    quota: { state: "ready", usedPercent: 40, remainingPercent: 60 },
  })
})

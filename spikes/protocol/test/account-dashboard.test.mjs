import assert from "node:assert/strict"
import test from "node:test"

import { createAccountDashboard } from "../../../src/internal/account-dashboard.mjs"

test("dashboard projects safe dynamic model capabilities and billing independently", async () => {
  const dashboard = createAccountDashboard({
    listModels: async () => [
      {
        provider: "grok", id: "grok-4.6", name: "Grok 4.6", description: "Fixture",
        inputModalities: ["text", "image"], context: { contextWindow: 500000 },
        reasoning: { efforts: [{ id: "high", name: "High" }], defaultEffort: "high" },
      },
      {
        provider: "grok", id: "grok-text", name: "Grok Text",
        inputModalities: ["text"], context: { contextWindow: 128000 },
      },
    ],
    getBilling: async () => '{"config":{"creditUsagePercent":20}}',
    now: () => new Date("2030-01-01T00:00:00Z"),
  })

  assert.deepEqual(await dashboard(), {
    fetchedAt: "2030-01-01T00:00:00.000Z",
    models: { state: "ready", items: [
      {
        id: "grok-4.6", name: "Grok 4.6", description: "Fixture", contextWindow: 500000,
        reasoning: { efforts: [{ id: "high", name: "High" }], defaultEffort: "high" },
        capabilities: { textInput: true, imageInput: true, streaming: true, functionTools: true },
      },
      {
        id: "grok-text", name: "Grok Text", contextWindow: 128000,
        capabilities: { textInput: true, imageInput: false, streaming: true, functionTools: true },
      },
    ] },
    quota: { state: "ready", usedPercent: 20, remainingPercent: 80 },
  })
})

test("dashboard fails closed for unknown or malformed model input modalities", async (context) => {
  const accessorModalities = ["text"]
  Object.defineProperty(accessorModalities, "0", { get() { throw new Error("must not read") } })
  const cases = [
    ["missing", undefined],
    ["empty", []],
    ["unknown", ["text", "audio"]],
    ["duplicate", ["text", "text"]],
    ["accessor", accessorModalities],
  ]

  for (const [name, inputModalities] of cases) {
    await context.test(name, async () => {
      const dashboard = createAccountDashboard({
        listModels: () => [{
          id: "grok-invalid",
          name: "Grok Invalid",
          inputModalities,
          context: { contextWindow: 128000 },
        }],
        getBilling: () => '{"config":{"creditUsagePercent":40}}',
        now: () => new Date("2030-01-01T00:00:00Z"),
      })

      assert.deepEqual(await dashboard(), {
        fetchedAt: "2030-01-01T00:00:00.000Z",
        models: { state: "unavailable", items: [] },
        quota: { state: "ready", usedPercent: 40, remainingPercent: 60 },
      })
    })
  }
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

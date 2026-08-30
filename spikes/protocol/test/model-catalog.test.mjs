import assert from "node:assert/strict"
import test from "node:test"

import { parseModelCatalogResponse } from "../../../src/internal/model-catalog.mjs"

test("every valid model in a Grok catalog response is mapped with its declared capabilities", () => {
  const response = JSON.stringify({
    object: "list",
    data: [
      {
        id: "fixture-frontier",
        object: "model",
        owned_by: "xai",
        model: "fixture-frontier",
        model_family: "fixture",
        name: "Fixture Frontier",
        description: "Fixture model for protocol tests",
        context_window: 500_000,
        api_backend: "responses",
        reasoning_effort: "high",
        supports_reasoning_effort: true,
        reasoning_efforts: [
          { id: "xhigh", value: "xhigh", label: "Extra High", default: false },
          { id: "high", value: "high", label: "High", default: true },
          { id: "low", value: "low", label: "Low", default: false },
        ],
      },
      {
        id: "fixture-fast",
        object: "model",
        owned_by: "xai",
        model: "fixture-fast",
        model_family: "fixture",
        name: "Fixture Fast",
        context_window: 128_000,
        api_backend: "responses",
        reasoning_effort: "medium",
        supports_reasoning_effort: true,
        reasoning_efforts: [
          { id: "medium", value: "medium", label: "Medium", default: true },
          { id: "low", value: "low", label: "Low", default: false },
        ],
      },
    ],
  })

  const catalog = parseModelCatalogResponse(response, { provider: "grok" })

  assert.deepEqual(catalog.map((entry) => entry.resolvedModelInfo.id), [
    "fixture-frontier",
    "fixture-fast",
  ])
  assert.deepEqual(catalog[0], {
    backend: "responses",
    resolvedModelInfo: {
      provider: "grok",
      id: "fixture-frontier",
      name: "Fixture Frontier",
      description: "Fixture model for protocol tests",
      inputModalities: ["text"],
      context: { contextWindow: 500_000 },
      reasoning: {
        efforts: [
          { id: "xhigh", name: "Extra High" },
          { id: "high", name: "High" },
          { id: "low", name: "Low" },
        ],
        defaultEffort: "high",
      },
    },
  })
  assert.equal(catalog[1].resolvedModelInfo.context.contextWindow, 128_000)
  assert.equal(catalog[1].resolvedModelInfo.reasoning.defaultEffort, "medium")
})

test("only the exact verified Grok model receives private image and Search routes", () => {
  const model = (id) => ({
    id,
    name: id,
    context_window: 500_000,
    api_backend: "responses",
    supports_reasoning_effort: false,
  })
  const catalog = parseModelCatalogResponse(JSON.stringify({
    object: "list",
    data: [model("grok-4.6"), model("grok-4.5"), model("grok-future")],
  }), { provider: "grok" })

  assert.deepEqual(catalog[0].resolvedModelInfo.inputModalities, ["text", "image"])
  assert.deepEqual(catalog[1].resolvedModelInfo.inputModalities, ["text"])
  assert.deepEqual(catalog[2].resolvedModelInfo.inputModalities, ["text"])
  assert.deepEqual(catalog[0].imageInput, {
    readPolicy: { maxBytes: 4 * 1024 * 1024, maxPixels: 16 * 1024 * 1024 },
    maxDimension: 8192,
    maxImages: 8,
    maxTotalBytes: 8 * 1024 * 1024,
    mediaTypes: ["image/jpeg", "image/png"],
  })
  assert.equal(catalog[1].imageInput, undefined)
  assert.equal(catalog[2].imageInput, undefined)
  assert.deepEqual(catalog[0].serverTools, ["web_search", "x_search"])
  assert.equal(Object.isFrozen(catalog[0].serverTools), true)
  assert.equal(catalog[1].serverTools, undefined)
  assert.equal(catalog[2].serverTools, undefined)
})

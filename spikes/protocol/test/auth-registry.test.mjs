import assert from "node:assert/strict"
import test from "node:test"

import { createAuthRegistry } from "../../../src/internal/auth-registry.mjs"

test("auth selection advances generation and never falls back across modes", () => {
  const created = []
  const registry = createAuthRegistry({
    initialMode: "official-cli",
    createTransport: (source) => {
      const transport = { source }
      created.push(transport)
      return transport
    },
  })
  const official = { id: "official-source" }
  const managed = { id: "managed-source" }

  const removeOfficial = registry.install("official-cli", official)
  registry.install("managed-device", managed)
  assert.equal(registry.getGeneration().transport.source, official)
  assert.deepEqual(registry.status(), {
    selectedMode: "official-cli",
    generation: 2,
    available: { "official-cli": true, "managed-device": true },
  })

  registry.select("managed-device")
  assert.equal(registry.getGeneration().transport.source, managed)
  assert.equal(registry.status().generation, 3)

  removeOfficial()
  registry.select("official-cli")
  assert.throws(() => registry.getGeneration(), { name: "AuthModeUnavailableError" })
  assert.equal(registry.status().generation, 5)

  registry.invalidate()
  assert.equal(registry.status().generation, 6)
})

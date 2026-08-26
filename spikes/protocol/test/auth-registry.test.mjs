import assert from "node:assert/strict"
import test from "node:test"

import { createAuthRegistry } from "../../../src/internal/auth-registry.mjs"

test("the official credential source is the only transport generation", () => {
  const created = []
  const registry = createAuthRegistry({
    createTransport: (source) => {
      const transport = { source }
      created.push(transport)
      return transport
    },
  })
  const official = { id: "official-source" }

  const removeOfficial = registry.install(official)
  assert.equal(registry.getGeneration().transport.source, official)
  assert.deepEqual(registry.status(), {
    generation: 1,
    available: true,
  })

  removeOfficial()
  assert.throws(() => registry.getGeneration(), { name: "AuthModeUnavailableError" })
  assert.equal(registry.status().generation, 2)

  registry.invalidate()
  assert.equal(registry.status().generation, 3)
})

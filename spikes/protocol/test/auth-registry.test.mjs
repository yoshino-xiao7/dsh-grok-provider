import assert from "node:assert/strict"
import test from "node:test"

import { createAuthRegistry } from "../../../src/internal/auth-registry.mjs"

test("the official credential source is the only transport generation", async () => {
  const created = []
  const registry = createAuthRegistry({
    createTransport: (source) => {
      const transport = { source }
      created.push(transport)
      return transport
    },
  })
  const official = {
    id: "official-source",
    async withAccessToken(operation) { return operation("fixture-token") },
  }

  const removeOfficial = registry.install(official)
  assert.equal(registry.getGeneration().transport.source, official)
  assert.deepEqual(await registry.status(), {
    generation: 1,
    available: true,
  })

  removeOfficial()
  assert.throws(() => registry.getGeneration(), { name: "AuthModeUnavailableError" })
  assert.equal((await registry.status()).generation, 2)

  registry.invalidate()
  assert.equal((await registry.status()).generation, 3)
})

test("an installed source without a valid credential is never advertised as available", async () => {
  const registry = createAuthRegistry({ createTransport: (source) => ({ source }) })
  registry.install({
    async withAccessToken() { throw new Error("fixture credential missing") },
  })

  assert.deepEqual(await registry.status(), {
    generation: 1,
    available: false,
  })
})

import assert from "node:assert/strict"
import test from "node:test"

import { installProviderRuntime } from "../../../src/internal/provider-runtime.mjs"

test("provider runtime registers one Grok adapter and its configurable directory", () => {
  const calls = []
  const officialSource = { id: "official" }
  const adapter = { providerInfo: () => ({ id: "grok", name: "Grok Build" }) }
  const llm = {
    registerAdapter(providers, value) {
      calls.push({ kind: "adapter", providers, value })
      return () => calls.push({ kind: "dispose-adapter" })
    },
    registerConfigurableProviders(entries) {
      calls.push({ kind: "directory", entries })
      return () => calls.push({ kind: "dispose-directory" })
    },
  }
  const runtime = installProviderRuntime({
    llm,
    officialSource,
    createTransport: (source) => ({ source }),
    createAdapter: ({ getGeneration }) => {
      assert.equal(getGeneration().transport.source, officialSource)
      return adapter
    },
  })

  assert.equal(calls[0].kind, "adapter")
  assert.deepEqual(calls[0].providers, ["grok"])
  assert.equal(calls[0].value, adapter)
  assert.deepEqual(calls[1], {
    kind: "directory",
    entries: [{
      provider: "grok",
      displayName: "Grok Build",
      settingsNs: "llm-grok",
      settingsPath: [],
    }],
  })

  runtime.dispose()
  assert.deepEqual(calls.slice(2), [{ kind: "dispose-directory" }, { kind: "dispose-adapter" }])
})

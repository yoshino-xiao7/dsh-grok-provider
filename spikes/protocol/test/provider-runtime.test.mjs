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

  assert.equal(runtime.adapter, adapter)
  assert.equal(runtime.auth.getGeneration().transport.source, officialSource)
  assert.equal(Object.isFrozen(runtime), true)
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
  assert.throws(() => runtime.auth.getGeneration(), { name: "AuthModeUnavailableError" })

  runtime.dispose()
  assert.deepEqual(calls.slice(2), [{ kind: "dispose-directory" }, { kind: "dispose-adapter" }])
})

test("provider runtime stops before adapter creation when official source installation fails", () => {
  const failure = new Error("official source installation failed")
  let adapterCreations = 0
  let registrations = 0

  assert.throws(() => installProviderRuntime({
    llm: {
      registerAdapter() {
        registrations += 1
        return () => {}
      },
      registerConfigurableProviders() {
        registrations += 1
        return () => {}
      },
    },
    officialSource: { id: "official" },
    createTransport() {
      throw failure
    },
    createAdapter() {
      adapterCreations += 1
      return { id: "adapter" }
    },
  }), failure)

  assert.equal(adapterCreations, 0)
  assert.equal(registrations, 0)
})

test("provider runtime rolls back the official source when adapter creation fails", () => {
  const failure = new Error("adapter creation failed")
  let getGeneration

  assert.throws(() => installProviderRuntime({
    llm: {
      registerAdapter() {
        throw new Error("adapter registration must not start")
      },
      registerConfigurableProviders() {
        throw new Error("directory registration must not start")
      },
    },
    officialSource: { id: "official" },
    createTransport: (source) => ({ source }),
    createAdapter(options) {
      getGeneration = options.getGeneration
      assert.equal(getGeneration().transport.source.id, "official")
      throw failure
    },
  }), failure)

  assert.throws(() => getGeneration(), { name: "AuthModeUnavailableError" })
})

test("provider runtime rolls back the official source when adapter registration fails", () => {
  const failure = new Error("adapter registration failed")
  let directoryRegistrations = 0
  let getGeneration

  assert.throws(() => installProviderRuntime({
    llm: {
      registerAdapter() {
        throw failure
      },
      registerConfigurableProviders() {
        directoryRegistrations += 1
        return () => {}
      },
    },
    officialSource: { id: "official" },
    createTransport: (source) => ({ source }),
    createAdapter(options) {
      getGeneration = options.getGeneration
      return { id: "adapter" }
    },
  }), failure)

  assert.equal(directoryRegistrations, 0)
  assert.throws(() => getGeneration(), { name: "AuthModeUnavailableError" })
})

test("provider runtime rolls back adapter then official source when directory registration fails", () => {
  const failure = new Error("directory registration failed")
  const calls = []
  let getGeneration

  assert.throws(() => installProviderRuntime({
    llm: {
      registerAdapter() {
        calls.push("register-adapter")
        return () => {
          calls.push("dispose-adapter")
          assert.doesNotThrow(() => getGeneration())
        }
      },
      registerConfigurableProviders() {
        calls.push("register-directory")
        throw failure
      },
    },
    officialSource: { id: "official" },
    createTransport: (source) => ({ source }),
    createAdapter(options) {
      getGeneration = options.getGeneration
      return { id: "adapter" }
    },
  }), failure)

  assert.deepEqual(calls, ["register-adapter", "register-directory", "dispose-adapter"])
  assert.throws(() => getGeneration(), { name: "AuthModeUnavailableError" })
})

test("provider runtime dispose continues reverse cleanup after a disposer fails and remains idempotent", () => {
  const failure = new Error("directory disposal failed")
  const calls = []
  let getGeneration
  const runtime = installProviderRuntime({
    llm: {
      registerAdapter() {
        return () => {
          calls.push("dispose-adapter")
          assert.doesNotThrow(() => getGeneration())
        }
      },
      registerConfigurableProviders() {
        return () => {
          calls.push("dispose-directory")
          throw failure
        }
      },
    },
    officialSource: { id: "official" },
    createTransport: (source) => ({ source }),
    createAdapter(options) {
      getGeneration = options.getGeneration
      return { id: "adapter" }
    },
  })

  assert.throws(() => runtime.dispose(), failure)
  assert.deepEqual(calls, ["dispose-directory", "dispose-adapter"])
  assert.throws(() => getGeneration(), { name: "AuthModeUnavailableError" })

  runtime.dispose()
  assert.deepEqual(calls, ["dispose-directory", "dispose-adapter"])
})

test("provider runtime rollback keeps cleaning and reports setup plus disposer failures", () => {
  const setupFailure = new Error("directory registration failed")
  const disposalFailure = new Error("adapter disposal failed")
  const calls = []
  let getGeneration
  let thrown

  try {
    installProviderRuntime({
      llm: {
        registerAdapter() {
          return () => {
            calls.push("dispose-adapter")
            throw disposalFailure
          }
        },
        registerConfigurableProviders() {
          throw setupFailure
        },
      },
      officialSource: { id: "official" },
      createTransport: (source) => ({ source }),
      createAdapter(options) {
        getGeneration = options.getGeneration
        return { id: "adapter" }
      },
    })
  } catch (error) {
    thrown = error
  }

  assert.ok(thrown instanceof AggregateError)
  assert.deepEqual(thrown.errors, [setupFailure, disposalFailure])
  assert.deepEqual(calls, ["dispose-adapter"])
  assert.throws(() => getGeneration(), { name: "AuthModeUnavailableError" })
})

test("provider runtime dispose aggregates disposer failures after attempting every cleanup", () => {
  const directoryFailure = new Error("directory disposal failed")
  const adapterFailure = new Error("adapter disposal failed")
  const calls = []
  let getGeneration
  const runtime = installProviderRuntime({
    llm: {
      registerAdapter() {
        return () => {
          calls.push("dispose-adapter")
          throw adapterFailure
        }
      },
      registerConfigurableProviders() {
        return () => {
          calls.push("dispose-directory")
          throw directoryFailure
        }
      },
    },
    officialSource: { id: "official" },
    createTransport: (source) => ({ source }),
    createAdapter(options) {
      getGeneration = options.getGeneration
      return { id: "adapter" }
    },
  })

  assert.throws(() => runtime.dispose(), (error) => {
    assert.ok(error instanceof AggregateError)
    assert.deepEqual(error.errors, [directoryFailure, adapterFailure])
    return true
  })
  assert.deepEqual(calls, ["dispose-directory", "dispose-adapter"])
  assert.throws(() => getGeneration(), { name: "AuthModeUnavailableError" })
})

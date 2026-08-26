import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import vm from "node:vm"

const root = path.resolve(import.meta.dirname, "..")

test("the browser bundle registers one localized loopback-only Grok settings section", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
  assert.deepEqual(packageJson.exports["./client"], { default: "./dist/client/client.js" })
  assert.deepEqual(packageJson.dsh.client, {
    inject: [
      "@deepseek-ai/dsh-client-connection",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-runtime",
      "@deepseek-ai/dsh-client-ui-settings",
    ],
    platform: "web",
  })
  assert.equal(packageJson.dsh.bundle.patch, "grok-provider.patch.yml")
  assert.equal(await fs.readFile(path.join(root, "grok-provider.patch.yml"), "utf8"), [
    "- insert:",
    "    - id: llm-grok",
    "      name: dsh-grok-provider-yukiryou",
    "",
  ].join("\n"))

  let definition
  const source = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  assert.doesNotMatch(source, /managed-device|authMode|verificationUri|deviceCode/u)
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { definition = value } } },
    document: {
      head: { appendChild() {} },
      createElement: () => ({ dataset: {}, textContent: "" }),
      querySelector: () => null,
    },
  })
  assert.equal(definition.id, "dsh-grok-provider-yukiryou")

  const React = {
    createElement() {},
    useCallback() {},
    useEffect() {},
    useMemo() {},
    useState() {},
  }
  const plugin = definition.factory((id) => {
    assert.equal(id, "react")
    return React
  })
  assert.deepEqual(Array.from(plugin.inject), ["slots", "locale", "connection"])

  const registrations = []
  const dictionaries = []
  const ctx = {
    connection: { isLoopback: true, rpc: { call() {} } },
    effect(callback) { callback() },
    locale: {
      bind: () => (key) => key,
      register(namespace, value) { dictionaries.push({ namespace, value }) },
    },
    slots: {
      inject(name, callback) {
        assert.equal(name, "settings.section")
        callback()
      },
      register(options, component) { registrations.push({ options, component }) },
    },
  }
  plugin.apply(ctx)

  assert.equal(dictionaries[0].namespace, "settings.grok")
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].options.name, "settings.section")
  assert.equal(registrations[0].options.id, "grok-auth")
  assert.equal(typeof registrations[0].component, "function")
})

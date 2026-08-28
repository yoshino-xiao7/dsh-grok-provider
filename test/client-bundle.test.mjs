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
    "      name: dsh-grok-provider",
    "",
  ].join("\n"))

  let definition
  const source = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  assert.doesNotMatch(source, /managed-device|authMode|verificationUri|deviceCode/u)
  assert.match(source, /使用额度/u)
  assert.match(source, /当前账号可用的模型/u)
  assert.match(source, /call\("dashboard"\)/u)
  assert.doesNotMatch(source, /userId|user_id|subscriptionTier|prepaidBalance/u)
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { definition = value } } },
    document: {
      head: { appendChild() {} },
      createElement: () => ({ dataset: {}, textContent: "" }),
      querySelector: () => null,
    },
  })
  assert.equal(definition.id, "dsh-grok-provider")

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
  assert.equal(dictionaries[0].value.zh.image, "图片输入")
  assert.equal(dictionaries[0].value.en.image, "Image input")
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].options.name, "settings.section")
  assert.equal(registrations[0].options.id, "grok-auth")
  assert.equal(typeof registrations[0].component, "function")
})

test("the model grid renders an image badge only for image-capable models", async () => {
  let definition
  const source = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  const states = [
    { available: true, driver: true },
    {
      models: {
        state: "ready",
        items: [
          {
            id: "grok-4.6",
            name: "Grok 4.6",
            contextWindow: 500000,
            capabilities: { textInput: true, imageInput: true, streaming: true, functionTools: true },
          },
          {
            id: "grok-text",
            name: "Grok Text",
            contextWindow: 128000,
            capabilities: { textInput: true, imageInput: false, streaming: true, functionTools: true },
          },
        ],
      },
      quota: { state: "unavailable" },
    },
    false,
    false,
    false,
    false,
  ]
  let stateIndex = 0
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children } },
    useCallback(callback) { return callback },
    useEffect() {},
    useMemo(factory) { return factory() },
    useState(initial) {
      const value = stateIndex < states.length ? states[stateIndex] : initial
      stateIndex += 1
      return [value, () => {}]
    },
  }
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { definition = value } } },
    document: {
      head: { appendChild() {} },
      createElement: () => ({ dataset: {}, textContent: "" }),
      querySelector: () => null,
    },
  })
  const plugin = definition.factory(() => React)
  const registrations = []
  plugin.apply({
    connection: { isLoopback: true, rpc: { call() {} } },
    effect(callback) { callback() },
    locale: { bind: () => (key) => key, register() {} },
    slots: {
      inject(_name, callback) { callback() },
      register(_options, component) { registrations.push(component) },
    },
  })

  const tree = registrations[0]({
    connection: { isLoopback: true, rpc: { call() {} } },
    t: (key) => key,
  })
  const cards = findElements(tree, (node) => node.props.className === "dsh-grok-model")
  assert.equal(cards.length, 2)
  const badges = (card) => findElements(
    card,
    (node) => node.props.className === "dsh-grok-badge",
  ).map(textContent)
  assert.equal(badges(cards[0]).includes("image"), true)
  assert.equal(badges(cards[1]).includes("image"), false)
})

function findElements(value, predicate) {
  if (Array.isArray(value)) return value.flatMap((item) => findElements(item, predicate))
  if (value === null || typeof value !== "object") return []
  return [
    ...(predicate(value) ? [value] : []),
    ...findElements(value.children, predicate),
  ]
}

function textContent(value) {
  if (Array.isArray(value)) return value.map(textContent).join("")
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (value === null || typeof value !== "object") return ""
  return textContent(value.children)
}

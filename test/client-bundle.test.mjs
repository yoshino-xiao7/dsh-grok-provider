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

test("the browser bundle replaces only the Grok settings nav gear and cleans up on unload", async () => {
  let definition
  const source = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  const createButton = (initialText, { validStructure = true } = {}) => {
    const attributes = new Set()
    const label = validStructure ? { localName: "span", textContent: initialText } : undefined
    const icon = validStructure ? { localName: "svg", nextElementSibling: label } : undefined
    return {
      get textContent() { return label?.textContent ?? initialText },
      set textContent(value) {
        initialText = value
        if (label) label.textContent = value
      },
      firstElementChild: icon,
      hasAttribute(name) { return attributes.has(name) },
      removeAttribute(name) { attributes.delete(name) },
      setAttribute(name) { attributes.add(name) },
    }
  }
  const grokButton = createButton("Grok Build")
  const themeButton = createButton("Theme / 外观")
  const nearMatchButton = createButton("Grok Builder")
  const malformedButton = createButton("Grok Build", { validStructure: false })
  const duplicateButton = createButton("Other")
  const buttons = [grokButton, themeButton, nearMatchButton, malformedButton, duplicateButton]
  const styles = []
  let navScanCount = 0
  let settingsOpen = false
  const document = {
    body: {},
    head: {
      appendChild(node) {
        node.parentNode = this
        styles.push(node)
      },
      removeChild(node) {
        const index = styles.indexOf(node)
        if (index !== -1) styles.splice(index, 1)
        node.parentNode = null
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "style")
      return {
        dataset: {},
        textContent: "",
        parentNode: null,
        remove() { this.parentNode?.removeChild(this) },
      }
    },
    querySelector(selector) {
      if (selector === 'style[data-plugin-css="dsh-grok-provider"]') {
        return styles.find((style) => style.dataset.pluginCss === "dsh-grok-provider") ?? null
      }
      if (selector === 'style[data-plugin-nav-icon="dsh-grok-provider"]') {
        return styles.find((style) => style.dataset.pluginNavIcon === "dsh-grok-provider") ?? null
      }
      return null
    },
    querySelectorAll(selector) {
      if (selector === '[role="dialog"][aria-modal="true"] > nav button') {
        navScanCount += 1
        return settingsOpen ? buttons : []
      }
      if (selector === "[data-dsh-grok-provider-nav-icon]") {
        return buttons.filter((button) => button.hasAttribute("data-dsh-grok-provider-nav-icon"))
      }
      return []
    },
  }
  const observers = []
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback
      this.disconnected = false
      this.observed = undefined
      observers.push(this)
    }

    disconnect() { this.disconnected = true }
    observe(target, options) { this.observed = { target, options } }
  }
  const fakeWindow = {
    __ModuleLoader__: { load(value) { definition = value } },
    MutationObserver: FakeMutationObserver,
  }
  vm.runInNewContext(source, { document, window: fakeWindow })

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
  const applyPlugin = () => {
    const effects = []
    plugin.apply({
      connection: { isLoopback: true, rpc: { call() {} } },
      effect(callback, label) {
        effects.push({ cleanup: callback(), label })
      },
      locale: {
        bind: () => (key) => key === "nav" ? "Grok Build" : key,
        register() { return () => {} },
      },
      slots: {
        inject(_name, callback) { callback() },
        register() { return () => {} },
      },
    })
    return effects
  }

  const firstEffects = applyPlugin()
  assert.equal(grokButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  assert.equal(nearMatchButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  assert.equal(malformedButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  assert.equal(observers.length, 1)
  assert.equal(observers[0].observed.target, document.body)
  assert.equal(observers[0].observed.options.childList, true)
  assert.equal(observers[0].observed.options.subtree, true)
  assert.equal(observers[0].observed.options.characterData, true)
  const navStyle = styles.find((style) => style.dataset.pluginNavIcon === "dsh-grok-provider")
  assert.ok(navStyle)
  assert.equal(navStyle.dataset.plugin, "dsh-grok-provider")
  assert.match(navStyle.textContent, /data-dsh-grok-provider-nav-icon/u)
  assert.match(navStyle.textContent, />svg:first-child\{display:none!important\}/u)
  assert.match(decodeURIComponent(navStyle.textContent), /M8\.00192 6\.64454/u)
  assert.match(navStyle.textContent, /-webkit-mask:/u)
  assert.match(navStyle.textContent, /[;{]mask:/u)
  for (const style of styles) {
    if (style.dataset.plugin === undefined) style.dataset.plugin = "unrelated-plugin"
  }
  for (const style of [...styles]) {
    if (style.dataset.plugin === "unrelated-plugin") style.remove()
  }
  assert.equal(styles.includes(navStyle), true, "unrelated plugin HMR cannot claim or remove the nav style")

  const overlay = {
    matches: () => false,
    querySelector: (selector) => selector === '[role="dialog"][aria-modal="true"]' ? {} : null,
  }
  settingsOpen = true
  observers[0].callback([{
    addedNodes: [overlay],
    removedNodes: [],
    target: { nodeType: 1, closest: () => null },
  }])
  await Promise.resolve()
  assert.equal(grokButton.hasAttribute("data-dsh-grok-provider-nav-icon"), true)

  const scansBeforeUnrelatedMutation = navScanCount
  observers[0].callback([{
    addedNodes: [],
    removedNodes: [],
    target: { nodeType: 1, closest: () => null },
  }])
  await Promise.resolve()
  assert.equal(navScanCount, scansBeforeUnrelatedMutation, "unrelated page changes do not rescan settings")

  grokButton.textContent = "Other"
  themeButton.textContent = "Grok Build"
  observers[0].callback([{
    addedNodes: [],
    removedNodes: [],
    target: {
      nodeType: 1,
      closest: (selector) => selector === '[role="dialog"][aria-modal="true"] > nav' ? {} : null,
    },
  }])
  await Promise.resolve()
  assert.equal(grokButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), true)

  duplicateButton.textContent = "Grok Build"
  observers[0].callback([{
    addedNodes: [],
    removedNodes: [],
    target: {
      nodeType: 1,
      closest: (selector) => selector === '[role="dialog"][aria-modal="true"] > nav' ? {} : null,
    },
  }])
  await Promise.resolve()
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  assert.equal(duplicateButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  duplicateButton.textContent = "Other"

  settingsOpen = false
  observers[0].callback([{
    addedNodes: [],
    removedNodes: [overlay],
    target: { nodeType: 1, closest: () => null },
  }])
  await Promise.resolve()
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  settingsOpen = true
  observers[0].callback([{
    addedNodes: [overlay],
    removedNodes: [],
    target: { nodeType: 1, closest: () => null },
  }])
  await Promise.resolve()
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), true)

  const secondEffects = applyPlugin()
  assert.equal(observers.length, 1, "repeated activation shares one observer")
  const firstCleanup = firstEffects.find((effect) => effect.label === "dsh-grok: settings nav icon")?.cleanup
  const secondCleanup = secondEffects.find((effect) => effect.label === "dsh-grok: settings nav icon")?.cleanup
  assert.equal(typeof firstCleanup, "function")
  assert.equal(typeof secondCleanup, "function")

  firstCleanup()
  assert.equal(observers[0].disconnected, false)
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), true)
  observers[0].callback([{
    addedNodes: [],
    removedNodes: [],
    target: {
      nodeType: 1,
      closest: (selector) => selector === '[role="dialog"][aria-modal="true"] > nav' ? {} : null,
    },
  }])
  secondCleanup()
  await Promise.resolve()
  assert.equal(observers[0].disconnected, true)
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
  assert.equal(styles.some((style) => style.dataset.pluginNavIcon === "dsh-grok-provider"), false)
  observers[0].callback([{
    addedNodes: [],
    removedNodes: [],
    target: {
      nodeType: 1,
      closest: (selector) => selector === '[role="dialog"][aria-modal="true"] > nav' ? {} : null,
    },
  }])
  await Promise.resolve()
  assert.equal(themeButton.hasAttribute("data-dsh-grok-provider-nav-icon"), false)
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

test("the settings page gives bilingual install recovery when the official Grok CLI is missing", async () => {
  const cases = [
    {
      locale: "zh",
      missing: /(?:未检测到|尚未安装|没有安装|未安装).*Grok Build CLI|Grok Build CLI.*(?:未检测到|尚未安装|没有安装|未安装)/u,
      install: /官方.*安装|安装.*官方/u,
      redetect: /^重新检测$/u,
    },
    {
      locale: "en",
      missing: /(?:Grok Build CLI.*(?:not installed|could not be found|missing)|(?:not installed|could not be found|missing).*Grok Build CLI)/iu,
      install: /official.*install|install.*official/iu,
      redetect: /^(?:check again|recheck)$/iu,
    },
  ]

  for (const expectations of cases) {
    const fixture = await renderSettingsPage({
      locale: expectations.locale,
      status: { generation: 1, available: false, driver: true },
      diagnostics: { pluginVersion: "0.1.6", cli: { state: "missing" } },
    })
    assert.match(textContent(fixture.tree), expectations.missing)

    const installLink = findElements(fixture.tree, (node) => (
      node.type === "a" && node.props.href === "https://docs.x.ai/build/overview"
    ))[0]
    assert.ok(installLink, `${expectations.locale} renders the official Grok Build install link`)
    assert.match(textContent(installLink), expectations.install)

    const redetect = findElements(fixture.tree, (node) => (
      node.type === "button" && expectations.redetect.test(textContent(node))
    ))[0]
    assert.ok(redetect, `${expectations.locale} renders a CLI re-detection action`)
    assert.equal(typeof redetect.props.onClick, "function")
    const previousChecks = fixture.rpcCalls.filter((call) => call.endpoint === "diagnostics").length
    await redetect.props.onClick()
    assert.equal(
      fixture.rpcCalls.filter((call) => call.endpoint === "diagnostics").length,
      previousChecks + 1,
    )

    const login = findElements(fixture.tree, (node) => (
      node.type === "button" && textContent(node) === fixture.dictionaries[expectations.locale].login
    ))[0]
    assert.ok(login, `${expectations.locale} keeps the browser sign-in action visible`)
    assert.equal(login.props.disabled, true)
  }
})

test("the settings page displays the provider and installed Grok Build versions together", async () => {
  const cases = [
    { locale: "zh", plugin: /插件版本\s*0\.1\.6/u, cli: /Grok Build\s*版本\s*1\.0\.5/u },
    { locale: "en", plugin: /Plugin version\s*0\.1\.6/iu, cli: /Grok Build version\s*1\.0\.5/iu },
  ]
  for (const expectations of cases) {
    const fixture = await renderSettingsPage({
      locale: expectations.locale,
      status: { generation: 1, available: false, driver: true },
      diagnostics: { pluginVersion: "0.1.6", cli: { state: "ready", version: "1.0.5" } },
    })
    const content = textContent(fixture.tree)

    assert.match(content, expectations.plugin)
    assert.match(content, expectations.cli)
  }
})

test("an authentication network timeout says that browser sign-in has not started", async () => {
  const status = {
    generation: 1,
    available: false,
    driver: true,
    session: { sessionId: "network-timeout", state: "failed", reason: "auth-network-timeout" },
  }
  const diagnostics = { pluginVersion: "0.1.6", cli: { state: "ready", version: "1.0.5" } }
  const zh = textContent((await renderSettingsPage({ locale: "zh", status, diagnostics })).tree)
  const en = textContent((await renderSettingsPage({ locale: "en", status, diagnostics })).tree)

  assert.match(zh, /浏览器登录尚未开始/u)
  assert.match(zh, /网络|代理/u)
  assert.match(en, /browser sign-in (?:has not|hasn't|did not) start/iu)
  assert.match(en, /network|proxy/iu)
})

test("a diagnostics RPC failure has an independent retry path while sign-in stays disabled", async () => {
  const cases = [
    {
      locale: "zh",
      unavailable: /(?:无法|暂时无法)(?:检测|读取).*Grok Build CLI|Grok Build CLI.*(?:检测失败|暂时不可用)/u,
      redetect: /^重新检测$/u,
    },
    {
      locale: "en",
      unavailable: /(?:could not|unable to|temporarily unable to).*(?:detect|read|check).*Grok Build CLI|Grok Build CLI.*(?:check failed|temporarily unavailable)/iu,
      redetect: /^(?:check again|recheck)$/iu,
    },
  ]

  for (const expectations of cases) {
    const fixture = await renderSettingsPage({
      locale: expectations.locale,
      status: { generation: 1, available: false, driver: true },
      diagnosticsError: true,
    })
    const content = textContent(fixture.tree)
    assert.match(content, expectations.unavailable)
    assert.equal(content.includes(fixture.dictionaries[expectations.locale].unavailable), false)

    const redetect = findElements(fixture.tree, (node) => (
      node.type === "button" && expectations.redetect.test(textContent(node))
    ))[0]
    assert.ok(redetect, `${expectations.locale} renders a diagnostics retry action`)
    assert.equal(redetect.props.disabled, false)
    const previousChecks = fixture.rpcCalls.filter((call) => call.endpoint === "diagnostics").length
    await redetect.props.onClick()
    assert.equal(
      fixture.rpcCalls.filter((call) => call.endpoint === "diagnostics").length,
      previousChecks + 1,
    )

    const login = findElements(fixture.tree, (node) => (
      node.type === "button" && textContent(node) === fixture.dictionaries[expectations.locale].login
    ))[0]
    assert.ok(login)
    assert.equal(login.props.disabled, true)

    const liveStatus = findElements(fixture.tree, (node) => (
      node.props["aria-live"] === "polite" && expectations.unavailable.test(textContent(node))
    ))[0]
    assert.ok(liveStatus, `${expectations.locale} announces diagnostics failures`)
  }
})

test("a valid credential takes precedence over a historical authentication network timeout", async () => {
  const status = {
    generation: 2,
    available: true,
    driver: true,
    session: { sessionId: "historical-timeout", state: "failed", reason: "auth-network-timeout" },
  }
  const diagnostics = { pluginVersion: "0.1.6", cli: { state: "ready", version: "1.0.5" } }
  const cases = [
    { locale: "zh", ready: "已登录", stale: /浏览器登录尚未开始/u },
    { locale: "en", ready: "Signed in", stale: /browser sign-in (?:has not|hasn't|did not) start/iu },
  ]

  for (const expectations of cases) {
    const fixture = await renderSettingsPage({ locale: expectations.locale, status, diagnostics })
    const content = textContent(fixture.tree)
    assert.equal(content.includes(expectations.ready), true)
    assert.doesNotMatch(content, expectations.stale)

    const liveStatus = findElements(fixture.tree, (node) => (
      node.props["aria-live"] === "polite" && textContent(node).includes(expectations.ready)
    ))[0]
    assert.ok(liveStatus, `${expectations.locale} announces the current signed-in state`)
  }
})

test("sign-out remains available for a signed-in account when CLI diagnostics are not ready", async () => {
  const cases = [
    {
      name: "invalid CLI",
      diagnostics: { pluginVersion: "0.1.6", cli: { state: "invalid" } },
    },
    {
      name: "unavailable CLI",
      diagnostics: { pluginVersion: "0.1.6", cli: { state: "unavailable" } },
    },
    {
      name: "diagnostics RPC failure",
      diagnosticsError: true,
    },
  ]

  for (const fixtureCase of cases) {
    const fixture = await renderSettingsPage({
      locale: "en",
      status: { generation: 2, available: true, driver: true },
      diagnostics: fixtureCase.diagnostics,
      diagnosticsError: fixtureCase.diagnosticsError,
    })
    const logout = findElements(fixture.tree, (node) => (
      node.type === "button" && textContent(node) === fixture.dictionaries.en.logout
    ))[0]

    assert.ok(logout, `${fixtureCase.name} keeps sign-out visible`)
    assert.equal(logout.props.disabled, false, `${fixtureCase.name} does not disable sign-out`)
  }
})

test("running-status polling is serial and ignores an older response after cancellation", async () => {
  const stalePoll = deferred()
  let statusCallCount = 0
  const harness = await createSettingsLifecycleHarness({
    async rpc(endpoint) {
      if (endpoint === "status") {
        statusCallCount += 1
        if (statusCallCount === 1) {
          return {
            kind: "status",
            status: {
              generation: 1,
              available: false,
              driver: true,
              session: { sessionId: "login-1", state: "running" },
            },
          }
        }
        if (statusCallCount === 2) return stalePoll.promise
        return {
          kind: "status",
          status: {
            generation: 2,
            available: false,
            driver: true,
            session: { sessionId: "login-1", state: "cancelled" },
          },
        }
      }
      if (endpoint === "diagnostics") {
        return { kind: "diagnostics", diagnostics: { pluginVersion: "0.1.6", cli: { state: "ready", version: "1.0.5" } } }
      }
      if (endpoint === "cancel") return { kind: "cancelled" }
      if (endpoint === "dashboard") return { kind: "dashboard", dashboard: undefined }
      throw new Error(`Unexpected Grok auth RPC endpoint: ${endpoint}`)
    },
  })

  assert.equal(harness.pendingTimerCount(), 1)
  harness.runNextTimer()
  await harness.flush()
  assert.equal(statusCallCount, 2)
  assert.equal(harness.pendingTimerCount(), 0, "no second poll is scheduled while the first is pending")

  const cancel = findElements(harness.tree(), (node) => (
    node.type === "button" && textContent(node) === harness.dictionaries.en.cancel
  ))[0]
  assert.ok(cancel)
  await cancel.props.onClick()
  assert.equal(statusCallCount, 3)
  stalePoll.resolve({
    kind: "status",
    status: {
      generation: 1,
      available: false,
      driver: true,
      session: { sessionId: "login-1", state: "running" },
    },
  })
  await Promise.resolve()
  await Promise.resolve()
  await harness.flush()

  assert.equal(textContent(harness.tree()).includes(harness.dictionaries.en.cancelled), true)
  assert.equal(textContent(harness.tree()).includes(harness.dictionaries.en.cancelled), true)
  assert.equal(textContent(harness.tree()).includes(harness.dictionaries.en.running), false)
  assert.equal(harness.pendingTimerCount(), 0, "the stale response cannot restart polling")
  harness.unmount()
})

test("a successful login start enters polling even when the immediate status refresh fails", async () => {
  let statusCallCount = 0
  const harness = await createSettingsLifecycleHarness({
    async rpc(endpoint) {
      if (endpoint === "status") {
        statusCallCount += 1
        if (statusCallCount === 1) {
          return { kind: "status", status: { generation: 1, available: false, driver: true } }
        }
        if (statusCallCount === 2) throw new Error("Transient local status failure")
        return {
          kind: "status",
          status: {
            generation: 1,
            available: false,
            driver: true,
            session: { sessionId: "login-started", state: "running" },
          },
        }
      }
      if (endpoint === "diagnostics") {
        return { kind: "diagnostics", diagnostics: { pluginVersion: "0.1.7", cli: { state: "ready", version: "1.0.5" } } }
      }
      if (endpoint === "login") {
        return {
          kind: "login-started",
          status: { sessionId: "login-started", state: "running" },
          sessionId: "login-started",
        }
      }
      throw new Error(`Unexpected Grok auth RPC endpoint: ${endpoint}`)
    },
  })

  const login = findElements(harness.tree(), (node) => (
    node.type === "button" && textContent(node) === harness.dictionaries.en.login
  ))[0]
  assert.ok(login)
  await login.props.onClick()
  await harness.flush()

  assert.equal(statusCallCount, 2)
  assert.equal(textContent(harness.tree()).includes(harness.dictionaries.en.running), true)
  assert.equal(harness.pendingTimerCount(), 1, "the returned running session starts polling")

  harness.runNextTimer()
  await harness.flush()
  assert.equal(statusCallCount, 3)
  assert.equal(harness.pendingTimerCount(), 1)
  harness.unmount()
})

test("a newer CLI diagnostic cannot be overwritten by an older response", async () => {
  const olderDiagnostic = deferred()
  let diagnosticCallCount = 0
  const harness = await createSettingsLifecycleHarness({
    async rpc(endpoint) {
      if (endpoint === "status") {
        return { kind: "status", status: { generation: 2, available: true, driver: true } }
      }
      if (endpoint === "diagnostics") {
        diagnosticCallCount += 1
        if (diagnosticCallCount === 1) return olderDiagnostic.promise
        return {
          kind: "diagnostics",
          diagnostics: { pluginVersion: "0.1.7", cli: { state: "ready", version: "2.0.0" } },
        }
      }
      if (endpoint === "dashboard") return { kind: "dashboard", dashboard: undefined }
      throw new Error(`Unexpected Grok auth RPC endpoint: ${endpoint}`)
    },
  })

  const refresh = findElements(harness.tree(), (node) => (
    node.type === "button" && textContent(node) === harness.dictionaries.en.refresh
  ))[0]
  assert.ok(refresh)
  await refresh.props.onClick()
  await harness.flush()
  assert.equal(diagnosticCallCount, 2)
  assert.match(textContent(harness.tree()), /Grok Build version\s*2\.0\.0/iu)

  olderDiagnostic.resolve({
    kind: "diagnostics",
    diagnostics: { pluginVersion: "0.1.7", cli: { state: "missing" } },
  })
  await Promise.resolve()
  await Promise.resolve()
  await harness.flush()

  const content = textContent(harness.tree())
  assert.match(content, /Grok Build version\s*2\.0\.0/iu)
  assert.equal(content.includes(harness.dictionaries.en.cliMissingBody), false)
  harness.unmount()
})

test("a fresh ready CLI diagnostic supersedes a historical missing-CLI failure", async () => {
  const fixture = await renderSettingsPage({
    locale: "zh",
    status: {
      generation: 1,
      available: false,
      driver: true,
      session: { sessionId: "historical-missing", state: "failed", reason: "cli-missing" },
    },
    diagnostics: { pluginVersion: "0.1.6", cli: { state: "ready", version: "1.0.5" } },
  })
  const content = textContent(fixture.tree)
  assert.equal(content.includes(fixture.dictionaries.zh.notReady), true)
  assert.equal(content.includes(fixture.dictionaries.zh.cliMissingBody), false)

  const login = findElements(fixture.tree, (node) => (
    node.type === "button" && textContent(node) === fixture.dictionaries.zh.login
  ))[0]
  assert.ok(login)
  assert.equal(login.props.disabled, false)
})

async function renderSettingsPage({ locale, status, diagnostics, diagnosticsError = false }) {
  let definition
  const source = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  const rpcCalls = []
  const hookValues = []
  const initializedHooks = new Set()
  const effects = []
  let hookIndex = 0
  let collectEffects = true
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children } },
    useCallback(callback) { return callback },
    useEffect(callback) { if (collectEffects) effects.push(callback) },
    useMemo(factory) { return factory() },
    useState(initial) {
      const index = hookIndex
      hookIndex += 1
      if (!initializedHooks.has(index)) {
        initializedHooks.add(index)
        hookValues[index] = typeof initial === "function" ? initial() : initial
      }
      return [hookValues[index], (next) => {
        hookValues[index] = typeof next === "function" ? next(hookValues[index]) : next
      }]
    },
  }
  vm.runInNewContext(source, {
    window: {
      __ModuleLoader__: { load(value) { definition = value } },
      clearInterval() {},
      setInterval() { return 1 },
    },
    document: {
      head: { appendChild() {} },
      createElement: () => ({ dataset: {}, textContent: "" }),
      querySelector: () => null,
    },
  })
  const plugin = definition.factory(() => React)
  const registrations = []
  const dictionaries = {}
  const connection = {
    isLoopback: true,
    rpc: {
      async call(route, endpoint, payload) {
        assert.equal(route, "/grok-auth")
        rpcCalls.push({ endpoint, payload })
        if (endpoint === "status") return { ok: true, value: { kind: "status", status } }
        if (endpoint === "diagnostics") {
          if (diagnosticsError) {
            return {
              ok: false,
              error: { code: "internal", message: "The Grok auth operation failed", details: {} },
            }
          }
          return { ok: true, value: { kind: "diagnostics", diagnostics } }
        }
        if (endpoint === "dashboard") {
          return { ok: true, value: { kind: "dashboard", dashboard: undefined } }
        }
        throw new Error(`Unexpected Grok auth RPC endpoint: ${endpoint}`)
      },
    },
  }
  plugin.apply({
    connection,
    effect(callback) { callback() },
    locale: {
      bind: () => (key) => key,
      register(_namespace, value) { Object.assign(dictionaries, value) },
    },
    slots: {
      inject(_name, callback) { callback() },
      register(_options, component) { registrations.push(component) },
    },
  })
  const render = () => {
    hookIndex = 0
    return registrations[0]({ connection, t: (key) => dictionaries[locale][key] })
  }
  render()
  collectEffects = false
  for (const effect of effects) effect()
  await flushAsyncWork()

  return { dictionaries, rpcCalls, tree: render() }
}

async function flushAsyncWork() {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

async function createSettingsLifecycleHarness({ rpc }) {
  let definition
  const source = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  const hookSlots = []
  const pendingEffects = []
  const timers = new Map()
  let nextTimerId = 1
  let hookIndex = 0
  let dirty = false
  let mounted = true
  let currentTree

  const dependenciesEqual = (left, right) => (
    Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => Object.is(value, right[index]))
  )
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children } },
    useCallback(callback, dependencies) {
      const index = hookIndex
      hookIndex += 1
      const slot = hookSlots[index]
      if (!slot || !dependenciesEqual(slot.dependencies, dependencies)) {
        hookSlots[index] = { kind: "memo", dependencies, value: callback }
      }
      return hookSlots[index].value
    },
    useEffect(callback, dependencies) {
      const index = hookIndex
      hookIndex += 1
      const slot = hookSlots[index]
      if (!slot || !dependenciesEqual(slot.dependencies, dependencies)) {
        pendingEffects.push({ callback, dependencies, index })
      }
    },
    useMemo(factory, dependencies) {
      const index = hookIndex
      hookIndex += 1
      const slot = hookSlots[index]
      if (!slot || !dependenciesEqual(slot.dependencies, dependencies)) {
        hookSlots[index] = { kind: "memo", dependencies, value: factory() }
      }
      return hookSlots[index].value
    },
    useState(initial) {
      const index = hookIndex
      hookIndex += 1
      if (!hookSlots[index]) {
        hookSlots[index] = {
          kind: "state",
          value: typeof initial === "function" ? initial() : initial,
        }
      }
      return [hookSlots[index].value, (next) => {
        if (!mounted) return
        const previous = hookSlots[index].value
        const value = typeof next === "function" ? next(previous) : next
        if (!Object.is(previous, value)) {
          hookSlots[index].value = value
          dirty = true
        }
      }]
    },
  }
  const fakeWindow = {
    __ModuleLoader__: { load(value) { definition = value } },
    clearInterval(id) { timers.delete(id) },
    clearTimeout(id) { timers.delete(id) },
    setInterval(callback) {
      const id = nextTimerId
      nextTimerId += 1
      timers.set(id, { callback, repeating: true })
      return id
    },
    setTimeout(callback) {
      const id = nextTimerId
      nextTimerId += 1
      timers.set(id, { callback, repeating: false })
      return id
    },
  }
  vm.runInNewContext(source, {
    window: fakeWindow,
    document: {
      head: { appendChild() {} },
      createElement: () => ({ dataset: {}, textContent: "" }),
      querySelector: () => null,
    },
  })
  const plugin = definition.factory(() => React)
  const registrations = []
  const dictionaries = {}
  const connection = {
    isLoopback: true,
    rpc: {
      async call(route, endpoint, payload) {
        assert.equal(route, "/grok-auth")
        const value = await rpc(endpoint, payload)
        return { ok: true, value }
      },
    },
  }
  plugin.apply({
    connection,
    effect(callback) { callback() },
    locale: {
      bind: () => (key) => key,
      register(_namespace, value) { Object.assign(dictionaries, value) },
    },
    slots: {
      inject(_name, callback) { callback() },
      register(_options, component) { registrations.push(component) },
    },
  })

  const render = () => {
    hookIndex = 0
    dirty = false
    currentTree = registrations[0]({ connection, t: (key) => dictionaries.en[key] })
    const effects = pendingEffects.splice(0)
    for (const effect of effects) {
      const previous = hookSlots[effect.index]
      previous?.cleanup?.()
      hookSlots[effect.index] = {
        kind: "effect",
        dependencies: effect.dependencies,
        cleanup: effect.callback(),
      }
    }
  }
  const flush = async () => {
    for (let index = 0; index < 12; index += 1) {
      await new Promise((resolve) => setImmediate(resolve))
      if (dirty && mounted) render()
    }
  }

  render()
  await flush()
  return {
    dictionaries,
    flush,
    pendingTimerCount: () => timers.size,
    runNextTimer() {
      const entry = timers.entries().next().value
      assert.ok(entry, "expected a pending timer")
      const [id, timer] = entry
      if (!timer.repeating) timers.delete(id)
      timer.callback()
    },
    tree: () => currentTree,
    unmount() {
      mounted = false
      for (const slot of hookSlots) slot?.cleanup?.()
      timers.clear()
    },
  }
}

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

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

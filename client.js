/* global document, window */

window.__ModuleLoader__.load({
  id: "dsh-grok-provider-yukiryou",
  factory: (require) => {
    const module = { exports: {} }
    const React = require("react")
    const namespace = "settings.grok"
    const modes = ["official-cli", "managed-device"]
    const dictionaries = {
      zh: {
        nav: "Grok Build", title: "Grok Build 登录",
        description: "选择凭据来源。插件不会把 OAuth token 发送到浏览器，也不会在两种模式之间自动回退。",
        loopback: "认证管理只允许在本机页面使用。", loading: "正在读取认证状态…", unavailable: "认证服务暂时不可用。", retry: "重试",
        selected: "当前使用", select: "设为当前", ready: "凭据来源已挂载", notReady: "来源不可用", driverMissing: "此构建未启用",
        running: "登录进行中", succeeded: "最近登录成功", failed: "最近登录失败", cancelled: "最近登录已取消",
        login: "通过浏览器登录", cancel: "取消登录", logout: "退出登录", confirmLogout: "再次点击确认退出",
        officialTitle: "官方 Grok CLI", officialBody: "调用本机已验证的 grok login --oauth，由官方 CLI 打开浏览器并管理其凭据文件。",
        managedTitle: "插件托管 OAuth", managedBody: "使用 xAI 授权给本插件的 Device Grant；refresh token 只写入 Harness 凭据库。",
        managedBlocked: "尚无 xAI 授权的独立 OAuth client，因此发行构建保持关闭。",
        deviceTitle: "在浏览器中完成授权", deviceCode: "设备代码", deviceOpen: "打开 xAI 授权页", expires: "到期时间",
      },
      en: {
        nav: "Grok Build", title: "Grok Build sign-in",
        description: "Choose a credential source. OAuth tokens never reach the browser and modes never fall back automatically.",
        loopback: "Authentication management is available only from the local page.", loading: "Reading authentication status…", unavailable: "Authentication is temporarily unavailable.", retry: "Retry",
        selected: "In use", select: "Use this mode", ready: "Credential source mounted", notReady: "Source unavailable", driverMissing: "Not enabled in this build",
        running: "Sign-in in progress", succeeded: "Last sign-in succeeded", failed: "Last sign-in failed", cancelled: "Last sign-in cancelled",
        login: "Sign in with browser", cancel: "Cancel sign-in", logout: "Sign out", confirmLogout: "Click again to confirm sign-out",
        officialTitle: "Official Grok CLI", officialBody: "Runs the verified local grok login --oauth command; the official CLI opens the browser and owns its credential file.",
        managedTitle: "Plugin-managed OAuth", managedBody: "Uses a Device Grant issued to this plugin by xAI; the refresh token is stored only in the Harness credential vault.",
        managedBlocked: "No independently authorized xAI OAuth client is available, so this capability remains closed in the release build.",
        deviceTitle: "Complete authorization in your browser", deviceCode: "Device code", deviceOpen: "Open xAI authorization", expires: "Expires",
      },
    }

    const css = `
      .dsh-grok-page{box-sizing:border-box;width:min(760px,100%);padding:8px 4px 32px;color:var(--dsw-alias-label-primary)}
      .dsh-grok-page h2{margin:0;font-size:20px;line-height:30px}.dsh-grok-description{margin:6px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:21px}
      .dsh-grok-notice{padding:13px 14px;border:1px solid rgb(229 72 77 / 28%);border-radius:11px;color:var(--dsw-alias-label-secondary);background:rgb(229 72 77 / 7%);font-size:12px;line-height:19px}
      .dsh-grok-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dsh-grok-card{display:flex;min-width:0;padding:15px;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
      .dsh-grok-card[data-selected="true"]{border-color:rgb(77 107 254 / 48%);box-shadow:inset 0 0 0 1px rgb(77 107 254 / 12%)}.dsh-grok-card h3{margin:0;font-size:15px;line-height:22px}.dsh-grok-card p{min-height:63px;margin:6px 0 12px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
      .dsh-grok-badges{display:flex;min-height:22px;flex-wrap:wrap;gap:6px}.dsh-grok-badge{border-radius:999px;padding:2px 8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);font-size:10px;line-height:18px}.dsh-grok-badge[data-good="true"]{color:var(--dsw-static-green-500,#168a4b);background:rgb(48 164 108 / 11%)}
      .dsh-grok-actions{display:flex;margin-top:13px;flex-wrap:wrap;gap:7px}.dsh-grok-button{height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:0 11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;font:inherit;font-size:11px}.dsh-grok-button:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.dsh-grok-button:disabled{cursor:default;opacity:.45}.dsh-grok-primary{border-color:var(--dsw-static-deepseek-500,#4d6bfe);color:#fff;background:var(--dsw-static-deepseek-500,#4d6bfe)}
      .dsh-grok-device{grid-column:1/-1;padding:14px;border:1px solid rgb(77 107 254 / 28%);border-radius:12px;background:rgb(77 107 254 / 7%)}.dsh-grok-device h3{margin:0 0 8px;font-size:14px}.dsh-grok-code{display:block;margin:7px 0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:20px;font-weight:650;letter-spacing:.08em}.dsh-grok-link{color:var(--dsw-static-deepseek-500,#4d6bfe);font-size:12px;font-weight:600;text-decoration:none}.dsh-grok-error{margin:12px 0 0;color:var(--dsw-static-red-500,#e5484d);font-size:12px}
      @media(max-width:680px){.dsh-grok-grid{grid-template-columns:1fr}.dsh-grok-device{grid-column:auto}}
    `
    if (!document.querySelector('style[data-plugin-css="dsh-grok-provider-yukiryou"]')) {
      const style = document.createElement("style")
      style.dataset.pluginCss = "dsh-grok-provider-yukiryou"
      style.textContent = css
      document.head.appendChild(style)
    }

    function GrokSettings({ connection, t }) {
      const [status, setStatus] = React.useState()
      const [device, setDevice] = React.useState()
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(false)
      const [confirmMode, setConfirmMode] = React.useState()
      const call = React.useCallback(async (endpoint, payload = {}) => {
        const result = await connection.rpc.call("/grok-auth", endpoint, payload)
        if (!result || result.ok !== true) throw new Error("Grok auth RPC failed")
        return result.value
      }, [connection])
      const refresh = React.useCallback(async () => {
        try {
          const value = await call("status")
          setStatus(value.status)
          const managed = value.status?.sessions?.["managed-device"]
          setDevice(managed?.state === "running" && managed.verificationUriComplete ? managed : undefined)
          setError(false)
        } catch { setError(true) }
      }, [call])
      React.useEffect(() => { refresh() }, [refresh])
      React.useEffect(() => {
        const running = modes.some((mode) => status?.sessions?.[mode]?.state === "running")
        if (!running) return undefined
        const timer = window.setInterval(refresh, 1_000)
        return () => window.clearInterval(timer)
      }, [refresh, status])
      const act = async (operation) => {
        setBusy(true); setError(false)
        try { await operation() } catch { setError(true) } finally { setBusy(false) }
      }
      const select = (mode) => act(async () => {
        const value = await call("use", { authMode: mode })
        setStatus(value.status)
      })
      const login = (mode) => act(async () => {
        const value = await call("login", { authMode: mode })
        if (mode === "managed-device") setDevice(value.status)
        setConfirmMode(undefined)
        await refresh()
      })
      const cancel = (mode) => act(async () => {
        const sessionId = status?.sessions?.[mode]?.sessionId
        if (typeof sessionId !== "string") throw new Error("No active Grok login")
        await call("cancel", { authMode: mode, sessionId })
        setDevice(undefined)
        await refresh()
      })
      const logout = (mode) => act(async () => {
        const value = await call("logout", { authMode: mode })
        if (value.kind === "logout-confirmation-required") setConfirmMode(mode)
        else { setConfirmMode(undefined); setDevice(undefined); await refresh() }
      })

      if (!connection.isLoopback) return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-notice" }, t("loopback")))
      if (!status && !error) return React.createElement("section", { className: "dsh-grok-page" }, t("loading"))

      const renderMode = (mode) => {
        const official = mode === "official-cli"
        const driver = status?.drivers?.[mode] === true
        const available = status?.available?.[mode] === true
        const selected = status?.selectedMode === mode
        const sessionState = status?.sessions?.[mode]?.state
        const stateLabel = !driver ? t("driverMissing") : sessionState === "running" ? t("running")
          : sessionState === "succeeded" ? t("succeeded") : sessionState === "failed" ? t("failed")
            : sessionState === "cancelled" ? t("cancelled") : available ? t("ready") : t("notReady")
        return React.createElement("article", { className: "dsh-grok-card", "data-selected": selected },
          React.createElement("h3", null, t(official ? "officialTitle" : "managedTitle")),
          React.createElement("p", null, t(official ? "officialBody" : driver ? "managedBody" : "managedBlocked")),
          React.createElement("div", { className: "dsh-grok-badges" },
            selected && React.createElement("span", { className: "dsh-grok-badge", "data-good": true }, t("selected")),
            React.createElement("span", { className: "dsh-grok-badge", "data-good": available }, stateLabel)),
          React.createElement("div", { className: "dsh-grok-actions" },
            React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy || selected, onClick: () => select(mode) }, t("select")),
            sessionState === "running"
              ? React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy, onClick: () => cancel(mode) }, t("cancel"))
              : React.createElement("button", { className: "dsh-grok-button dsh-grok-primary", type: "button", disabled: busy || !driver, onClick: () => login(mode) }, t("login")),
            React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy || !driver, onClick: () => logout(mode) }, t(confirmMode === mode ? "confirmLogout" : "logout"))))
      }
      return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-description" }, t("description")),
        React.createElement("div", { className: "dsh-grok-grid" }, ...modes.map(renderMode),
          device?.verificationUriComplete && React.createElement("aside", { className: "dsh-grok-device" },
            React.createElement("h3", null, t("deviceTitle")), React.createElement("span", null, t("deviceCode")),
            React.createElement("strong", { className: "dsh-grok-code" }, device.userCode),
            React.createElement("a", { className: "dsh-grok-link", href: device.verificationUriComplete, target: "_blank", rel: "noreferrer" }, `${t("deviceOpen")} ↗`),
            React.createElement("div", null, `${t("expires")}: ${device.expiresAt}`))),
        error && React.createElement("p", { className: "dsh-grok-error" }, t("unavailable")),
        error && React.createElement("button", { className: "dsh-grok-button", type: "button", onClick: refresh }, t("retry")))
    }

    const inject = ["slots", "locale", "connection"]
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(namespace, dictionaries), "dsh-grok: dictionaries")
      const t = ctx.locale.bind(namespace)
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section", id: "grok-auth", order: 45, label: () => t("nav"), locale: namespace,
        inject: () => ({ connection: ctx.connection, t }),
      }, GrokSettings))
    }
    module.exports.inject = inject
    module.exports.apply = apply
    return module.exports
  },
})

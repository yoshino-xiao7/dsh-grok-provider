/* global document, window */

window.__ModuleLoader__.load({
  id: "dsh-grok-provider-yukiryou",
  factory: (require) => {
    const module = { exports: {} }
    const React = require("react")
    const namespace = "settings.grok"
    const dictionaries = {
      zh: {
        nav: "Grok Build", title: "Grok Build 登录",
        description: "使用本机官方 Grok CLI 打开浏览器登录。OAuth token 不会发送到设置页面。",
        loopback: "认证管理只允许在本机页面使用。", loading: "正在读取认证状态…", unavailable: "认证服务暂时不可用。", retry: "重试",
        ready: "官方凭据可用", notReady: "尚未发现有效凭据", driverMissing: "官方 CLI 登录能力不可用",
        running: "登录进行中", succeeded: "最近登录成功", failed: "最近登录失败", cancelled: "最近登录已取消",
        login: "通过浏览器登录", cancel: "取消登录", logout: "退出登录", confirmLogout: "再次点击确认退出",
        officialTitle: "官方 Grok CLI", officialBody: "调用本机已验证的 grok login --oauth，由官方 CLI 打开浏览器并管理其凭据文件。",
      },
      en: {
        nav: "Grok Build", title: "Grok Build sign-in",
        description: "Use the official local Grok CLI to open browser sign-in. OAuth tokens never reach this settings page.",
        loopback: "Authentication management is available only from the local page.", loading: "Reading authentication status…", unavailable: "Authentication is temporarily unavailable.", retry: "Retry",
        ready: "Official credential available", notReady: "No valid credential found", driverMissing: "Official CLI sign-in unavailable",
        running: "Sign-in in progress", succeeded: "Last sign-in succeeded", failed: "Last sign-in failed", cancelled: "Last sign-in cancelled",
        login: "Sign in with browser", cancel: "Cancel sign-in", logout: "Sign out", confirmLogout: "Click again to confirm sign-out",
        officialTitle: "Official Grok CLI", officialBody: "Runs the verified local grok login --oauth command; the official CLI opens the browser and owns its credential file.",
      },
    }

    const css = `
      .dsh-grok-page{box-sizing:border-box;width:min(760px,100%);padding:8px 4px 32px;color:var(--dsw-alias-label-primary)}
      .dsh-grok-page h2{margin:0;font-size:20px;line-height:30px}.dsh-grok-description{margin:6px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:21px}
      .dsh-grok-notice{padding:13px 14px;border:1px solid rgb(229 72 77 / 28%);border-radius:11px;color:var(--dsw-alias-label-secondary);background:rgb(229 72 77 / 7%);font-size:12px;line-height:19px}
      .dsh-grok-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.dsh-grok-card{display:flex;min-width:0;padding:15px;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
      .dsh-grok-card h3{margin:0;font-size:15px;line-height:22px}.dsh-grok-card p{min-height:42px;margin:6px 0 12px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
      .dsh-grok-badges{display:flex;min-height:22px;flex-wrap:wrap;gap:6px}.dsh-grok-badge{border-radius:999px;padding:2px 8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);font-size:10px;line-height:18px}.dsh-grok-badge[data-good="true"]{color:var(--dsw-static-green-500,#168a4b);background:rgb(48 164 108 / 11%)}
      .dsh-grok-actions{display:flex;margin-top:13px;flex-wrap:wrap;gap:7px}.dsh-grok-button{height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:0 11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;font:inherit;font-size:11px}.dsh-grok-button:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.dsh-grok-button:disabled{cursor:default;opacity:.45}.dsh-grok-primary{border-color:var(--dsw-static-deepseek-500,#4d6bfe);color:#fff;background:var(--dsw-static-deepseek-500,#4d6bfe)}
      .dsh-grok-error{margin:12px 0 0;color:var(--dsw-static-red-500,#e5484d);font-size:12px}
    `
    if (!document.querySelector('style[data-plugin-css="dsh-grok-provider-yukiryou"]')) {
      const style = document.createElement("style")
      style.dataset.pluginCss = "dsh-grok-provider-yukiryou"
      style.textContent = css
      document.head.appendChild(style)
    }

    function GrokSettings({ connection, t }) {
      const [status, setStatus] = React.useState()
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(false)
      const [confirmLogout, setConfirmLogout] = React.useState(false)
      const call = React.useCallback(async (endpoint, payload = {}) => {
        const result = await connection.rpc.call("/grok-auth", endpoint, payload)
        if (!result || result.ok !== true) throw new Error("Grok auth RPC failed")
        return result.value
      }, [connection])
      const refresh = React.useCallback(async () => {
        try {
          const value = await call("status")
          setStatus(value.status)
          setError(false)
        } catch { setError(true) }
      }, [call])
      React.useEffect(() => { refresh() }, [refresh])
      React.useEffect(() => {
        const running = status?.session?.state === "running"
        if (!running) return undefined
        const timer = window.setInterval(refresh, 1_000)
        return () => window.clearInterval(timer)
      }, [refresh, status])
      const act = async (operation) => {
        setBusy(true); setError(false)
        try { await operation() } catch { setError(true) } finally { setBusy(false) }
      }
      const login = () => act(async () => {
        await call("login")
        setConfirmLogout(false)
        await refresh()
      })
      const cancel = () => act(async () => {
        const sessionId = status?.session?.sessionId
        if (typeof sessionId !== "string") throw new Error("No active Grok login")
        await call("cancel", { sessionId })
        await refresh()
      })
      const logout = () => act(async () => {
        const value = await call("logout")
        if (value.kind === "logout-confirmation-required") setConfirmLogout(true)
        else { setConfirmLogout(false); await refresh() }
      })

      if (!connection.isLoopback) return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-notice" }, t("loopback")))
      if (!status && !error) return React.createElement("section", { className: "dsh-grok-page" }, t("loading"))

      const renderOfficial = () => {
        const driver = status?.driver === true
        const available = status?.available === true
        const sessionState = status?.session?.state
        const stateLabel = !driver ? t("driverMissing") : sessionState === "running" ? t("running")
          : sessionState === "succeeded" ? t("succeeded") : sessionState === "failed" ? t("failed")
            : sessionState === "cancelled" ? t("cancelled") : available ? t("ready") : t("notReady")
        return React.createElement("article", { className: "dsh-grok-card" },
          React.createElement("h3", null, t("officialTitle")),
          React.createElement("p", null, t("officialBody")),
          React.createElement("div", { className: "dsh-grok-badges" },
            React.createElement("span", { className: "dsh-grok-badge", "data-good": available }, stateLabel)),
          React.createElement("div", { className: "dsh-grok-actions" },
            sessionState === "running"
              ? React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy, onClick: cancel }, t("cancel"))
              : React.createElement("button", { className: "dsh-grok-button dsh-grok-primary", type: "button", disabled: busy || !driver, onClick: login }, t("login")),
            React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy || !driver, onClick: logout }, t(confirmLogout ? "confirmLogout" : "logout"))))
      }
      return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-description" }, t("description")),
        React.createElement("div", { className: "dsh-grok-grid" }, renderOfficial()),
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

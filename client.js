/* global document, window */

window.__ModuleLoader__.load({
  id: "dsh-grok-provider",
  factory: (require) => {
    const module = { exports: {} }
    const React = require("react")
    const namespace = "settings.grok"
    const dictionaries = {
      zh: {
        nav: "Grok Build", title: "Grok Build",
        description: "管理官方 Grok Build 登录、账户额度与当前账号可用模型。敏感凭据不会发送到设置页面。",
        loopback: "账户管理只允许在本机页面使用。", loading: "正在读取账户状态…", unavailable: "账户服务暂时不可用。",
        ready: "已登录", notReady: "未登录", driverMissing: "官方 CLI 登录能力不可用",
        running: "登录进行中", succeeded: "登录成功", failed: "登录失败", cancelled: "登录已取消",
        login: "通过浏览器登录", cancel: "取消登录", logout: "退出登录", confirmLogout: "再次点击确认退出",
        officialBody: "登录与凭据刷新由本机官方 Grok CLI 完成。退出会同时影响使用同一 Grok 凭据的其他应用。",
        usage: "使用额度", grokBuild: "Grok Build", refresh: "刷新", refreshing: "刷新中…",
        weekly: "每周额度", monthly: "每月额度", currentPeriod: "当前额度周期",
        remaining: "剩余", used: "已使用", resetTime: "重置时间", resetUnknown: "上游未提供重置时间",
        usageUnknown: "上游未提供使用比例", quotaUnavailable: "暂时无法读取 Grok Build 额度。",
        modelsTitle: "当前账号可用的模型", modelsDescription: "模型来自 Grok Build 动态目录；Harness 模型选择器会显示这里列出的全部模型。",
        modelsUnavailable: "暂时无法读取模型目录。", noModels: "当前账号没有返回可用模型。",
        context: "上下文", reasoning: "推理档位", defaultEffort: "默认", text: "文本输入", streaming: "流式输出", tools: "工具调用",
        lastUpdated: "数据更新时间",
      },
      en: {
        nav: "Grok Build", title: "Grok Build",
        description: "Manage official Grok Build sign-in, account quota, and models available to this account. Sensitive credentials never reach this page.",
        loopback: "Account management is available only from the local page.", loading: "Reading account status…", unavailable: "The account service is temporarily unavailable.",
        ready: "Signed in", notReady: "Signed out", driverMissing: "Official CLI sign-in unavailable",
        running: "Sign-in in progress", succeeded: "Signed in", failed: "Sign-in failed", cancelled: "Sign-in cancelled",
        login: "Sign in with browser", cancel: "Cancel sign-in", logout: "Sign out", confirmLogout: "Click again to confirm sign-out",
        officialBody: "The official local Grok CLI owns sign-in and credential refresh. Signing out also affects other apps sharing the same Grok credential.",
        usage: "Usage quota", grokBuild: "Grok Build", refresh: "Refresh", refreshing: "Refreshing…",
        weekly: "Weekly quota", monthly: "Monthly quota", currentPeriod: "Current quota period",
        remaining: "remaining", used: "Used", resetTime: "Resets", resetUnknown: "Reset time was not provided",
        usageUnknown: "Usage percentage was not provided", quotaUnavailable: "Grok Build quota is temporarily unavailable.",
        modelsTitle: "Models available to this account", modelsDescription: "Models come from the live Grok Build catalog; every model listed here remains visible in the Harness model selector.",
        modelsUnavailable: "The model catalog is temporarily unavailable.", noModels: "This account returned no available models.",
        context: "Context", reasoning: "Reasoning", defaultEffort: "default", text: "Text input", streaming: "Streaming", tools: "Tool calling",
        lastUpdated: "Updated",
      },
    }

    const css = `
      .dsh-grok-page{box-sizing:border-box;width:min(920px,100%);padding:8px 4px 40px;color:var(--dsw-alias-label-primary)}
      .dsh-grok-page *{box-sizing:border-box}.dsh-grok-page h2{margin:0;font-size:21px;line-height:31px}.dsh-grok-description{max-width:760px;margin:5px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:21px}
      .dsh-grok-stack{display:grid;gap:14px}.dsh-grok-panel{overflow:hidden;border:1px solid rgb(190 93 138 / 28%);border-radius:18px;background:linear-gradient(145deg,rgb(190 93 138 / 8%),rgb(190 93 138 / 3%) 55%,var(--dsw-alias-bg-layer-1));box-shadow:0 1px 2px rgb(20 20 30 / 3%)}
      .dsh-grok-panel-inner{padding:20px}.dsh-grok-account-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.dsh-grok-state{display:flex;min-width:0;align-items:center;gap:10px;font-size:17px;font-weight:650}.dsh-grok-dot{width:10px;height:10px;flex:0 0 auto;border-radius:50%;background:var(--dsw-alias-label-tertiary,#909090)}.dsh-grok-dot[data-good="true"]{background:var(--dsw-static-green-500,#1ebf68);box-shadow:0 0 0 4px rgb(30 191 104 / 10%)}.dsh-grok-dot[data-running="true"]{background:#d99b2b;box-shadow:0 0 0 4px rgb(217 155 43 / 12%)}
      .dsh-grok-button{height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 14px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;font:inherit;font-size:12px}.dsh-grok-button:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.dsh-grok-button:disabled{cursor:default;opacity:.45}.dsh-grok-primary{border-color:var(--dsw-static-deepseek-500,#4d6bfe);color:#fff;background:var(--dsw-static-deepseek-500,#4d6bfe)}
      .dsh-grok-auth-note{margin:13px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}.dsh-grok-actions{display:flex;flex-wrap:wrap;gap:7px}
      .dsh-grok-divider{height:1px;margin:18px 0;background:rgb(190 93 138 / 20%)}.dsh-grok-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.dsh-grok-section-head h3{margin:0;font-size:15px;line-height:23px}.dsh-grok-section-head .dsh-grok-button{height:30px;padding:0 11px}
      .dsh-grok-quota{margin-top:15px}.dsh-grok-quota-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px;color:var(--dsw-alias-label-secondary);font-size:13px}.dsh-grok-quota-name{color:var(--dsw-alias-label-primary);font-weight:600}.dsh-grok-progress{height:9px;overflow:hidden;border-radius:999px;background:rgb(190 93 138 / 13%)}.dsh-grok-progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#d7448a,#ea1768);transition:width .25s ease}.dsh-grok-quota-meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:7px;margin-top:9px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dsh-grok-muted{margin:12px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
      .dsh-grok-models-head{padding:20px 20px 0}.dsh-grok-models-head h3{margin:0;font-size:16px;line-height:24px}.dsh-grok-models-head p{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}.dsh-grok-model-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px 20px 20px}.dsh-grok-model{min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:13px;padding:14px;background:var(--dsw-alias-bg-layer-1)}.dsh-grok-model-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.dsh-grok-model-title strong{overflow-wrap:anywhere;font-size:14px}.dsh-grok-model-id{overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px}.dsh-grok-model-description{margin:5px 0 10px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}.dsh-grok-badges{display:flex;flex-wrap:wrap;gap:5px}.dsh-grok-badge{border-radius:999px;padding:2px 8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);font-size:10px;line-height:18px}.dsh-grok-badge[data-accent="true"]{color:#a9326b;background:rgb(215 68 138 / 11%)}.dsh-grok-efforts{margin-top:10px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:17px}.dsh-grok-footer{padding:0 20px 16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:10px}
      .dsh-grok-notice{padding:13px 14px;border:1px solid rgb(229 72 77 / 28%);border-radius:11px;color:var(--dsw-alias-label-secondary);background:rgb(229 72 77 / 7%);font-size:12px;line-height:19px}.dsh-grok-error{margin:10px 0 0;color:var(--dsw-static-red-500,#e5484d);font-size:12px}
      @media(max-width:680px){.dsh-grok-panel-inner,.dsh-grok-models-head{padding:16px}.dsh-grok-model-grid{grid-template-columns:1fr;padding:14px 16px 16px}.dsh-grok-account-head{align-items:flex-start;flex-direction:column}.dsh-grok-quota-row{align-items:flex-start;flex-direction:column;gap:3px}}
    `
    if (!document.querySelector('style[data-plugin-css="dsh-grok-provider"]')) {
      const style = document.createElement("style")
      style.dataset.pluginCss = "dsh-grok-provider"
      style.textContent = css
      document.head.appendChild(style)
    }

    function GrokSettings({ connection, t }) {
      const [status, setStatus] = React.useState()
      const [dashboard, setDashboard] = React.useState()
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(false)
      const [dashboardError, setDashboardError] = React.useState(false)
      const [confirmLogout, setConfirmLogout] = React.useState(false)
      const call = React.useCallback(async (endpoint, payload = {}) => {
        const result = await connection.rpc.call("/grok-auth", endpoint, payload)
        if (!result || result.ok !== true) throw new Error("Grok account RPC failed")
        return result.value
      }, [connection])
      const refreshDashboard = React.useCallback(async () => {
        try {
          const value = await call("dashboard")
          setDashboard(value.dashboard)
          setDashboardError(false)
        } catch { setDashboardError(true) }
      }, [call])
      const refreshStatus = React.useCallback(async ({ includeDashboard = false } = {}) => {
        try {
          const value = await call("status")
          setStatus(value.status)
          setError(false)
          if (value.status.available === true && includeDashboard) await refreshDashboard()
          if (value.status.available !== true) setDashboard(undefined)
        } catch { setError(true) }
      }, [call, refreshDashboard])
      React.useEffect(() => { refreshStatus({ includeDashboard: true }) }, [refreshStatus])
      React.useEffect(() => {
        if (status?.session?.state !== "running") return undefined
        const timer = window.setInterval(() => refreshStatus(), 1_000)
        return () => window.clearInterval(timer)
      }, [refreshStatus, status])
      React.useEffect(() => {
        if (status?.available === true && status?.session?.state === "succeeded") refreshDashboard()
      }, [refreshDashboard, status?.available, status?.session?.state])
      const act = async (operation) => {
        setBusy(true); setError(false)
        try { await operation() } catch { setError(true) } finally { setBusy(false) }
      }
      const login = () => act(async () => {
        await call("login"); setConfirmLogout(false); await refreshStatus()
      })
      const cancel = () => act(async () => {
        const sessionId = status?.session?.sessionId
        if (typeof sessionId !== "string") throw new Error("No active Grok login")
        await call("cancel", { sessionId }); await refreshStatus({ includeDashboard: true })
      })
      const logout = () => act(async () => {
        const value = await call("logout")
        if (value.kind === "logout-confirmation-required") setConfirmLogout(true)
        else { setConfirmLogout(false); setDashboard(undefined); await refreshStatus() }
      })
      const manualRefresh = () => act(async () => refreshStatus({ includeDashboard: true }))

      if (!connection.isLoopback) return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-notice" }, t("loopback")))
      if (!status && !error) return React.createElement("section", { className: "dsh-grok-page" }, t("loading"))

      const driver = status?.driver === true
      const available = status?.available === true
      const sessionState = status?.session?.state
      const stateLabel = !driver ? t("driverMissing") : sessionState === "running" ? t("running")
        : sessionState === "succeeded" && available ? t("succeeded") : sessionState === "failed" ? t("failed")
          : sessionState === "cancelled" ? t("cancelled") : available ? t("ready") : t("notReady")

      const renderQuota = () => {
        if (!available) return React.createElement("p", { className: "dsh-grok-muted" }, t("notReady"))
        if (!dashboard && !dashboardError) return React.createElement("p", { className: "dsh-grok-muted" }, t("refreshing"))
        const quota = dashboard?.quota
        if (dashboardError || quota?.state !== "ready") return React.createElement("p", { className: "dsh-grok-muted" }, t("quotaUnavailable"))
        const hasPercent = typeof quota.remainingPercent === "number"
        const periodLabel = quota.periodKind === "weekly" ? t("weekly") : quota.periodKind === "monthly" ? t("monthly") : t("currentPeriod")
        return React.createElement("div", { className: "dsh-grok-quota" },
          React.createElement("div", { className: "dsh-grok-quota-row" },
            React.createElement("span", { className: "dsh-grok-quota-name" }, t("grokBuild")),
            React.createElement("span", null, hasPercent ? `${t("remaining")} ${formatPercent(quota.remainingPercent)}` : t("usageUnknown"))),
          hasPercent && React.createElement("div", { className: "dsh-grok-progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": quota.remainingPercent },
            React.createElement("div", { className: "dsh-grok-progress-fill", style: { width: `${quota.remainingPercent}%` } })),
          React.createElement("div", { className: "dsh-grok-quota-meta" },
            React.createElement("span", null, hasPercent ? `${periodLabel} · ${t("used")} ${formatPercent(quota.usedPercent)}` : periodLabel),
            React.createElement("span", null, quota.resetsAt ? `${t("resetTime")}：${formatDateTime(quota.resetsAt)}` : t("resetUnknown"))))
      }

      const renderModel = (model) => {
        const effortText = model.reasoning?.efforts?.map((effort) => effort.id === model.reasoning.defaultEffort
          ? `${effort.name} (${t("defaultEffort")})` : effort.name).join(" · ")
        return React.createElement("article", { className: "dsh-grok-model", key: model.id },
          React.createElement("div", { className: "dsh-grok-model-title" },
            React.createElement("strong", null, model.name), React.createElement("span", { className: "dsh-grok-model-id" }, model.id)),
          model.description && React.createElement("p", { className: "dsh-grok-model-description" }, model.description),
          React.createElement("div", { className: "dsh-grok-badges" },
            React.createElement("span", { className: "dsh-grok-badge", "data-accent": true }, `${t("context")} ${formatContext(model.contextWindow)}`),
            model.capabilities?.textInput && React.createElement("span", { className: "dsh-grok-badge" }, t("text")),
            model.capabilities?.streaming && React.createElement("span", { className: "dsh-grok-badge" }, t("streaming")),
            model.capabilities?.functionTools && React.createElement("span", { className: "dsh-grok-badge" }, t("tools"))),
          effortText && React.createElement("div", { className: "dsh-grok-efforts" }, `${t("reasoning")}：${effortText}`))
      }

      const models = dashboard?.models
      return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-description" }, t("description")),
        React.createElement("div", { className: "dsh-grok-stack" },
          React.createElement("article", { className: "dsh-grok-panel" }, React.createElement("div", { className: "dsh-grok-panel-inner" },
            React.createElement("div", { className: "dsh-grok-account-head" },
              React.createElement("div", { className: "dsh-grok-state" }, React.createElement("span", { className: "dsh-grok-dot", "data-good": available, "data-running": sessionState === "running" }), stateLabel),
              React.createElement("div", { className: "dsh-grok-actions" },
                sessionState === "running"
                  ? React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy, onClick: cancel }, t("cancel"))
                  : !available && React.createElement("button", { className: "dsh-grok-button dsh-grok-primary", type: "button", disabled: busy || !driver, onClick: login }, t("login")),
                available && React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy || !driver, onClick: logout }, t(confirmLogout ? "confirmLogout" : "logout")))),
            React.createElement("p", { className: "dsh-grok-auth-note" }, t("officialBody")),
            React.createElement("div", { className: "dsh-grok-divider" }),
            React.createElement("div", { className: "dsh-grok-section-head" }, React.createElement("h3", null, t("usage")),
              React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy || !available, onClick: manualRefresh }, busy ? t("refreshing") : t("refresh"))),
            renderQuota(), error && React.createElement("p", { className: "dsh-grok-error" }, t("unavailable")))),
          React.createElement("article", { className: "dsh-grok-panel" },
            React.createElement("div", { className: "dsh-grok-models-head" }, React.createElement("h3", null, t("modelsTitle")), React.createElement("p", null, t("modelsDescription"))),
            React.createElement("div", { className: "dsh-grok-model-grid" },
              !available ? React.createElement("p", { className: "dsh-grok-muted" }, t("notReady"))
                : dashboardError || models?.state === "unavailable" ? React.createElement("p", { className: "dsh-grok-muted" }, t("modelsUnavailable"))
                  : !models ? React.createElement("p", { className: "dsh-grok-muted" }, t("refreshing"))
                    : models.items.length === 0 ? React.createElement("p", { className: "dsh-grok-muted" }, t("noModels"))
                      : models.items.map(renderModel)),
            dashboard?.fetchedAt && React.createElement("div", { className: "dsh-grok-footer" }, `${t("lastUpdated")}：${formatDateTime(dashboard.fetchedAt)}`))))
    }

    function formatPercent(value) { return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}%` }
    function formatDateTime(value) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) }
    function formatContext(value) {
      if (value >= 1_000_000) return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`
      if (value >= 1_000) return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value / 1_000)}K`
      return new Intl.NumberFormat().format(value)
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

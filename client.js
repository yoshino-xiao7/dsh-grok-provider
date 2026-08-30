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
        cliMissingTitle: "未检测到 Grok Build CLI", cliMissingBody: "请先通过官方安装说明安装 Grok Build CLI，然后重新检测。",
        cliInvalidTitle: "Grok Build CLI 无法验证", cliInvalidBody: "默认路径中的 CLI 无法通过版本或安全检查，请从官方渠道更新或重新安装。",
        diagnosticsUnavailableTitle: "无法检测 Grok Build CLI", diagnosticsUnavailableBody: "本机 CLI 检测暂时不可用，请稍后重新检测。",
        officialInstall: "查看官方安装说明", redetect: "重新检测", providerVersion: "插件版本", cliVersion: "Grok Build 版本",
        versionUnknown: "未知", cliNotDetected: "未检测到", cliUnavailable: "不可用",
        authNetworkTimeout: "无法连接登录服务", authNetworkTimeoutBody: "无法连接 xAI 登录服务，浏览器登录尚未开始。请检查本机网络、代理、防火墙或 VPN 后重试。",
        loginTimeout: "登录等待超时", loginTimeoutBody: "官方 CLI 未在五分钟内完成浏览器授权，请确认浏览器回调后重试。",
        cliFailedBody: "官方 Grok Build CLI 登录失败。请在终端运行 grok login --oauth 进行验证后重试。",
        runningBody: "正在连接 xAI 登录服务；官方 CLI 生成登录链接后会打开浏览器。你可以随时取消。",
        login: "通过浏览器登录", cancel: "取消登录", logout: "退出登录", confirmLogout: "再次点击确认退出",
        officialBody: "登录与凭据刷新由本机官方 Grok CLI 完成。重新登录会替换共享会话，退出会清除共享会话，并影响使用同一 Grok 凭据的其他应用。",
        usage: "使用额度", grokBuild: "Grok Build", refresh: "刷新", refreshing: "刷新中…",
        weekly: "每周额度", monthly: "每月额度", currentPeriod: "当前额度周期",
        remaining: "剩余", used: "已使用", resetTime: "重置时间", resetUnknown: "上游未提供重置时间",
        usageUnknown: "上游未提供使用比例", quotaUnavailable: "暂时无法读取 Grok Build 额度。",
        searchTitle: "在线搜索", searchDescription: "默认关闭，并分别控制普通 Grok 请求是否可调用 xAI 的远端搜索；当前仅精确 grok-4.6 支持，其他模型会失败关闭；后台摘要与会话标题不会启用搜索。",
        webSearch: "Web Search", webSearchDescription: "允许 xAI 根据对话和生成的搜索词远端查询公开网页，可能产生额外用量。",
        xSearch: "X Search", xSearchDescription: "允许 xAI 根据对话和生成的搜索词远端查询 X 帖子、用户与线程，可能产生额外用量。",
        searchRisk: "搜索结果和 citation 是不可信的远端内容，可能包含错误或 prompt injection。执行敏感操作前请核实来源；插件不会打开或下载引用链接。",
        searchEnabled: "已开启", searchDisabled: "已关闭", searchLoading: "正在读取搜索设置…",
        searchUnavailable: "搜索设置暂时不可用；开关不可操作，也不会写入未知值。", searchReadOnly: "当前搜索设置不可写。",
        searchSaveFailed: "搜索设置保存失败，已保留 Host 当前值。",
        modelsTitle: "当前账号可用的模型", modelsDescription: "模型来自 Grok Build 动态目录；Harness 模型选择器会显示这里列出的全部模型。",
        modelsUnavailable: "暂时无法读取模型目录。", noModels: "当前账号没有返回可用模型。",
        context: "上下文", reasoning: "推理档位", defaultEffort: "默认", text: "文本输入", image: "图片输入", streaming: "流式输出", tools: "工具调用",
        lastUpdated: "数据更新时间",
      },
      en: {
        nav: "Grok Build", title: "Grok Build",
        description: "Manage official Grok Build sign-in, account quota, and models available to this account. Sensitive credentials never reach this page.",
        loopback: "Account management is available only from the local page.", loading: "Reading account status…", unavailable: "The account service is temporarily unavailable.",
        ready: "Signed in", notReady: "Signed out", driverMissing: "Official CLI sign-in unavailable",
        running: "Sign-in in progress", succeeded: "Signed in", failed: "Sign-in failed", cancelled: "Sign-in cancelled",
        cliMissingTitle: "Grok Build CLI could not be found", cliMissingBody: "Install Grok Build CLI from the official guide, then check again.",
        cliInvalidTitle: "Grok Build CLI could not be verified", cliInvalidBody: "The CLI at the default path failed its version or safety check. Update or reinstall it from the official source.",
        diagnosticsUnavailableTitle: "Unable to detect Grok Build CLI", diagnosticsUnavailableBody: "Local CLI detection is temporarily unavailable. Check again in a moment.",
        officialInstall: "Open official install guide", redetect: "Check again", providerVersion: "Plugin version", cliVersion: "Grok Build version",
        versionUnknown: "unknown", cliNotDetected: "not detected", cliUnavailable: "unavailable",
        authNetworkTimeout: "Cannot reach the sign-in service", authNetworkTimeoutBody: "The xAI sign-in service could not be reached, so browser sign-in has not started. Check the local network, proxy, firewall, or VPN, then retry.",
        loginTimeout: "Sign-in timed out", loginTimeoutBody: "The official CLI did not complete browser authorization within five minutes. Confirm the browser callback, then retry.",
        cliFailedBody: "The official Grok Build CLI sign-in failed. Run grok login --oauth in a terminal to verify it, then retry.",
        runningBody: "Connecting to the xAI sign-in service. The official CLI will open a browser after it creates the sign-in URL. You can cancel at any time.",
        login: "Sign in with browser", cancel: "Cancel sign-in", logout: "Sign out", confirmLogout: "Click again to confirm sign-out",
        officialBody: "The official local Grok CLI owns sign-in and credential refresh. Signing in replaces the shared session; signing out clears it, affecting other apps that share the same Grok credential.",
        usage: "Usage quota", grokBuild: "Grok Build", refresh: "Refresh", refreshing: "Refreshing…",
        weekly: "Weekly quota", monthly: "Monthly quota", currentPeriod: "Current quota period",
        remaining: "remaining", used: "Used", resetTime: "Resets", resetUnknown: "Reset time was not provided",
        usageUnknown: "Usage percentage was not provided", quotaUnavailable: "Grok Build quota is temporarily unavailable.",
        searchTitle: "Online Search", searchDescription: "Off by default. These settings independently allow regular Grok requests to use xAI remote search. Only exact grok-4.6 is supported; other models fail closed. Background summaries and conversation titles do not use Search.",
        webSearch: "Web Search", webSearchDescription: "Allows xAI to remotely query public web pages from the conversation and generated search terms, which may incur additional usage.",
        xSearch: "X Search", xSearchDescription: "Allows xAI to remotely query X posts, users, and threads from the conversation and generated search terms, which may incur additional usage.",
        searchRisk: "Search results and citations are untrusted remote content and may contain errors or prompt injection. Verify sources before sensitive actions; the plugin does not open or download citation links.",
        searchEnabled: "On", searchDisabled: "Off", searchLoading: "Reading Search settings…",
        searchUnavailable: "Search settings are temporarily unavailable. Controls are disabled and no unknown value will be written.", searchReadOnly: "Search settings are currently read-only.",
        searchSaveFailed: "Search settings could not be saved. The current Host value was preserved.",
        modelsTitle: "Models available to this account", modelsDescription: "Models come from the live Grok Build catalog; every model listed here remains visible in the Harness model selector.",
        modelsUnavailable: "The model catalog is temporarily unavailable.", noModels: "This account returned no available models.",
        context: "Context", reasoning: "Reasoning", defaultEffort: "default", text: "Text input", image: "Image input", streaming: "Streaming", tools: "Tool calling",
        lastUpdated: "Updated",
      },
    }

    function decodeSearchConfig(value) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
      const webSearch = Object.getOwnPropertyDescriptor(value, "webSearch")
      const xSearch = Object.getOwnPropertyDescriptor(value, "xSearch")
      if (
        !webSearch || !("value" in webSearch) || typeof webSearch.value !== "boolean"
        || !xSearch || !("value" in xSearch) || typeof xSearch.value !== "boolean"
      ) return undefined
      return Object.freeze({ webSearch: webSearch.value, xSearch: xSearch.value })
    }

    const navIconMarker = "data-dsh-grok-provider-nav-icon"
    const navIconStyleSelector = 'style[data-plugin-nav-icon="dsh-grok-provider"]'
    const navIconStateKey = Symbol.for("dsh-grok-provider.settings-nav-icon.v1")
    const navIconLabels = new Set(Object.values(dictionaries).map((dictionary) => dictionary.nav.trim()))
    const settingsDialogSelector = '[role="dialog"][aria-modal="true"]'
    const settingsNavSelector = `${settingsDialogSelector} > nav`
    const settingsNavButtonSelector = `${settingsNavSelector} button`
    // IconThinkOutline16 geometry from @deepseek-ai/dsh-client-ui-primitives@0.1.0-rc.7 (MIT); see THIRD_PARTY_NOTICES.md.
    // settings.section has no icon slot in Harness 0.1.1-rc.2, so the glyph is applied as a scoped mask.
    const thinkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <path d="M8.00192 6.64454C8.75026 6.64454 9.35732 7.25169 9.35739 8.00001C9.35739 8.74838 8.7503 9.35548 8.00192 9.35548C7.25367 9.35533 6.64743 8.74829 6.64743 8.00001C6.6475 7.25178 7.25371 6.64468 8.00192 6.64454Z"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981ZM12.9404 9.2129C12.4391 9.893 11.8616 10.5681 11.2148 11.2149C10.568 11.8616 9.89296 12.4391 9.21286 12.9404C9.62532 13.1579 10.0271 13.338 10.4121 13.4766C11.9146 14.0174 12.9172 13.8738 13.3955 13.3955C13.8737 12.9173 14.0174 11.9146 13.4765 10.4121C13.3379 10.0271 13.1578 9.62535 12.9404 9.2129ZM3.05856 9.2129C2.84121 9.62523 2.66197 10.0272 2.52341 10.4121C1.98252 11.9146 2.12627 12.9172 2.60446 13.3955C3.08278 13.8737 4.08544 14.0174 5.58786 13.4766C5.97264 13.338 6.37389 13.1577 6.7861 12.9404C6.10624 12.4393 5.43168 11.8614 4.78513 11.2149C4.13823 10.5679 3.55992 9.89313 3.05856 9.2129ZM7.99899 3.792C7.23179 4.31419 6.45306 4.95512 5.70407 5.70411C4.95509 6.45309 4.31415 7.23184 3.79196 7.99903C4.3143 8.76666 4.95471 9.54653 5.70407 10.2959C6.45309 11.0449 7.23271 11.6848 7.99997 12.207C8.76725 11.6848 9.54683 11.0449 10.2959 10.2959C11.0449 9.54686 11.6848 8.76729 12.207 8.00001C11.6848 7.23275 11.0449 6.45312 10.2959 5.70411C9.5465 4.95475 8.76662 4.31434 7.99899 3.792ZM5.58786 2.52344C4.08533 1.98255 3.08272 2.12625 2.60446 2.6045C2.12621 3.08275 1.98252 4.08536 2.52341 5.5879C2.66189 5.97253 2.8414 6.37409 3.05856 6.78614C3.55983 6.10611 4.1384 5.43189 4.78513 4.78516C5.43186 4.13843 6.10606 3.55987 6.7861 3.0586C6.37405 2.84144 5.97249 2.66192 5.58786 2.52344ZM13.3955 2.6045C12.9172 2.12631 11.9146 1.98257 10.4121 2.52344C10.0272 2.66201 9.62519 2.84125 9.21286 3.0586C9.8931 3.55996 10.5679 4.13827 11.2148 4.78516C11.8614 5.43172 12.4392 6.10627 12.9404 6.78614C13.1577 6.37393 13.338 5.97267 13.4765 5.5879C14.0174 4.08549 13.8736 3.08281 13.3955 2.6045Z"/>
    </svg>`
    const thinkIconMask = `data:image/svg+xml,${encodeURIComponent(thinkIconSvg).replace(/[!'()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`
    const navIconCss = `
      [${navIconMarker}]>svg:first-child{display:none!important}
      [${navIconMarker}]::before{content:"";width:16px;height:16px;flex:none;background:currentColor;-webkit-mask:url("${thinkIconMask}") center/contain no-repeat;mask:url("${thinkIconMask}") center/contain no-repeat}
    `

    function installSettingsNavIcon() {
      const Observer = typeof window.MutationObserver === "function"
        ? window.MutationObserver
        : typeof MutationObserver === "function" ? MutationObserver : undefined
      if (!document.body || typeof document.querySelectorAll !== "function" || Observer === undefined) return () => {}

      const isInsideSettingsNav = (target) => {
        const element = target?.nodeType === 1 ? target : target?.parentElement
        return typeof element?.closest === "function" && element.closest(settingsNavSelector) !== null
      }
      const matchesOrContains = (node, selector) => (
        (typeof node?.matches === "function" && node.matches(selector))
        || (typeof node?.querySelector === "function" && node.querySelector(selector) !== null)
      )
      const mutationTouchesSettingsNav = (records) => Array.from(records ?? []).some((record) => {
        if (isInsideSettingsNav(record.target)) return true
        return [...Array.from(record.addedNodes ?? []), ...Array.from(record.removedNodes ?? [])]
          .some((node) => matchesOrContains(node, settingsDialogSelector) || matchesOrContains(node, settingsNavSelector))
      })
      const enqueueMicrotask = typeof window.queueMicrotask === "function"
        ? (callback) => window.queueMicrotask(callback)
        : (callback) => Promise.resolve().then(callback)

      let state = window[navIconStateKey]
      if (state === undefined) {
        let style = document.querySelector(navIconStyleSelector)
        if (style === null) {
          style = document.createElement("style")
          style.dataset.pluginNavIcon = "dsh-grok-provider"
          document.head.appendChild(style)
        }
        style.dataset.plugin = "dsh-grok-provider"
        const clearMarkers = () => {
          for (const button of document.querySelectorAll(`[${navIconMarker}]`)) button.removeAttribute(navIconMarker)
        }
        state = {
          active: true,
          refs: 0,
          scheduled: false,
          style,
          clearMarkers,
          scheduleSync() {
            if (!state.active || state.scheduled) return
            state.scheduled = true
            enqueueMicrotask(() => {
              state.scheduled = false
              state.sync()
            })
          },
          sync() {
            if (!state.active) return
            clearMarkers()
            const candidates = []
            for (const button of document.querySelectorAll(settingsNavButtonSelector)) {
              const icon = button.firstElementChild
              const labelElement = icon?.nextElementSibling
              if (icon?.localName !== "svg" || labelElement?.localName !== "span") continue
              const label = String(labelElement.textContent ?? "").replace(/\s+/gu, " ").trim()
              if (navIconLabels.has(label)) candidates.push(button)
            }
            if (candidates.length === 1) candidates[0].setAttribute(navIconMarker, "")
          },
        }
        state.observer = new Observer((records) => {
          if (mutationTouchesSettingsNav(records)) state.scheduleSync()
        })
        state.observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        window[navIconStateKey] = state
      }

      state.refs += 1
      state.style.textContent = navIconCss
      state.sync()
      let active = true
      return () => {
        if (!active) return
        active = false
        if (window[navIconStateKey] !== state) return
        state.refs -= 1
        if (state.refs > 0) return
        state.active = false
        state.observer.disconnect()
        state.clearMarkers()
        state.style.remove()
        delete window[navIconStateKey]
      }
    }

    const css = `
      .dsh-grok-page{box-sizing:border-box;width:min(920px,100%);padding:8px 4px 40px;color:var(--dsw-alias-label-primary)}
      .dsh-grok-page *{box-sizing:border-box}.dsh-grok-page h2{margin:0;font-size:21px;line-height:31px}.dsh-grok-description{max-width:760px;margin:5px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:21px}
      .dsh-grok-stack{display:grid;gap:14px}.dsh-grok-panel{overflow:hidden;border:1px solid rgb(190 93 138 / 28%);border-radius:18px;background:linear-gradient(145deg,rgb(190 93 138 / 8%),rgb(190 93 138 / 3%) 55%,var(--dsw-alias-bg-layer-1));box-shadow:0 1px 2px rgb(20 20 30 / 3%)}
      .dsh-grok-panel-inner{padding:20px}.dsh-grok-account-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.dsh-grok-state{display:flex;min-width:0;align-items:center;gap:10px;font-size:17px;font-weight:650}.dsh-grok-dot{width:10px;height:10px;flex:0 0 auto;border-radius:50%;background:var(--dsw-alias-label-tertiary,#909090)}.dsh-grok-dot[data-good="true"]{background:var(--dsw-static-green-500,#1ebf68);box-shadow:0 0 0 4px rgb(30 191 104 / 10%)}.dsh-grok-dot[data-running="true"]{background:#d99b2b;box-shadow:0 0 0 4px rgb(217 155 43 / 12%)}
      .dsh-grok-button{height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 14px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;font:inherit;font-size:12px}.dsh-grok-button:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.dsh-grok-button:disabled{cursor:default;opacity:.45}.dsh-grok-primary{border-color:var(--dsw-static-deepseek-500,#4d6bfe);color:#fff;background:var(--dsw-static-deepseek-500,#4d6bfe)}
      .dsh-grok-auth-note{margin:13px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}.dsh-grok-actions{display:flex;flex-wrap:wrap;gap:7px}
      .dsh-grok-runtime{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;line-height:18px}.dsh-grok-runtime strong{color:var(--dsw-alias-label-secondary);font-weight:600}.dsh-grok-install{margin-top:13px;padding:12px 13px;border:1px solid rgb(217 155 43 / 30%);border-radius:11px;background:rgb(217 155 43 / 8%)}.dsh-grok-install strong{display:block;font-size:12px}.dsh-grok-install p{margin:4px 0 10px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}.dsh-grok-link{display:inline-flex;align-items:center;height:32px;border-radius:999px;padding:0 12px;color:var(--dsw-static-deepseek-500,#4d6bfe);text-decoration:none;background:rgb(77 107 254 / 8%);font-size:11px}.dsh-grok-link:hover{text-decoration:underline}
      .dsh-grok-divider{height:1px;margin:18px 0;background:rgb(190 93 138 / 20%)}.dsh-grok-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.dsh-grok-section-head h3{margin:0;font-size:15px;line-height:23px}.dsh-grok-section-head .dsh-grok-button{height:30px;padding:0 11px}
      .dsh-grok-quota{margin-top:15px}.dsh-grok-quota-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px;color:var(--dsw-alias-label-secondary);font-size:13px}.dsh-grok-quota-name{color:var(--dsw-alias-label-primary);font-weight:600}.dsh-grok-progress{height:9px;overflow:hidden;border-radius:999px;background:rgb(190 93 138 / 13%)}.dsh-grok-progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#d7448a,#ea1768);transition:width .25s ease}.dsh-grok-quota-meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:7px;margin-top:9px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dsh-grok-muted{margin:12px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
      .dsh-grok-search-head h3{margin:0;font-size:16px;line-height:24px}.dsh-grok-search-head p{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}.dsh-grok-search-list{margin-top:14px;border-top:1px solid rgb(190 93 138 / 18%)}.dsh-grok-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:18px;padding:14px 0;border-bottom:1px solid rgb(190 93 138 / 18%)}.dsh-grok-search-copy strong{display:block;font-size:13px;line-height:20px}.dsh-grok-search-copy p{margin:3px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}.dsh-grok-switch{position:relative;width:44px;height:25px;flex:none;border:0;border-radius:999px;padding:0;background:var(--dsw-alias-interactive-bg-hover);cursor:pointer;transition:background .18s ease}.dsh-grok-switch::after{content:"";position:absolute;top:3px;left:3px;width:19px;height:19px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 3px rgb(0 0 0 / 18%);transition:transform .18s ease}.dsh-grok-switch[data-checked="true"]{background:var(--dsw-static-deepseek-500,#4d6bfe)}.dsh-grok-switch[data-checked="true"]::after{transform:translateX(19px)}.dsh-grok-switch:disabled{cursor:default;opacity:.48}.dsh-grok-search-risk{margin:13px 0 0;padding:11px 12px;border-radius:10px;color:var(--dsw-alias-label-secondary);background:rgb(217 155 43 / 8%);font-size:11px;line-height:18px}.dsh-grok-search-status{margin:11px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}.dsh-grok-visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;clip-path:inset(50%)}
      .dsh-grok-models-head{padding:20px 20px 0}.dsh-grok-models-head h3{margin:0;font-size:16px;line-height:24px}.dsh-grok-models-head p{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}.dsh-grok-model-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px 20px 20px}.dsh-grok-model{min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:13px;padding:14px;background:var(--dsw-alias-bg-layer-1)}.dsh-grok-model-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.dsh-grok-model-title strong{overflow-wrap:anywhere;font-size:14px}.dsh-grok-model-id{overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px}.dsh-grok-model-description{margin:5px 0 10px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}.dsh-grok-badges{display:flex;flex-wrap:wrap;gap:5px}.dsh-grok-badge{border-radius:999px;padding:2px 8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);font-size:10px;line-height:18px}.dsh-grok-badge[data-accent="true"]{color:#a9326b;background:rgb(215 68 138 / 11%)}.dsh-grok-efforts{margin-top:10px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:17px}.dsh-grok-footer{padding:0 20px 16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:10px}
      .dsh-grok-notice{padding:13px 14px;border:1px solid rgb(229 72 77 / 28%);border-radius:11px;color:var(--dsw-alias-label-secondary);background:rgb(229 72 77 / 7%);font-size:12px;line-height:19px}.dsh-grok-error{margin:10px 0 0;color:var(--dsw-static-red-500,#e5484d);font-size:12px;line-height:19px}
      @media(max-width:680px){.dsh-grok-panel-inner,.dsh-grok-models-head{padding:16px}.dsh-grok-model-grid{grid-template-columns:1fr;padding:14px 16px 16px}.dsh-grok-account-head{align-items:flex-start;flex-direction:column}.dsh-grok-quota-row{align-items:flex-start;flex-direction:column;gap:3px}}
    `
    if (!document.querySelector('style[data-plugin-css="dsh-grok-provider"]')) {
      const style = document.createElement("style")
      style.dataset.pluginCss = "dsh-grok-provider"
      style.textContent = css
      document.head.appendChild(style)
    }

    function GrokSettings({ connection, t, searchSettings }) {
      const [status, setStatus] = React.useState()
      const [dashboard, setDashboard] = React.useState()
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(false)
      const [dashboardError, setDashboardError] = React.useState(false)
      const [confirmLogout, setConfirmLogout] = React.useState(false)
      const [diagnostics, setDiagnostics] = React.useState()
      const [diagnosticsError, setDiagnosticsError] = React.useState(false)
      const [statusEpoch] = React.useState(() => ({ value: 0 }))
      const [diagnosticsEpoch] = React.useState(() => ({ value: 0 }))
      const [searchSnapshot, setSearchSnapshot] = React.useState(() => searchSettings.getSnapshot())
      const [searchSaving, setSearchSaving] = React.useState()
      const [searchSaveError, setSearchSaveError] = React.useState(false)
      const [searchWrite] = React.useState(() => ({ field: undefined }))
      React.useEffect(() => {
        let active = true
        const publish = () => {
          if (active) setSearchSnapshot(searchSettings.getSnapshot())
        }
        const unsubscribe = searchSettings.subscribe(publish)
        publish()
        return () => {
          active = false
          unsubscribe()
        }
      }, [searchSettings])
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
      const refreshDiagnostics = React.useCallback(async () => {
        const requestEpoch = diagnosticsEpoch.value + 1
        diagnosticsEpoch.value = requestEpoch
        try {
          const value = await call("diagnostics")
          if (diagnosticsEpoch.value !== requestEpoch) return { kind: "stale" }
          setDiagnostics(value.diagnostics)
          setDiagnosticsError(false)
          return { kind: "diagnostics", diagnostics: value.diagnostics }
        } catch {
          if (diagnosticsEpoch.value !== requestEpoch) return { kind: "stale" }
          setDiagnostics(undefined)
          setDiagnosticsError(true)
          return { kind: "error" }
        }
      }, [call, diagnosticsEpoch])
      const refreshStatus = React.useCallback(async ({ includeDashboard = false, diagnosticsOnSettlement = false, isCurrent } = {}) => {
        const requestEpoch = statusEpoch.value
        const canWrite = () => statusEpoch.value === requestEpoch && (typeof isCurrent !== "function" || isCurrent())
        try {
          const value = await call("status")
          if (!canWrite()) return { kind: "stale" }
          setStatus(value.status)
          setError(false)
          if (value.status.available === true && includeDashboard) await refreshDashboard()
          if (value.status.available !== true) setDashboard(undefined)
          if (diagnosticsOnSettlement && value.status.session?.state !== "running") {
            refreshDiagnostics()
          }
          return { kind: "status", status: value.status }
        } catch {
          if (!canWrite()) return { kind: "stale" }
          setError(true)
          return { kind: "error" }
        }
      }, [call, refreshDashboard, refreshDiagnostics, statusEpoch])
      React.useEffect(() => {
        let active = true
        refreshStatus({ includeDashboard: true, isCurrent: () => active })
        refreshDiagnostics()
        return () => {
          active = false
          statusEpoch.value += 1
          diagnosticsEpoch.value += 1
        }
      }, [diagnosticsEpoch, refreshDiagnostics, refreshStatus, statusEpoch])
      React.useEffect(() => {
        if (status?.session?.state !== "running") return undefined
        let active = true
        let timer
        const schedule = () => {
          timer = window.setTimeout(() => { void poll() }, 1_000)
        }
        const poll = async () => {
          const result = await refreshStatus({ diagnosticsOnSettlement: true, isCurrent: () => active })
          if (!active) return
          if (result?.kind === "stale") { schedule(); return }
          if (result?.kind === "error" || result?.status?.session?.state === "running") schedule()
        }
        schedule()
        return () => {
          active = false
          if (timer !== undefined) window.clearTimeout(timer)
        }
      }, [refreshStatus, status?.generation, status?.session?.sessionId, status?.session?.state])
      React.useEffect(() => {
        if (status?.available === true && status?.session?.state === "succeeded") refreshDashboard()
      }, [refreshDashboard, status?.available, status?.session?.state])
      const act = async (operation) => {
        setBusy(true); setError(false)
        try { await operation() } catch { setError(true) } finally { setBusy(false) }
      }
      const login = () => act(async () => {
        statusEpoch.value += 1
        const value = await call("login")
        if (
          value?.kind !== "login-started" ||
          value.status?.state !== "running" ||
          typeof value.status.sessionId !== "string"
        ) throw new Error("Invalid Grok login start response")
        setConfirmLogout(false)
        setStatus((current) => ({ ...(current ?? {}), session: value.status }))
        setError(false)
        await refreshStatus({ diagnosticsOnSettlement: true })
      })
      const cancel = () => act(async () => {
        const sessionId = status?.session?.sessionId
        if (typeof sessionId !== "string") throw new Error("No active Grok login")
        statusEpoch.value += 1
        await call("cancel", { sessionId }); await refreshStatus({ includeDashboard: true, diagnosticsOnSettlement: true })
      })
      const logout = () => act(async () => {
        statusEpoch.value += 1
        const value = await call("logout")
        if (value.kind === "logout-confirmation-required") setConfirmLogout(true)
        else { setConfirmLogout(false); setDashboard(undefined); await refreshStatus() }
      })
      const redetect = () => act(refreshDiagnostics)
      const manualRefresh = () => act(async () => {
        statusEpoch.value += 1
        await Promise.all([refreshStatus({ includeDashboard: true }), refreshDiagnostics()])
      })
      const updateSearchSetting = async (field, enabled) => {
        const current = searchSettings.getSnapshot()
        if (
          current.status !== "ready" || current.writable !== true
          || typeof current.value?.[field] !== "boolean" || current.value[field] === enabled
          || searchWrite.field !== undefined
        ) return
        searchWrite.field = field
        setSearchSaving(field)
        setSearchSaveError(false)
        try {
          await searchSettings.set(field, enabled)
          const settled = searchSettings.getSnapshot()
          if (
            settled.status !== "ready"
            || typeof settled.value?.[field] !== "boolean"
            || settled.value[field] !== enabled
          ) setSearchSaveError(true)
        } catch {
          setSearchSaveError(true)
        } finally {
          searchWrite.field = undefined
          setSearchSaving(undefined)
        }
      }

      if (!connection.isLoopback) return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-notice" }, t("loopback")))
      if (!status && !error) return React.createElement("section", { className: "dsh-grok-page" }, t("loading"))

      const driver = status?.driver === true
      const available = status?.available === true
      const sessionState = status?.session?.state
      const failureReason = status?.session?.reason
      const cliState = diagnostics?.cli?.state
      const cliReady = cliState === "ready"
      const failureIsCurrent = sessionState === "failed" && !(
        cliReady && (failureReason === "cli-missing" || failureReason === "cli-invalid")
      )
      const stateLabel = sessionState === "running" ? t("running")
        : available ? t(sessionState === "succeeded" ? "succeeded" : "ready")
          : !driver ? t("driverMissing")
            : failureIsCurrent && failureReason === "auth-network-timeout" ? t("authNetworkTimeout")
              : failureIsCurrent && failureReason === "login-timeout" ? t("loginTimeout")
                : failureIsCurrent && failureReason === "cli-missing" ? t("cliMissingTitle")
                  : failureIsCurrent && failureReason === "cli-invalid" ? t("cliInvalidTitle")
                    : failureIsCurrent ? t("failed") : sessionState === "cancelled" ? t("cancelled")
                      : cliState === "missing" ? t("cliMissingTitle")
                        : cliState === "invalid" ? t("cliInvalidTitle") : t("notReady")
      const failureBody = available || !failureIsCurrent ? undefined
        : failureReason === "auth-network-timeout" ? t("authNetworkTimeoutBody")
          : failureReason === "login-timeout" ? t("loginTimeoutBody")
            : failureReason === "cli-missing" ? t("cliMissingBody")
              : failureReason === "cli-invalid" ? t("cliInvalidBody") : t("cliFailedBody")
      const cliVersion = cliReady ? diagnostics.cli.version : cliState === "missing" ? t("cliNotDetected")
        : cliState === "invalid" || cliState === "unavailable" ? t("cliUnavailable") : t("versionUnknown")

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
            model.capabilities?.imageInput && React.createElement("span", { className: "dsh-grok-badge" }, t("image")),
            model.capabilities?.streaming && React.createElement("span", { className: "dsh-grok-badge" }, t("streaming")),
            model.capabilities?.functionTools && React.createElement("span", { className: "dsh-grok-badge" }, t("tools"))),
          effortText && React.createElement("div", { className: "dsh-grok-efforts" }, `${t("reasoning")}：${effortText}`))
      }

      const searchReady = searchSnapshot.status === "ready"
      const searchWritable = searchReady && searchSnapshot.writable === true
      const searchStatus = searchSnapshot.status === "loading" ? t("searchLoading")
        : searchSnapshot.status !== "ready" ? t("searchUnavailable")
          : !searchWritable ? t("searchReadOnly") : undefined
      const renderSearchSetting = (field, labelKey, descriptionKey) => {
        const enabled = searchReady && searchSnapshot.value?.[field] === true
        const disabled = !searchWritable || searchSaving !== undefined
        return React.createElement("div", { className: "dsh-grok-search-row", key: field },
          React.createElement("div", { className: "dsh-grok-search-copy" },
            React.createElement("strong", null, t(labelKey)),
            React.createElement("p", null, t(descriptionKey))),
          React.createElement("button", {
            className: "dsh-grok-switch", type: "button", role: "switch",
            "aria-checked": enabled, "aria-label": `${t(labelKey)}：${t(enabled ? "searchEnabled" : "searchDisabled")}`,
            "data-checked": enabled, disabled, onClick: () => updateSearchSetting(field, !enabled),
          }, React.createElement("span", { className: "dsh-grok-visually-hidden" }, t(enabled ? "searchEnabled" : "searchDisabled"))))
      }

      const models = dashboard?.models
      return React.createElement("section", { className: "dsh-grok-page" },
        React.createElement("h2", null, t("title")), React.createElement("p", { className: "dsh-grok-description" }, t("description")),
        React.createElement("div", { className: "dsh-grok-stack" },
          React.createElement("article", { className: "dsh-grok-panel" }, React.createElement("div", { className: "dsh-grok-panel-inner" },
            React.createElement("div", { className: "dsh-grok-account-head" },
              React.createElement("div", { className: "dsh-grok-state", role: "status", "aria-live": "polite" }, React.createElement("span", { className: "dsh-grok-dot", "data-good": available, "data-running": sessionState === "running" }), stateLabel),
              React.createElement("div", { className: "dsh-grok-actions" },
                sessionState === "running"
                  ? React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy, onClick: cancel }, t("cancel"))
                  : !available && React.createElement("button", { className: "dsh-grok-button dsh-grok-primary", type: "button", disabled: busy || !driver || !cliReady, onClick: login }, t("login")),
                available && React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy || !driver, onClick: logout }, t(confirmLogout ? "confirmLogout" : "logout")))),
            React.createElement("p", { className: "dsh-grok-auth-note" }, t("officialBody")),
            sessionState === "running" && React.createElement("p", { className: "dsh-grok-auth-note" }, t("runningBody")),
            failureBody && React.createElement("p", { className: "dsh-grok-error" }, failureBody),
            React.createElement("div", { className: "dsh-grok-runtime" },
              React.createElement("span", null, `${t("providerVersion")} `, React.createElement("strong", null, diagnostics?.pluginVersion ?? t("versionUnknown"))),
              React.createElement("span", null, `${t("cliVersion")} `, React.createElement("strong", null, cliVersion))),
            (cliState === "missing" || cliState === "invalid") && React.createElement("div", { className: "dsh-grok-install", role: "status", "aria-live": "polite" },
              React.createElement("strong", null, t(cliState === "missing" ? "cliMissingTitle" : "cliInvalidTitle")),
              React.createElement("p", null, t(cliState === "missing" ? "cliMissingBody" : "cliInvalidBody")),
              React.createElement("div", { className: "dsh-grok-actions" },
                React.createElement("a", { className: "dsh-grok-link", href: "https://docs.x.ai/build/overview", target: "_blank", rel: "noreferrer" }, t("officialInstall")),
                React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy, onClick: redetect }, t("redetect")))),
            (diagnosticsError || cliState === "unavailable") && React.createElement("div", { className: "dsh-grok-install", role: "status", "aria-live": "polite" },
              React.createElement("strong", null, t("diagnosticsUnavailableTitle")),
              React.createElement("p", null, t("diagnosticsUnavailableBody")),
              React.createElement("div", { className: "dsh-grok-actions" },
                React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy, onClick: redetect }, t("redetect")))),
            React.createElement("div", { className: "dsh-grok-divider" }),
            React.createElement("div", { className: "dsh-grok-section-head" }, React.createElement("h3", null, t("usage")),
              React.createElement("button", { className: "dsh-grok-button", type: "button", disabled: busy || !available, onClick: manualRefresh }, busy ? t("refreshing") : t("refresh"))),
            renderQuota(), error && React.createElement("p", { className: "dsh-grok-error" }, t("unavailable")))),
          React.createElement("article", { className: "dsh-grok-panel" }, React.createElement("div", { className: "dsh-grok-panel-inner" },
            React.createElement("div", { className: "dsh-grok-search-head" },
              React.createElement("h3", null, t("searchTitle")), React.createElement("p", null, t("searchDescription"))),
            React.createElement("div", { className: "dsh-grok-search-list" },
              renderSearchSetting("webSearch", "webSearch", "webSearchDescription"),
              renderSearchSetting("xSearch", "xSearch", "xSearchDescription")),
            React.createElement("p", { className: "dsh-grok-search-risk" }, t("searchRisk")),
            searchStatus && React.createElement("p", { className: "dsh-grok-search-status", role: "status", "aria-live": "polite" }, searchStatus),
            searchSaveError && React.createElement("p", { className: "dsh-grok-error", role: "alert" }, t("searchSaveFailed")))),
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

    const inject = ["slots", "locale", "connection", "settingsScope"]
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(namespace, dictionaries), "dsh-grok: dictionaries")
      ctx.effect(() => installSettingsNavIcon(), "dsh-grok: settings nav icon")
      const t = ctx.locale.bind(namespace)
      const searchSettings = ctx.settingsScope.bind({ namespace: "llm-grok", decode: decodeSearchConfig })
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section", id: "grok-auth", order: 45, label: () => t("nav"), locale: namespace,
        inject: () => ({ connection: ctx.connection, t, searchSettings }),
      }, GrokSettings))
    }
    module.exports.inject = inject
    module.exports.apply = apply
    return module.exports
  },
})

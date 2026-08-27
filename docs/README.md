# Grok Build Provider 文档索引

- 状态：**稳定版 `0.1.3`：跨 Provider 工具调用历史兼容性修正**
- 当前稳定版本：`0.1.3`
- 下一版本分支：`yukiryou/v0.1.4`
- 兼容基线：DeepSeek Harness `0.1.1-rc.2`
- 目标平台：macOS arm64、Windows x64

本仓库是一次 clean-room 重写。设计只依据 DeepSeek Harness 的公开接口、xAI 官方 Grok Build 文档和通用协议标准；不会复制、移植或修改 `dsh-llm-grok` 的源码、目录结构或实现细节。

## 推荐结论

首版采用单一认证路线：插件发起官方 Grok Build CLI 浏览器登录并复用由官方 CLI 持久化的会话。插件不注册独立 OAuth client，也不持久化第二份 token。

1. 用户在 Harness 设置页点击“使用 Grok 登录”，或在 TUI 输入 `/grok login`。
2. 插件 Host 通过 Harness `ctx.subprocess` 以固定 argv 启动经路径、能力与凭据契约约束的 Grok CLI 候选；该启动层不经过 shell。标准配置下由官方 CLI 完成系统浏览器、OAuth、loopback callback 和凭据写入。
3. 插件只读官方凭据文件并接受绑定 schema；token 不进入 renderer、settings、RPC、本插件日志或 workspace。
4. 模型目录只请求固定 `GET /v1/models`；推理按目录中经过验证的 `api_backend` 选择闭合 endpoint。当前真实模型都走固定 `POST /v1/responses`；拒绝重定向和自定义 endpoint。
5. 模型目录从固定 `/v1/models` 动态发现账号当前可用的全部 Grok Build 模型；本机当前快照为 `grok-4.6` 与 `grok-4.5`。
6. 包内不存在 OAuth client ID、client secret、device flow、插件实现的 refresh/revoke 或 Harness credential grant；浏览器登录、refresh grant 与持久化完全由官方 CLI 负责。

该路径要求本机安装受支持版本的官方 CLI。仓库所有者在 2026-08-26 将“插件自管 OAuth”要求改为“能跳转浏览器登录即可”，详见 ADR-0005。

安全边界需要说清楚：`--oauth` 只选择 loopback 浏览器 transport，不会强制官方 CLI 忽略其有效配置。官方 CLI 可能按用户/企业配置运行外部认证命令（其内部可使用 `sh -c` 或 `cmd /C`）或企业 OIDC。因此“无 shell”只适用于本插件到 CLI 的启动层，不是端到端保证。`0.1.0` 把官方 CLI 及其有效配置视为用户管理的可信组件，并在读取凭据后失败关闭：外部 provider、API key、企业 issuer、旧式或歧义记录都不允许进入固定 xAI Proxy。该本地 metadata 未签名，所以这是严格兼容性筛选，不是密码学来源证明。

还需接受这些共享副作用和残余风险：官方 login 可能先清除已有 credential，取消或失败也可能使旧会话失效；logout 会影响所有共享同一 `GROK_HOME` 的应用。官方 CLI 的 proxy、managed-config sync、更新检查与已启用遥测不受插件固定推理 transport 约束。当前第一方 token 可能具有 conversation/workspace read-write 等较宽 scope，泄漏影响不只一次聊天。Web `loopback` RPC 是浏览器 reachability/trust fence，不是本机进程身份认证；同一 OS 用户下的恶意进程不在本插件可防御边界内。

## 文档顺序

- [产品需求](./01-product-requirements.md)
- [架构候选与推荐路线](./02-architecture-options.md)
- [安全与威胁模型](./03-security-threat-model.md)
- [Harness rc.2 接口契约](./04-harness-contract.md)
- [兼容性与测试计划](./05-test-plan.md)
- [npm 发布计划与维护流程](./06-release-plan.md)
- [开发前决策门](./07-decision-gate.md)
- [Grok CLI 1.0.5 上游证据](./08-upstream-cli-1.0.5-evidence.md)
- [当前实现与发布状态](./09-implementation-status.md)
- [逐版发布检查表](./10-release-checklist.md)
- [v0.1.1 中英双语发行说明](./releases/v0.1.1.md)
- [v0.1.2 中英双语发行说明](./releases/v0.1.2.md)
- [v0.1.3 中英双语发行说明](./releases/v0.1.3.md)
- [v0.1.2-rc.1 中英双语预发行说明](./releases/v0.1.2-rc.1.md)
- [ADR-0001：认证与传输路线](./adr/0001-auth-and-transport-route.md)
- [ADR-0002：首版能力边界](./adr/0002-v0.1-scope.md)
- [ADR-0003：已被取代的双认证设计](./adr/0003-dual-authentication.md)
- [ADR-0004：动态全模型目录](./adr/0004-dynamic-model-catalog.md)
- [ADR-0005：官方 CLI 单一认证路径](./adr/0005-official-cli-only-authentication.md)
- [ADR-0006：账户额度与模型能力面板](./adr/0006-account-dashboard.md)
- [ADR-0007：以能力与凭据契约判断 CLI 兼容性](./adr/0007-capability-based-cli-compatibility.md)

## 开发门禁

`0.1.2-rc.1` 是唯一一次预发行尝试。仓库所有者决定从稳定 `0.1.2` 起不再发行预发行版；正式版缺陷通过新的递增稳定版本修复。`0.1.3` 不改动认证、CLI subprocess 或平台安全边界，因此按政策以自动化回归、双平台 CI、制品与隔离安装为门禁，不重复要求跨平台真机验收。每个版本仍须先完成[逐版发布检查表](./10-release-checklist.md)，再由仓库所有者明确授权发布。

## 官方依据

- [xAI Grok Build 官方仓库](https://github.com/xai-org/grok-build)
- [Grok Build 官方 billing extension：额度比例、周期与固定 CLI Proxy 请求](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/extensions/billing.rs)
- [Grok Build 官方 README：认证、auth.json API 调用、Headless 与 ACP](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/README.md)
- [Grok Build 官方认证指南：browser login 与凭据边界](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/02-authentication.md)
- [`dsh-codex`：Web/TUI 登录体验参考，不作为代码来源](https://github.com/Yan-Zero/dsh-codex)
- [RFC 8252：Native Apps OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8252)
- [RFC 9700：OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700)
- DeepSeek Harness `0.1.1-rc.2` 内置公开类型：`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-subprocess`、`@deepseek-ai/dsh-settings`、`@deepseek-ai/dsh-client-connection`

外部文档核对日期：2026-08-26。正式发布前必须重新核对上游接口与服务条款。

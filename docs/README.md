# Grok Build Provider 文档索引

- 状态：**方案已确认，TDD 开发中；新增自管 OAuth 带发布阻断项**
- 目标版本：`0.1.0`
- 兼容基线：DeepSeek Harness `0.1.1-rc.2`
- 目标平台：macOS arm64、Windows x64

本仓库是一次 clean-room 重写。设计只依据 DeepSeek Harness 的公开接口、xAI 官方 Grok Build 文档和通用协议标准；不会复制、移植或修改 `dsh-llm-grok` 的源码、目录结构或实现细节。

## 推荐结论

首版采用双认证路线：默认可由插件发起官方 Grok Build CLI 浏览器登录并复用官方会话；同时提供插件自管的 OAuth device flow、token 持久化与刷新。用户必须明确选择，不能静默回退或混用。

1. 用户在 Harness 设置页点击“使用 Grok 登录”，或在 TUI 输入 `/grok login`。
2. 插件 Host 通过 Harness `ctx.subprocess` 以固定 argv 启动经路径/版本约束的 Grok CLI 候选；该启动层不经过 shell。标准配置下由官方 CLI 完成系统浏览器、OAuth、loopback callback 和凭据写入。
3. `official-cli` 模式只读官方凭据文件并接受绑定 schema；`managed-device` 模式把独立 grant 只写入 Harness credentials record。两者的 token 都不进入 renderer、settings、RPC、本插件日志或 workspace。
4. 模型目录只请求固定 `GET /v1/models`；推理按目录中经过验证的 `api_backend` 选择闭合 endpoint。当前真实模型都走固定 `POST /v1/responses`；拒绝重定向和自定义 endpoint。
5. 模型目录从固定 `/v1/models` 动态发现账号当前可用的全部 Grok Build 模型；本机当前快照为 `grok-4.6` 与 `grok-4.5`。
6. 自管 OAuth 只使用 xAI 明确授权的本插件 public client ID，并通过 Harness credential grant record 持久化；当前缺少公开第三方 client 注册/授权依据，因此是真机自管登录与 npm 发布的阻断项。

`official-cli` 路径与原推荐路线一致；`managed-device` 路径提供类似 `dsh-codex` 的 device-code 浏览器体验，但由本插件负责 polling、refresh rotation 和 Harness grant record。前者要求安装官方 CLI，后者要求 xAI 明确授权给本插件的 public client ID。

安全边界需要说清楚：`--oauth` 只选择 loopback 浏览器 transport，不会强制官方 CLI 忽略其有效配置。官方 CLI 可能按用户/企业配置运行外部认证命令（其内部可使用 `sh -c` 或 `cmd /C`）或企业 OIDC。因此“无 shell”只适用于本插件到 CLI 的启动层，不是端到端保证。`0.1.0` 把官方 CLI 及其有效配置视为用户管理的可信组件，并在读取凭据后失败关闭：外部 provider、API key、企业 issuer、旧式或歧义记录都不允许进入固定 xAI Proxy。该本地 metadata 未签名，所以这是严格兼容性筛选，不是密码学来源证明。

还需接受这些共享副作用和残余风险：官方 login 可能先清除已有 credential，取消或失败也可能使旧会话失效；logout 会影响所有共享同一 `GROK_HOME` 的应用。官方 CLI 的 proxy、managed-config sync、更新检查与已启用遥测不受插件固定推理 transport 约束。当前第一方 token 可能具有 conversation/workspace read-write 等较宽 scope，泄漏影响不只一次聊天。Web `loopback` RPC 是浏览器 reachability/trust fence，不是本机进程身份认证；同一 OS 用户下的恶意进程不在本插件可防御边界内。

## 文档顺序

- [产品需求](./01-product-requirements.md)
- [架构候选与推荐路线](./02-architecture-options.md)
- [安全与威胁模型](./03-security-threat-model.md)
- [Harness rc.2 接口契约](./04-harness-contract.md)
- [兼容性与测试计划](./05-test-plan.md)
- [npm `0.1.0` 发布计划](./06-release-plan.md)
- [开发前决策门](./07-decision-gate.md)
- [Grok CLI 1.0.5 上游证据](./08-upstream-cli-1.0.5-evidence.md)
- [当前实现与发布阻断项](./09-implementation-status.md)
- [ADR-0001：认证与传输路线](./adr/0001-auth-and-transport-route.md)
- [ADR-0002：首版能力边界](./adr/0002-v0.1-scope.md)
- [ADR-0003：双认证路径与自管 OAuth](./adr/0003-dual-authentication.md)
- [ADR-0004：动态全模型目录](./adr/0004-dynamic-model-catalog.md)

## 开发门禁

原开发门已由仓库所有者确认。当前只建立私有、不可发布的协议测试；最终 package identity、xAI OAuth client 授权、两平台真机门禁和发布链全部满足前，不进行 npm 发布。

## 官方依据

- [xAI Grok Build 官方仓库](https://github.com/xai-org/grok-build)
- [Grok Build 官方 README：认证、auth.json API 调用、Headless 与 ACP](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/README.md)
- [Grok Build 官方认证指南：browser login 与凭据边界](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/02-authentication.md)
- [`dsh-codex`：Web/TUI 登录体验参考，不作为代码来源](https://github.com/Yan-Zero/dsh-codex)
- [RFC 8252：Native Apps OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8252)
- [RFC 9700：OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700)
- DeepSeek Harness `0.1.1-rc.2` 内置公开类型：`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-subprocess`、`@deepseek-ai/dsh-settings`、`@deepseek-ai/dsh-client-connection`

外部文档核对日期：2026-08-25。正式开发和发布前必须重新核对上游接口与服务条款。

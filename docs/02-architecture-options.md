# 架构候选与推荐路线

## 1. 评价标准

候选路线按以下优先级评价：

1. xAI 官方支持证据与服务条款风险。
2. 凭据暴露面和可审计性。
3. Harness LLM 流、reasoning 与工具调用的语义完整性。
4. macOS 与 Windows 一致性。
5. 依赖体积、供应链与受管市场可安装性。
6. 用户体验与维护成本。

## 2. 候选比较

| 路线 | 认证所有者 | Harness 语义 | 跨平台 | 主要风险 | 决策 |
|---|---|---:|---:|---|---|
| A. 插件自管 device OAuth + 固定 Proxy | 插件 | 高 | 高 | Client ID 授权、令牌存储、刷新状态机 | **与 B 并列采用，授权前阻断发布** |
| B. Harness 发起官方 CLI 登录 + 固定 Proxy | xAI CLI | 高 | 高 | 依赖官方 CLI；子进程生命周期；上游文件格式变化 | **与 A 并列采用** |
| C. `grok -p` Headless | xAI CLI | 低 | 高 | prompt 展平、每次进程开销、工具与会话语义不完整 | 拒绝 Provider 路线 |
| D. `grok agent stdio` ACP | xAI CLI | 低 | 高 | agent 套 agent，权限、工具、会话边界重复 | 拒绝 Provider 路线 |
| E. xAI Console API Key | 插件/用户 | 高 | 高 | 独立计费，未必提供 Grok Build 订阅模型 | 后续独立模式 |

## 3. 推荐路线 A + B（显式双模式）

### 数据流

```text
Harness renderer
  │ 仅状态 DTO / 模型选择
  ▼
Harness Host
  ├─ GrokAdapter
  │    ├─ 动态账号模型目录
  │    ├─ prepareCall generation
  │    └─ Harness chunk 流
  ├─ OfficialSessionCredentialSource
  │    └─ 只读 xAI 官方 auth.json
  ├─ ManagedDeviceCredentialSource
  │    ├─ 固定 auth.x.ai device/token/revoke endpoints
  │    └─ Harness credentials grant record
  ├─ OfficialGrokLoginBridge
  │    └─ 仅 ctx.subprocess.spawn([<constrained grok>, login --oauth|logout])
  ├─ PinnedGrokTransport
  │    └─ 仅 cli-chat-proxy.grok.com
  └─ ProviderWireCodec
       ├─ ResponsesCodec（当前真实模型）
       └─ 其他 Grok 声明 backend 只有在协议与真机门禁通过后启用

xAI 官方 Grok Build CLI
  ├─ 标准配置：打开系统浏览器、OAuth、loopback callback、凭据写入
  └─ 用户/企业有效配置：也可能选择外部 auth command 或企业 OIDC
```

### 深模块边界

#### `GrokAdapter`

对 Harness 暴露一个小而稳定的 Provider 接口，内部隐藏认证文件、HTTP headers、SSE 方言和重试细节。它拥有：

- `providerInfo` 与 retry policy。
- 动态、认证 generation 隔离的账号模型目录；不从模型名猜能力。
- `prepareCall()` 的 generation 快照。
- 输入验证、工具 schema 转换和 Harness chunk 顺序。

#### `OfficialSessionCredentialSource`

它只提供“为一次 Host 请求取得当前 access token”的能力，不把文件路径、JSON、token 或 refresh token暴露给调用方。设计约束：

- 路径只来自 Host 的 OS home 或 Host 启动时已有的 `GROK_HOME` 环境，不接受 UI/RPC 参数。
- 文件必须是普通文件，大小不超过 64 KiB；拒绝 symlink、reparse point、目录和设备文件。
- JSON 严格解析，只读取官方身份 key；未知结构返回 `AUTH_FORMAT_UNSUPPORTED`。
- 只接受唯一、无歧义、与发布绑定 CLI 版本的 xAI 生产 OIDC schema 相符的记录：`auth_mode`、issuer、client ID、scope、expiry 与 token 都必须通过闭合关系；external、API key、web-login、企业 issuer、legacy scope 和多记录全部拒绝。
- 这些字段是官方 CLI 写入的本地未签名 metadata，只能作为失败关闭的兼容性筛选，不能作为 token 第一方来源的密码学证明。
- token 仅在 Host 内存短暂缓存，按文件元数据变化和 401 失效。
- 永不写入、刷新、迁移或删除官方凭据。

#### `OfficialGrokLoginBridge`

为 Web 设置页和 TUI 提供与 `dsh-codex` 类似的“在 Harness 内发起登录”体验，但不接管 OAuth：

- 从 Host 启动时冻结的绝对 `GROK_HOME` 派生候选：macOS 默认 `~/.grok/bin/grok`；Windows 默认 `%USERPROFILE%\\.grok\\bin\\grok.exe`。不使用 `GROK_BIN_DIR`、PATH、workspace，也不接受 RPC/UI 传路径。
- macOS 官方安装会使用 symlink；必须 `realpath` 后确认目标位于同一 `~/.grok` 根下、是当前用户拥有的普通可执行文件。Windows 拒绝 reparse point 和非普通文件。
- 只使用 Harness 公开 `ctx.subprocess.resolveExecutable()` 与 `ctx.subprocess.spawn()`；不直接 import `node:child_process`，也不把 `@deepseek-ai/dsh-subprocess-local` 打进插件。
- 先执行固定 argv `[constrainedExecutable, "--version"]`，在 10 秒和 16 KiB 输出上限内验证版本格式，并要求版本属于发布时冻结的有限精确 allowlist；未经测试的更高版本也失败关闭。
- 登录只允许 `[constrainedExecutable, "login", "--oauth"]`；退出只允许 `[constrainedExecutable, "logout"]`。不拼接字符串、不显式启动 shell、不接受额外参数。
- `cwd` 使用受控的 Grok home，不使用用户 workspace；stdin 关闭，stdout/stderr 分别限制 64 KiB。
- 同时只允许一个登录事务；默认 5 分钟超时，支持取消与插件卸载清理。终止通过 Harness seam 对整棵进程树执行，Windows 与 macOS 行为由 Runtime 实现并在真实设备验证。
- 官方 CLI 自己打开浏览器并监听 callback。插件只映射进程状态，绝不把原始输出、授权 URL、state、code 或 token 送入 renderer。
- `grok login --oauth` 成功退出后再读取凭据；进程退出码为 0 但凭据无效时仍判定失败。
- `--oauth` 只固定 loopback transport，并不会绕过 CLI 的 external provider、devbox、OIDC、系统 managed config 或 MDM。检测到已知的 external/enterprise 环境覆盖时应在 spawn 前失败；即便未检测到，官方 CLI 及其有效配置仍是用户管理的信任边界，登录后的凭据门禁是最终防线。
- 首版只支持 Harness Host 与浏览器处于同一 macOS/Windows 桌面会话；远程 Web/headless 不假装成功，也不把 Host 的登录误报成客户端登录。

公开 Host API 只接受闭合动作：

```ts
type AuthAction = "status" | "login" | "cancel" | "logout"
```

它不是通用命令执行器，也不是通用 URL opener。

#### `PinnedGrokTransport`

调用方传 endpoint ID，不传 URL：

```ts
type EndpointId = "models" | "responses" | "chat-completions" | "messages"
```

生产映射编译期固定到：

```text
models           -> GET  https://cli-chat-proxy.grok.com/v1/models
responses        -> POST https://cli-chat-proxy.grok.com/v1/responses
chat-completions -> POST https://cli-chat-proxy.grok.com/v1/chat/completions
messages         -> POST https://cli-chat-proxy.grok.com/v1/messages
```

只有目录返回的闭合 `api_backend` 才能选择对应 endpoint；调用方不能直接传 URL。2026-08-26 的 `grok-4.6` 与 `grok-4.5` 都声明 `responses`。若真实账号目录出现尚未通过 codec 与真机测试的 backend，则“支持全部模型”门禁失败并阻断发布，不能静默隐藏该模型。

Transport 独占 Authorization 注入，强制 `redirect: "error"`、HTTPS、固定 origin/path、超时、取消和响应上限。测试通过构造时注入本地 transport，不在生产配置中暴露 base URL。

#### `ProviderWireCodec`

负责按 backend 把经过 schema 验证的远端增量转换为 Harness。当前 Responses 流已真实观察到 `response.created`、reasoning summary、output item/content part、output text 和 `response.completed`；所有 event 都必须经过闭合状态机后才转换为：

- `block-start`
- `text-delta` / `reasoning-delta`
- `tool-call-delta`
- `block-end`
- `usage`
- `finish`

`usage` 必须在 `finish` 前，`finish` 后不得再输出；截断或空成功响应必须产生稳定错误，不得假装成功。

### 登录的两层保证

- 插件可保证：renderer 无通用命令能力；传给 Harness seam 的 argv、cwd、stdio、环境覆盖与期限闭合；该 seam 不解释 shell；取消/卸载终止受管进程树；不符合绑定生产 OIDC schema 的凭据不会被本插件发往固定 Proxy。
- 插件不能保证：官方 CLI 不依据受信配置执行内部 shell、外部 helper、devbox 或企业 OIDC；也不能从未签名 `auth.json` metadata 密码学证明 token 的签发者。

因此推荐路线的前提是接受“官方 Grok CLI + 它的有效配置”为本地信任边界。若产品要求端到端绝不运行 shell，当前上游没有可验证的 builtin-only/no-config 参数，本路线必须阻断，等待上游能力或改用获得 xAI 授权的自有 OAuth client。

## 4. 自管 OAuth 的新增责任

自行 OAuth 会同时引入以下新责任，ADR-0003 已接受这些责任：

- 取得明确授权的公共 OAuth Client ID，而不是复制官方 CLI 或第三方 Client ID。
- RFC 8628 device code、固定 verification URI、polling、取消、过期和重放防御。
- Harness credential grant record 的明文落盘边界与未来 keychain provider 迁移。
- refresh token 轮换、并发 single-flight、注销和恢复。
- 需要自行承担跨平台安全存储、刷新与账户切换，而 Harness 的子进程 seam 只能解决官方 CLI 生命周期，不能替代这些认证责任。

`official-cli` 模式仍把这些责任留给官方 CLI；`managed-device` 模式产生独立持久凭据，且在 xAI 为本插件授权 public client ID 前不得进入生产真机或 npm 发布。

## 5. 为什么不用 Headless

xAI 官方把 Headless 描述为简单脚本集成；示例会把消息压成 prompt，并运行一个完整 Grok agent 进程。作为 Harness LLM Provider，它无法可靠保证：

- 系统、用户、助手消息的原始角色边界。
- Harness tool schema 与增量 tool calls。
- Harness 自己的权限 UI 是唯一工具授权来源。
- 同一流的 usage、finish、abort 和 retry 语义。

因此 Headless 适合单独的“调用 Grok agent”功能，不适合本项目的 LLM adapter。

## 6. 为什么不用 ACP

ACP 面向 IDE 与 agent client，包含自己的 session、tools、permission 和 MCP 生命周期。把 ACP agent 包进 Harness LLM Provider 会形成两层 agent loop，让用户难以判断哪一层执行工具、保存会话和做权限确认。首版保持模型层集成，不引入 ACP。

## 7. API Key 备选

xAI Console API Key 是更传统的官方 API 路线，但通常是独立 API 计费，并不能自动等价于 Grok Build 订阅额度或模型目录。若未来需要，应作为明确命名的第二种认证模式，并使用 `api.x.ai` 的官方 API 文档；不能在失败时静默从订阅会话切换到可能计费的 API Key。

## 8. 首个开发验证

方案获批后的第一项工作不是大规模编码，而是一个受控协议 spike：

1. 使用用户自己的官方 CLI 登录会话。
2. 验证在受支持的标准 Grok 配置下，从 Web/TUI 触发 `grok login --oauth` 后，macOS 与 Windows 都由官方 CLI 打开系统浏览器；取消、超时和卸载会终止并等待 Harness seam 可观察的受管进程树；Windows 不出现额外 shell/console 闪窗。
3. 分别验证标准配置、external auth、企业 OIDC、环境覆盖与多记录 auth 文件；只允许与绑定版本生产 OIDC schema 相符的候选进入 transport，并记录官方 CLI 仍可能在内部执行配置命令这一残余风险。
4. 对固定 Chat Proxy 验证多轮消息、流式文本、reasoning、工具 schema、增量 tool call、usage、finish、401 和中止。
5. 只记录脱敏后的字段名称、类型和状态，不保存 prompt、token、完整响应或账号信息。
6. 若工具调用不能无损映射，或凭据筛选不足以维持固定 Proxy 边界，停止实现并回到本 ADR；不得用 prompt 拼接或 ACP 偷换路线。

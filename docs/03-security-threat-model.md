# 安全与威胁模型

## 1. 结论

`0.1.0` 的安全边界建立在两条原则上：

- 登录由 Harness 发起，但认证协议由 xAI 官方 Grok Build CLI 完成。
- 本插件取得的推理 Bearer token 只在 Host 的凭据读取器和固定 origin transport 之间短暂流动。官方 CLI 的登录网络、代理、托管配置同步与遥测是独立上游边界，不受该 transport 约束。

只有本文所有 P0 门禁和 [测试计划](./05-test-plan.md) 的安全用例通过，才允许发布。

## 2. 信任边界

```text
Web renderer / TUI
  │ 闭合 RPC 或 /grok 命令；无 token、URL、path、env
  ▼
Host AuthCoordinator
  ├─ OfficialGrokLoginBridge
  │    └─ path/version-constrained ~/.grok/bin/grok[.exe] login --oauth
  │         ├─ 标准配置：系统浏览器与 xAI OAuth
  │         ├─ 有效配置也可能选择 external helper / devbox / 企业 OIDC
  │         ├─ CLI 自己的代理、托管配置同步与遥测
  │         └─ ~/.grok/auth.json
  ├─ OfficialSessionCredentialSource
  │    └─ 只读 ~/.grok/auth.json
  └─ PinnedGrokTransport
       └─ cli-chat-proxy.grok.com
```

受保护资产：

- access token、refresh token、授权码、state 和 PKCE verifier。
- 用户提示词、工具定义、工具参数与工具结果。
- 账号身份、订阅状态和配额。
- Host 进程、用户文件和 xAI 请求额度。
- npm 发布身份与供应链完整性。

## 3. 威胁与控制

| 威胁 | 影响 | 控制 | 等级 |
|---|---|---|---|
| renderer 把任意命令交给 Host | 本机任意代码执行 | RPC/命令只接受闭合 action；路径和参数完全由 Host 生成 | P0 |
| PATH 或 workspace 劫持 `grok` | 执行恶意二进制 | 不从 cwd 搜索；优先官方 `~/.grok/bin`；realpath、owner、普通文件与目录包含关系校验 | P0 |
| 插件参数被 shell 解释 | 任意命令执行 | 只用 Harness `ctx.subprocess`、绝对 argv、固定命令表；插件不显式启动 shell | P0 |
| CLI 有效配置运行 external auth command | 以当前用户权限执行 `sh -c`/`cmd /C` | 官方 CLI 与 user/system/MDM 配置是显式信任边界；已知环境型覆盖在 spawn 前拒绝；磁盘/MDM 配置不能可靠预判；登录后只接受与绑定生产 OIDC schema 相符的候选；README 披露不能保证端到端无 shell | P0 |
| 登录进程继承 DSH secrets | 凭据横向泄漏 | 构造最小环境；移除 npm token、DSH credential、API keys 和无关 secret | P0 |
| 登录 stdout/stderr 含敏感字段 | token 或 OAuth 事务泄漏到 UI/日志 | 不透传原始输出；每流 64 KiB；仅映射闭合状态与稳定错误码 | P0 |
| 登录进程悬挂或并发 | listener/进程泄漏、凭据竞争 | single-flight、5 分钟超时、AbortSignal、取消、卸载清理 | P0 |
| 恶意/损坏 auth.json | 内存耗尽、解析攻击、任意文件读取 | 路径不来自 UI；64 KiB；普通文件；拒绝 symlink/reparse；严格 schema | P0 |
| external/企业/歧义凭据误送固定 xAI Proxy | token 泄漏或账号混淆 | 唯一候选；闭合 auth mode/issuer/scope/client/expiry 关系；schema 不符失败关闭；承认 metadata 未签名 | P0 |
| token 被发往自定义或重定向 origin | 账号接管 | endpoint ID；固定 HTTPS origin/path；`redirect: "error"` | P0 |
| Authorization 被继承到远端 URL | 账号接管 | `0.1.0` 无图片下载和任意 URL 请求；transport 不接受 URL | P0 |
| SSE/压缩响应无限增长 | 内存、CPU、磁盘 DoS | 字节、行、事件、总时长和 idle timeout 双重上限 | P0 |
| 原始远端错误返回 UI | token、账号或内部信息泄漏 | 只返回插件稳定错误码和安全文案；Harness RPC correlation 留在 carrier 内部 | P0 |
| 凭据轮换期间读到半写文件 | 认证失败或旧 token 重放 | 只接受完整 JSON；短退避重读；不写回；已发送请求不自动重放 | P1 |
| CLI 更新改变协议或文件格式 | 静默错误 | 登录前后重查 realpath/identity/version；只允许发布时冻结的有限精确版本集合，未知更高/更低版本都失败；CLI 自身更新行为属于 vendor boundary | P1 |
| 未授权复用官方/第三方 OAuth Client ID | 客户端冒充、封禁或条款违约 | 生产只接受 xAI 明确授权给本插件的 build-time public client ID；无授权即阻断发布 | P0 |
| 恶意 device-flow URI/code | 用户被引向钓鱼站或 token 被劫持 | discovery 与 device/token/revoke endpoint 全部固定；verification URI 只允许 `https://auth.x.ai` 精确路径；device_code 永不进入 renderer | P0 |
| refresh-token rotation 并发覆盖 | 会话永久失效或旧 token 复活 | Harness `credentials.modifyRecord()` 跨进程排他读改写；generation 与 current-record 重查 | P0 |
| 自管 grant 明文被同 UID/agent 读取 | access/refresh token 泄漏 | 只用 owner-scoped credential record；POSIX 0700/0600；明确披露同 UID 仍可读、Windows ACL 未由 rc.2 验证；未来迁移 keychain provider | P0 |
| 认证模式/账号目录混用 | 把请求发到错误账号 | 每次 prepare 冻结 auth generation；catalog、lease、logout、401 都绑定 mode+generation；禁止 silent fallback | P0 |
| npm 依赖安装脚本 | 供应链代码执行 | 目标零 runtime dependencies；全图禁止 lifecycle scripts | P0 |

## 4. 官方 CLI 进程边界

### 可执行文件发现

默认候选：

- macOS：`${HOME}/.grok/bin/grok`
- Windows：`${USERPROFILE}\\.grok\\bin\\grok.exe`

首版只使用 Host 启动时冻结的绝对 `GROK_HOME`（默认 `${HOME}/.grok`）下 `bin/grok[.exe]`。不支持 `GROK_BIN_DIR`、PATH、workspace 或 UI 指定路径。使用 npm trampoline 的用户必须先在 Terminal/PowerShell 从官方安装入口完成 bootstrap 并执行一次 `grok --version`；插件不下载、安装或更新 CLI。

macOS 官方默认路径可能是 symlink；验证时允许 symlink，但 `realpath` 必须仍位于规范化的 `GROK_HOME` 根内，并指向当前用户拥有的普通可执行文件。Windows 候选必须是普通文件并拒绝 reparse point。路径、owner 和版本检查只能约束候选形状，不能证明 publisher；“用户从 xAI 官方渠道安装”是信任假设，除非 spike 证明可稳定验证签名/notarization/官方哈希。

### 固定命令表

| 用户动作 | 可执行参数 | 说明 |
|---|---|---|
| 检查版本 | `--version` | 10 秒、16 KiB 输出上限 |
| 浏览器登录 | `login --oauth` | 标准配置下官方 CLI 打开浏览器并处理 callback |
| 退出 | `logout` | 官方 CLI 删除自己的凭据 |

`cancel` 不是一个 CLI 参数，只会中止当前 Host 拥有的登录子进程。

禁止：

- 插件通过 argv 显式启动任何 shell。
- 固定 `["login", "--oauth"]` 之外的 flags、prompt、cwd 或环境变量。
- 把授权 URL 从 stdout/stderr 提取后交给通用 opener。
- 自动下载或更新 Grok CLI。
- 在登录流程中启动 Grok agent、工具或 workspace 会话。

`--oauth` 只固定 loopback transport，不绕过 external auth、devbox、企业 OIDC、system managed config 或 macOS MDM。插件对已知环境覆盖设置 tombstone，但不能靠环境清理覆盖磁盘/MDM 配置。

子进程环境必须从闭合 allowlist 构造，而不是保留任意用户 PATH：

- macOS PATH 固定为系统目录 `/usr/bin:/bin:/usr/sbin:/sbin`；Windows PATH/PATHEXT/COMSPEC 固定为从已验证 `SystemRoot` 派生的系统目录与扩展集合。
- 只保留必要 OS home、`SystemRoot`/`WINDIR`、临时目录、locale，以及明确披露的 proxy/CA 变量；proxy/CA 属于用户管理的网络信任边界。
- 明确移除 `XAI_API_KEY`、`GROK_AUTH_PROVIDER_*`、`GROK_OIDC_*`、`GROK_OAUTH2_*`、`GROK_LOCAL_AUTH`、endpoint/model override、`BROWSER`、`RUST_LOG`、`GROK_LOG_FILE`、`NODE_OPTIONS`、`SSLKEYLOGFILE`、`DYLD_*`、`LD_*`、npm/DSH/API secrets和其他进程行为变量。
- 精确 allowlist/tombstone 列表在协议 spike 按固定 CLI 版本与两平台冻结；workspace/PATH canary 不得被登录链执行。

官方 loopback 登录可能先清除旧 credential，取消/失败也可能使共享会话失效；成功后 CLI 还可能同步 managed config 或发送其自身已启用的遥测。插件无法撤销这些官方副作用。登录前 UI 必须提示，`logout` 必须经前台用户确认，且会影响所有共享同一 `GROK_HOME` 的应用。

“插件不自动更新”只约束本插件；官方 CLI 自身的更新检查/替换仍属于 vendor boundary。登录前后必须重新解析 executable identity 与版本，若发生变化或落出已测集合，凭据状态失败关闭并要求重新验证兼容性。

### 状态机

```text
idle ──login──> starting ──spawned──> running
  ▲               │                     │
  │               ├─spawn error────────>failed
  │               └─cancel─────────────>cancelled
  │                                     │
  └──────── success + valid auth <──────┤
                                        ├─timeout──>failed
                                        └─exit/auth invalid──>failed
```

登录尝试与当前凭据是两个正交状态。CLI 以成功、非零、取消或超时结算后，都必须先 `waitForExit()`、失效旧 cache 并重新检查 auth 文件；例如“尝试 cancelled，但凭据已在取消前写入并有效”必须如实表示，不能静默启用，也不能谎报未登录。

最小公开状态形状：

```ts
type PublicAuthStatus = {
  credential: "missing" | "valid" | "expiring" | "expired" | "unsupported"
  login:
    | { state: "idle" }
    | { state: "starting" }
    | { state: "running"; sessionId: string }
    | { state: "settled"; outcome: "succeeded" | "failed" | "cancelled" | "timed-out" }
  expiryBucket?: "under-5m" | "under-1h" | "later"
}
```

official-cli DTO 不声称能可靠知道浏览器是否打开，也不包含 process ID、binary path、OAuth URL、stdout/stderr、token、auth 文件内容、email、user ID、team/org、subscription 或 fingerprint。managed-device DTO 只额外允许固定 xAI verification URI、一次性 user code 与过期时间；不允许 device_code。stdin 为 ignored，因此 official-cli 不支持手工粘贴 code fallback。

## 5. 凭据文件

- 插件只读 Grok CLI 凭据，不创建第二份落盘副本。
- official-cli 令牌不写入 settings、DSH credentials、workspace、临时文件或诊断包；managed-device token 只写入 Harness owner-scoped credential grant record，绝不写入其余位置。
- `1.0.5` 的真实 `auth.json` 同时包含 refresh token。Host 对文件的有界读取会短暂接触包含它的原始字节；实现不得缓存、使用、记录或写回 refresh token，解析后只保留闭合校验元数据与短期 access-token lease。该约束缩短暴露窗口但不构成进程级隔离。
- 文件路径只由 OS home、官方 `GROK_HOME` 约定和 Host 环境解析；UI 不可选择路径。
- 读取前后检查文件元数据，降低替换竞态；解析失败时不保留部分值。
- 生产 OIDC schema 候选筛选必须版本化：顶层对象有界且只有一个候选；map key 等于规范化 issuer 与 client ID 组合；`auth_mode === "oidc"`；issuer 精确等于该固定 CLI 版本的 xAI 生产 issuer；scope、client ID、access token 和 `expires_at` 关系闭合。拒绝 external、api_key、web_login、legacy scope、企业 issuer、多候选和未知关键模式。最终字段和值必须在协议 spike 绑定到精确 CLI tag/commit，不能长期依赖 mutable `main`。
- 上述 metadata 未签名，官方源码也只把 auth mode/issuer 当 provenance/debug hint；它不是密码学 trust assertion。插件在信任官方 CLI 与当前用户凭据目录的前提下做本地失败关闭，真实 bearer 最终由固定 xAI Proxy 服务端验证。
- access token 只在 Host 内存使用；缓存采用短生命周期并可显式清空。Host 有界读取完整 JSON 时原始 buffer/string 可能瞬时包含 refresh token；解析器不提取、不缓存、不使用、不返回、不记录、不写回该字段，且 JavaScript 内存不承诺可靠清零。
- 解析 `expires_at` 并使用固定 skew 在发送前拒绝过期/将过期凭据。插件不运行 CLI refresh 状态机。
- 401 立即使 lease 失效并返回 LLM `AUTH`，不自动重放已发出的 POST；下一次明确用户动作才重新读取文件或发起登录。
- `/grok logout` 或 Web 退出通过官方 `grok logout` 完成，插件不直接 unlink 文件。
- logout 先推进 auth generation 并中止所有插件推理；完成后清缓存。旧 generation 的完成回调不得重新填入凭据。

## 6. 固定网络策略

本插件拥有并注入凭据的生产 endpoint 闭合集合：

```text
GET  https://cli-chat-proxy.grok.com/v1/models
POST https://cli-chat-proxy.grok.com/v1/responses
```

`chat-completions` 与 `messages` 只有在未来真实目录出现相应 backend、对应 codec 和真机门禁通过后才能进入发布集合；当前不得为“看起来兼容”而启用。

要求：

- `redirect: "error"`，301/302/303/307/308 全部失败。
- Authorization 只能由 `PinnedGrokTransport` 注入。
- 不接受 base URL、proxy URL、模型返回 URL或 discovery URL。
- 不把 token 放进 query string。
- 每个请求携带 Harness `attributionHeaders()`、`X-XAI-Token-Auth: xai-grok-cli`、发布绑定的 `x-grok-client-version` 与本项目真实 `x-grok-client-identifier`/package identity；不得伪造 `grok-shell`。缺失版本会触发 426，版本变更必须重跑协议门禁。
- token、headers、完整 URL query、prompt 和原始远端 body 都不进日志。
- 本限制不覆盖官方 CLI 子进程的 OAuth、企业 IdP、managed-config、代理或遥测网络；这些由官方 CLI 及其有效配置负责并在隐私说明中单独披露。

请求在 `JSON.stringify` 前也必须受限：消息数、单条/总 UTF-8 字节、工具数量、单个/总 schema 字节、schema 深度与 tool-result 大小均有闭合上限。响应必须验证允许的 `Content-Type`。Provider 只产生 Harness tool-call chunks，不自行执行工具或写文件；未在本次请求声明的工具名、厂商 server-tool/search/image 事件全部拒绝。

初始上限：

- auth.json：64 KiB。
- 消息：最多 512 条；单条 2 MiB；序列化前累计 UTF-8 8 MiB。
- 工具：最多 128 个；单个 schema 256 KiB；全部 schema 2 MiB；结构深度 64。
- 单个 tool result：2 MiB。
- 普通 JSON/错误 body：64 KiB。
- SSE 单行：256 KiB。
- SSE 单事件：1 MiB。
- SSE event：最多 100,000；comment/heartbeat 合计最多 100,000。
- 单次流累计协议字节：32 MiB。
- block 与 tool call：分别最多 4,096；单个 tool arguments 1 MiB、累计 8 MiB。
- 响应 JSON/schema 结构深度：64。
- 首字节超时：30 秒。
- idle timeout：120 秒。
- 绝对时长：30 分钟。

同时检查声明长度和实际解压后流字节，覆盖 chunked、伪造 Content-Length、gzip/brotli 炸弹与无限事件。

## 7. RPC 与命令

Web RPC 只允许：

```ts
type AuthRpc = {
  status(input: {}): Promise<AuthOutcome>
  login(input: {}): Promise<AuthOutcome>
  cancel(input: { sessionId: string }): Promise<AuthOutcome>
  logout(input: { phase: "begin" } | { phase: "confirm"; confirmationId: string }): Promise<AuthOutcome>
}
```

每个 unary handler 实际再包成 Harness `RpcResult<AuthOutcome>`；业务失败留在成功 value union，只有 rc.2 允许的框架错误进入 error 分支。

- authority 使用 `loopback`，依赖 rc.2 Connection 对 Host/Origin/Sec-Fetch 混淆的 trust fence；它不提供网络层认证，handler 也拿不到 sender、frame 或浏览器 user-gesture 证明。
- Web 的前台按钮与 logout 二次确认属于防误操作 UX，不是 Host 授权边界。能以当前用户身份直接访问本机 Harness RPC 的恶意进程已能直接运行 `grok logout`/读取用户凭据，属于同一用户权限残余风险。
- handler 对 endpoint/payload 使用严格 schema；拒绝未知字段。`sessionId`/短期 confirmation ID 只降低误操作与陈旧 UI 重放，不能抵御同用户本地进程。
- `sessionId` 是随机的不透明 ID，不是 OAuth state 或 process ID。
- renderer 不能获得 token、URL、文件路径或任意命令能力。

TUI 通过 Harness 的 human-command registry 注册一个全局 `/grok`，只接受 `status|use <mode>|login [mode]|cancel|logout <mode>` 的闭合语法。命令直接在 Host 执行，不发送给模型；取消使用 invocation 自带的 `AbortSignal`。

## 8. 搜索与图片

`0.1.0` 不注册 Web/X Search、图片生成、图片输入或下载工具。因此：

- 请求体中不存在厂商侧搜索工具。
- 不存在远端图片 URL 下载逻辑。
- 不存在模型可控文件路径写入。
- 不存在把 Bearer token 带到第二个 origin 的功能路径。

未来新增时必须另写 ADR 和威胁模型。

## 9. 残余风险

本项目不承诺防御：

- 已取得当前 OS 用户权限、能替换 `~/.grok` 内容的恶意软件。
- 被攻陷的官方 Grok CLI、系统浏览器或 xAI 服务。
- 官方 CLI 或其有效 user/system/MDM 配置运行 external helper、企业 OIDC、managed-config sync、代理或遥测的行为；本插件不能给出端到端无 shell或单一网络 origin 保证。
- xAI 官方凭据文件本身的 0600/Windows ACL 模型；官方文档建议配合 FileVault 或 BitLocker。
- 同一用户身份下恶意进程读取官方 token。
- xAI 服务契约、模型行为、订阅配额或服务条款变化。
- 当前第一方 token 可能包含 conversation/workspace read-write 等较宽 scope；泄漏影响不只一次聊天。精确 scopes 按发布绑定的 CLI 版本披露。

这些风险必须在 README 和发布说明中披露。

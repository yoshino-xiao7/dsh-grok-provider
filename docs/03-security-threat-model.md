# 安全与威胁模型

## 1. 结论

`0.1.0` 的安全边界建立在两条原则上：

- 登录由 Harness 发起，但认证协议由 xAI 官方 Grok Build CLI 完成。
- 本插件取得的推理 Bearer token 只在 Host 的凭据读取器和固定 origin transport 之间短暂流动。官方 CLI 的登录网络、代理、托管配置同步与遥测是独立上游边界，不受该 transport 约束。

只有本文所有 P0 门禁和 [测试计划](./05-test-plan.md) 的安全用例通过，才允许发布。

`0.1.11` 已从 release commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5` 正式发布；final CI run `33303080849` 的 macOS 14 / Windows 2022 全绿。唯一 71 文件制品为 207,022 bytes packed、656,139 bytes unpacked，SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，npm SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`；Trusted Publisher run `33303631312` 完成，Registry、GitHub Release 与本地制品逐字节一致，npm `latest=0.1.11`。本包公开 metadata 中的 1 个 Registry signature 与 2 个 package attestations 已验证，SLSA provenance 精确绑定 `release.yml`、`v0.1.11`、上述 release commit 与该发布 run。sidebar quota `0.1.8` 曾发布后撤回且不能复用。`0.1.9` 发布精确 `grok-4.6` 的默认关闭 Web/X Search 协议与页面，`0.1.10` 补齐 Host `llm-grok` namespace 与按调用快照，`0.1.11` 修复 High Effort + Web Search 续跑的 Responses reasoning 生命周期并加入官方 raw reasoning 事件支持；它不改变推理 Bearer 的固定 origin、Search descriptor、支持模型、官方 CLI OAuth 所有权或系统网络/代理边界。供应链回读不构成网络可达 Windows 真机浏览器弹出验收。

`1.0.0` 当前仍是未发布候选；npm 稳定版仍为 `0.1.11`。该候选只收窄扩展固定 Proxy 响应解码：接受 completed `open_page` 精确动作，并允许已由 completed Web/X Search 证明的 reasoning ID 继续出现多个逐段严格空且闭合的占位。它不打开或下载 URL，不生成 Harness 本地工具调用，不保存 Search/reasoning replay，也不改变固定 origin、凭据、设置、模型或图片能力边界。

## 2. 信任边界

```text
Web renderer / TUI
  │ 闭合 RPC 或 /grok 命令；无 token、URL、path、env
  ▼
Host AuthCoordinator
  ├─ OfficialGrokLoginBridge
  │    └─ path/capability-constrained ~/.grok/bin/grok[.exe] login --oauth
  │         ├─ 标准配置：系统浏览器与 xAI OAuth
  │         ├─ 有效配置也可能选择 external helper / devbox / 企业 OIDC
  │         ├─ CLI 自己的代理、托管配置同步与遥测
  │         └─ ~/.grok/auth.json
  ├─ OfficialSessionCredentialSource
  │    └─ 只读 ~/.grok/auth.json
  └─ PinnedGrokTransport
       └─ cli-chat-proxy.grok.com（models / responses / billing?format=credits）
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
| Authorization 被继承到远端 URL | 账号接管 | 所有版本永久禁止任意图片 URL 下载；transport 不接受调用方 URL | P0 |
| Search 远端内容含提示注入或错误信息 | 诱导本地工具、文件或命令操作 | 默认关闭；只接受闭合 server lifecycle；不投影成本地 tool-call；结构化 citation 有界校验后丢弃；Harness 权限层继续独立裁决本地工具 | P0 |
| Search 设置误用于后台任务或不支持模型 | 隐私范围扩大、额外用量或协议漂移 | 只在普通 purpose 下启用；精确 `grok-4.6` allowlist；不支持 route 在 POST 前失败；不静默裁剪并重放 | P0 |
| Search namespace 缺失或热更新污染在途调用 | 控件永久不可用，或一次调用混用两组隐私/用量策略 | canonical `llm-grok` 注册；默认关闭；每次调用在首次 await 前读取并冻结一次；真实 SettingsProvider、页面写入和生命周期回归 | P0 |
| SSE/压缩响应无限增长 | 内存、CPU、磁盘 DoS | 解压后字节、行、事件、单事件与整体请求期限均有上限；当前没有独立 first-byte/idle timeout | P0 |
| 原始远端错误返回 UI | token、账号或内部信息泄漏 | 只返回插件稳定错误码和安全文案；Harness RPC correlation 留在 carrier 内部 | P0 |
| billing 响应或 credential metadata 越界进入 renderer | 身份、订阅或凭据泄漏 | Host 严格抽取百分比、周期与模型 capability；拒绝/忽略 identity、balance、history、headers、URL 和原始响应 | P0 |
| token 到期被误标为额度重置 | 错误产品决策、误导用户 | 重置时间只接受 billing period end；credential `expires_at` 不进入 dashboard DTO | P0 |
| 设置导航图标兼容层误扫页面或标记其他按钮 | 性能退化、错误界面 | 只检查设置 dialog 的 nav；标签与 SVG/span 结构必须唯一精确匹配；过滤并合并 DOM 变化；effect 卸载移除 observer、marker 与 style；不读取其他页面文本或联网 | P1 |
| 凭据轮换期间读到半写文件 | 认证失败或旧 token 重放 | 只接受完整 JSON；短退避重读；不写回；已发送请求不自动重放 | P1 |
| CLI 更新改变命令或凭据格式 | 静默错误 | 登录前重查 realpath/identity；版本只作有界诊断；探测 `login --help` 的独立 `--oauth` 选项；登录后重验生产 OIDC 凭据契约与固定服务端 codec；CLI 自身更新行为属于 vendor boundary | P1 |
| 未授权复用官方/第三方 OAuth Client ID | 客户端冒充、封禁或条款违约 | 包中不存在独立 OAuth client；只调用官方 CLI 的公开登录命令 | P0 |
| 恶意 device-flow URI/code | 用户被引向钓鱼站或 token 被劫持 | discovery 与 device/token/revoke endpoint 全部固定；verification URI 只允许 `https://auth.x.ai` 精确路径；device_code 永不进入 renderer | P0 |
| 凭据 generation/账号目录混用 | 把请求发到错误账号 | 每次 prepare 冻结 auth generation；catalog、lease、logout、401 都绑定同一 generation；禁止 silent fallback | P0 |
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
| 检查版本 | `--version` | 独立 10 秒 deadline、4 KiB 输出上限 |
| 探测浏览器登录 | `login --help` | 独立 10 秒 deadline、16 KiB 输出上限；只确认独立 `--oauth` 选项，不执行登录 |
| 浏览器登录 | `login --oauth` | 5 分钟 deadline、64 KiB 输出上限；标准配置下官方 CLI 打开浏览器并处理 callback |
| 退出 | `logout` | 2 分钟 deadline、64 KiB 输出上限；官方 CLI 删除自己的凭据 |
| 刷新临期凭据 | `models` | 30 秒 deadline、64 KiB 输出上限；只委托官方 CLI 更新文件，Provider 不实现 refresh grant |

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

“插件不自动更新”只约束本插件；官方 CLI 自身的更新检查/替换仍属于 vendor boundary。版本输出仅用于有界诊断，不能充当信任证明。每次动作仍重新解析 executable identity；登录还必须通过命令能力探测，并在完成后重新验证生产 OIDC 凭据契约。任何检查失败都不得回退到 PATH、其他命令、shell 或非生产凭据。

解析、文件验证、`--version`、`login --help` 和最终动作各自拥有并及时释放独立 deadline。不能让前序阶段消耗后序阶段预算；尤其 Windows 冷启动时，大型官方 `grok.exe` 可能经过系统安全扫描，累计共享预算会在 `login --oauth` 启动前把正常路径误判为失败。文件验证只启动只读元数据操作，并在取消时停止等待其结果；调用方取消仍贯穿所有阶段，任一阶段自身超时继续失败关闭。每个已启动进程的 tree wait 使用新的有界 teardown signal；清理超时/异常保持失败，进程退出后到 tree wait 完成前发生的 caller abort 必须结算为取消而非成功。登录 starting、confirmed logout 与过期凭据 refresh 都必须先登记为 controller-owned operation；三者共享 single-flight、shutdown fence 与 driver-generation 门禁。replacement 会使旧 logout confirmation 和旧代际结果失效；当前代际任一 cleanup failure 会隔离 login/logout/refresh，直到 Host 重启或 subprocess driver replacement。

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

认证 DTO 不声称能可靠知道浏览器是否打开，也不包含 process ID、binary path、OAuth URL、stdout/stderr、token、auth 文件内容、email、user ID、team/org、subscription 或 fingerprint。stdin 为 ignored，因此插件不支持手工粘贴 code fallback。

## 5. 凭据文件

- 插件只读 Grok CLI 凭据，不创建第二份落盘副本。
- 官方 CLI 令牌不写入 settings、DSH credentials、workspace、临时文件或诊断包；插件不创建第二份 token grant。
- `1.0.5` 的真实 `auth.json` 同时包含 refresh token。Host 对文件的有界读取会短暂接触包含它的原始字节；实现不得缓存、使用、记录或写回 refresh token，解析后只保留闭合校验元数据与短期 access-token lease。该约束缩短暴露窗口但不构成进程级隔离。
- 文件路径只由 OS home、官方 `GROK_HOME` 约定和 Host 环境解析；UI 不可选择路径。
- 读取前后检查文件元数据，降低替换竞态；解析失败时不保留部分值。
- 生产 OIDC schema 候选筛选必须契约化：顶层对象有界且只有一个候选；map key 等于规范化 issuer 与 client ID 组合；`auth_mode === "oidc"`；issuer 精确等于 xAI 生产 issuer；scope、client ID、access token 和 `expires_at` 关系闭合。拒绝 external、api_key、web_login、legacy scope、企业 issuer、多候选和未知关键模式。安全关键字段的变更必须重新评审；不影响既有语义的附加字段可以忽略。
- 上述 metadata 未签名，官方源码也只把 auth mode/issuer 当 provenance/debug hint；它不是密码学 trust assertion。插件在信任官方 CLI 与当前用户凭据目录的前提下做本地失败关闭，真实 bearer 最终由固定 xAI Proxy 服务端验证。
- access token 只在 Host 内存使用；缓存采用短生命周期并可显式清空。Host 有界读取完整 JSON 时原始 buffer/string 可能瞬时包含 refresh token；解析器不提取、不缓存、不使用、不返回、不记录、不写回该字段，且 JavaScript 内存不承诺可靠清零。
- 解析 `expires_at` 并使用固定 skew 在发送前拒绝过期/将过期凭据。只有 issuer、client ID、scope 与 schema 全部匹配而时间失效时，才 single-flight 启动固定 `grok models`；OAuth refresh 状态机和文件写回仍由官方 CLI 完成。刷新后必须重新读取并完整校验，只重试一次。
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

请求必须先通过闭合结构检查，并在最终 `JSON.stringify` 后检查 UTF-8 字节；响应必须验证允许的 `Content-Type`。Provider 只产生 Harness tool-call chunks，不自行执行工具或写文件；未在本次请求声明的工具名、厂商 server-tool/search/image 事件全部拒绝。

当前源码上限（变更时必须同时修改测试和本文）：

- `auth.json`：64 KiB。
- model catalog 与 billing/error JSON：各 256 KiB。
- Responses 请求：最多 10,000 条消息、128 个 function tools；每个 tool schema 的 JSON 最多 1 MiB；完整请求 JSON UTF-8 最多 16 MiB。
- 文本或纯文本 tool-result 的单个累计段，以及被省略前的 request reasoning block，最多 8,388,608 个 JavaScript code units；function arguments 最多 2 MiB UTF-8。最终 16 MiB JSON 是独立硬门禁。
- SSE：单事件/未切分 buffer 最多 2 MiB、解析事件最多 100,000、单次流实际读取字节最多 128 MiB。comment/heartbeat 不单独计数，但仍受流字节上限。
- response block text 与 encrypted reasoning 各最多 8 MiB UTF-8；tool arguments 最多 2 MiB UTF-8。block 数量由事件数与总流字节间接约束，没有另行宣称 4,096 上限。
- models deadline 30 秒、billing deadline 15 秒、Responses 请求整体 deadline 10 分钟；当前没有独立首字节或 idle deadline。

transport 对实际读取/发送字节做上限检查并拒绝重定向。当前实现没有基于声明 `Content-Length` 的独立门禁，也没有通用 schema 深度限制；不得在文档中把它们写成已实现防护。若后续风险评审要求这些边界，必须先补源码与回归测试。

## 7. RPC 与命令

Web RPC 只允许：

```ts
type AuthRpc = {
  status(input: {}): Promise<AuthOutcome>
  diagnostics(input: {}): Promise<AuthOutcome>
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
- `diagnostics` 是独立的只读调用，不进入登录状态轮询；它只投影插件版本与闭合 CLI 安装状态/安全版本号。同一 inspector 的并发调用共享一个有界进程序列，capability teardown 会取消并等待它；无法确认进程树退出时，该实例锁存、取消同实例的在途认证 action 并移除对应 driver，直到 capability 被替换。
- renderer 不能获得 token、URL、文件路径、stderr、代理配置或任意命令能力。登录失败只允许闭合 reason；固定 discovery timeout 的原始 URL 与错误文本也不得跨越 Host 边界。

TUI 通过 Harness 的 human-command registry 注册一个全局 `/grok`，只接受 `status|login|cancel|logout` 的闭合语法。命令直接在 Host 执行，不发送给模型；取消使用 invocation 自带的 `AbortSignal`。

## 8. 搜索与图片

`0.1.0`–`0.1.3` 对 Harness 声明 text-only；Harness 会把图片历史投影为确定性文本占位。若 raw image block 仍到达旧 Adapter，则必须在 Responses POST 前拒绝。它们也不注册 Web/X Search、图片生成或下载工具。因此：

- 请求体中不存在厂商侧搜索工具。
- 不存在远端图片 URL 下载逻辑。
- 不存在模型可控文件路径写入。
- 不存在把 Bearer token 带到第二个 origin 的功能路径。

`0.1.4` 发布版按 [ADR-0008](./adr/0008-image-input-request-compiler.md) 只增加图片输入；`0.1.5` 沿用同一边界：

- 仅精确 `grok-4.6` route 声明 image；`grok-4.5` 与未知模型继续 text-only。
- 只从可选 Harness attachment store 调用 `readImageRequest`，不解析 URL、路径、file ID 或调用方 data URL。
- 只接受投影后的 jpeg/png，并复核 attachment ID、字节数、MIME 魔数、`uchar`/sRGB、宽高、像素与资源 policy。
- 单图最多 4 MiB、图片合计保留最多 8 MiB、最多 8 张、最多 16,777,216 pixels、宽高各最多 8192；完整请求 JSON 仍最多 16 MiB。
- 含图编译路径整个请求最多 20,000 个 content block，只支持消息中的一层 tool-result；更深结构在读取 attachment 前拒绝。纯文本路径不新增这一上限，保持 `0.1.3` 接受域。
- 先按张数淘汰最旧图片，再读取最多 8 个投影；因此最坏情况下 attachment 层可能短暂返回最多 32 MiB 派生字节，8 MiB 是最终保留/发送预算而非峰值内存承诺。
- 最终 JSON 超限继续逐张淘汰最旧图片；缺服务、projection unsupported、源图片位置/引用/MIME 不支持在 Responses POST 前以 `UNSUPPORTED_CONTENT` 拒绝。store 返回损坏或不自洽的投影、超过含图编译 block 预算、更深 tool-result，以及图片全部淘汰后剩余非图片请求仍不合法，都保持通用 `INVALID_RESPONSE`。
- AbortSignal 在查询服务前检查并传给所有投影读取；编译失败时 Responses POST 调用必须为 0，但模型目录 GET 可能已发生。

`0.1.9` 按 [ADR-0010](./adr/0010-default-off-web-x-search.md) 独立增加 Search 协议与页面；`0.1.10` 补齐真实 Host settings 集成；`0.1.11` 首次收窄兼容 Search 之后的 reasoning lifecycle；`1.0.0` 候选继续兼容实测的 `open_page` 与多段 Search-backed reasoning 占位，且不扩大图片或 origin 边界：

- Web Search 与 X Search 在唯一 `llm-grok` namespace 中默认关闭并独立持久化；无 settings service 时回退组合配置。每个调用在首次 await 前冻结一次 policy，热更新只影响后续调用；两项全关时不读取 `purpose`，最终 request wire 与 `0.1.7` 保持一致。
- 只为固定 Proxy 已验证的精确 `grok-4.6` route 编译 `{type:"web_search"}` / `{type:"x_search"}`；不支持模型在 Responses POST 前返回 `UNSUPPORTED_CONTENT`。
- 普通 Harness functions、Web、X 依次排序并共用 128 项和 16 MiB 请求上限。receipt 只从冻结后的最终 wire 派生并与 decoder 绑定，避免配置、route 与 response 允许集分离。
- Web 与 X 都是 xAI 已执行的 server tool，产生零个 Harness `tool-call` chunk；X 只接受四个实测 custom-tool 名称。未启用类别、未知、重复、乱序或未闭合生命周期全部失败关闭。
- citation URL 不被打开、下载或重新请求；结构化 annotation/citations 只做有界验证后丢弃。观察到任何 Search 后不保存本响应的 encrypted reasoning replay。
- Search 关闭不代表服务商内部绝不检索；开启后提示词与模型生成的检索词会到达 xAI，且结果可能错误、含提示注入并产生额外用量。
- `1.0.0` 候选只在 completed Web `web_search_call` 中接受 own-data 精确 `{type:"open_page",url}`：URL 必须为非空且不超过 16 KiB UTF-8。streamed `output_item.done` 与 final `response.output` 必须绑定相同 action type 与逐字相同 URL；验证后动作被丢弃，不 fetch、不形成 Harness tool chunk、不进入 replay。非 completed 形状、未知键、accessor、错误类型、空值、超限或前后不一致均失败关闭。
- reasoning ID 的首次复用仍要求旧段已闭合、completed Web/X Search 位于新旧 output index 之间且新段严格为空。Search-backed 证明建立后，同一 ID 只可继续作为相同 reasoning type 的逐段严格空占位；每段必须无 summary/raw lifecycle、visible `summary`/`content` 为空并收到 `output_item.done`。terminal 仅允许既定 own-data 字段；可选 `encrypted_content` 只作为有界 opaque 字符串校验，不解密、不记录。跨类型、非空、未闭合、未知键、accessor 与 `response.incomplete` 均失败关闭。raw `reasoning_text` 与 summary lifecycle 仍互斥；观察到 Search 后仍不保存任何 reasoning replay。

公开 xAI 文档、离线测试与真机验证继续作为三类独立证据。[图片证据页](./12-upstream-image-input-evidence.md)记录的固定 Proxy 门禁已对 `grok-4.6` 的普通 user 与一层 tool-result 分别发送红/蓝合成图：4 次均为 HTTP 200、`text/event-stream`、completed，规范化整段回复只含正确颜色词和可选句末标点。`grok-4.5` 的受控红图语义不可靠，因此即使公开模型页声明图片能力也不进入本插件图片集合。图片固定使用 `detail:"high"`。Harness `0.1.1-rc.2` attachment-local/LlmRuntime 已复验 `grok-4.6` image、`grok-4.5`/未知模型 text-only，候选门禁随后关闭并完成 `0.1.4` 发布。已发布 `0.1.6` 只允许普通 user/system 历史省略通过闭合字符串/长度校验的私有 reasoning 并保留相邻可见 text/image。sidebar quota `0.1.8` 发布后已撤回，Search 的四组固定 Proxy 观察归属已发布 `0.1.9`，`0.1.10` 修复真实设置入口。`0.1.11` 的脱敏真实 probe 经生产 decoder 完成 1 次 POST、68 个事件、34 个 summary delta、0 个 raw delta与 1 个 finish，只验证 summary/Search 路径；raw reasoning 仍只有协议 fixture 证据。`1.0.0` 的补充真实观察只保存事件类别、计数、闭合结果和错误位置，不保存 URL、检索/回复内容、prompt 或任何凭据。隔离验收与制品回读不覆盖浏览器手工对话、Agent/session loop、OAuth、完整真实账号会话或 Windows 真机。任意 URL 下载与把 Authorization 带到第二个 origin 在所有版本仍永久禁止。

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

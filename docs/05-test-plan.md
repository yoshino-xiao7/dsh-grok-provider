# 兼容性与测试计划

## 1. 测试原则

- 先验证最危险、最不确定的协议边界，再扩展实现。
- CI 不使用真实 token、账号、prompt 或录制的敏感响应。
- 所有本地模拟服务使用随机 loopback 端口，不访问真实第三方。
- 真实账号 smoke 只在发布候选上人工执行，记录脱敏结果。
- `0.1.0` 发布前必须通过 macOS arm64 真机与 macOS/Windows 自动化矩阵；Windows x64 首次真机验证在发布后对 Registry 精确版本执行，验证前对外标注“代码支持、真机未验证”。
- `0.1.1` 及后续版本不要求每次重复真机验证；自动化矩阵、契约测试、干净安装和 tarball 校验是常规发版门禁。认证流程、平台 subprocess seam 或安全契约发生变化的版本原则上仍须做对应平台的定向真机验证；若仓库所有者对精确版本明确批准发布后验证，发布前必须公开标注未验证范围、保留自动化门禁，并在失败时使用新的递增稳定版修复。`0.1.6` 采用该已记录特例。

## 2. Gate 0：方案确认

仓库所有者确认 [开发前决策门](./07-decision-gate.md) 前，不创建代码和测试脚手架。

## 3. Gate 1：协议与登录 spike

确认后首先做一次最小、可丢弃的验证，不直接扩展为产品代码。

### 官方 CLI 登录

- macOS 在标准 Grok 配置下从 Harness Host 启动 `grok login --oauth`，默认浏览器成功打开。
- Windows 在标准 Grok 配置下从 Harness Host 启动 `grok.exe login --oauth`，默认浏览器成功打开。
- 插件到 CLI 的 `ctx.subprocess` argv 不经 shell，不需要用户另开 Terminal/PowerShell；不声称官方 CLI 及其后代端到端无 shell。
- 记录验收所用 Grok CLI 版本、官方 tag/commit 与可用的 `SOURCE_REV`；版本只用于复现和诊断。兼容性由可执行文件、命令能力、生产 OIDC 凭据契约与固定服务端 codec 共同决定，不以完整版本字符串作为 allowlist。
- 标准配置成功后凭据由官方 CLI 管理；验证“已有会话→重新登录取消/失败”可能清除旧会话、成功后的 managed-config sync，以及 logout 会影响共享 `GROK_HOME` 的其他应用。
- 取消、5 分钟超时、CLI 非零退出和 Harness 卸载都会终止并等待 Harness seam 可观察的受管进程树；单独记录官方 CLI 主动脱离的后代和系统浏览器。
- stdout/stderr 不进入 UI、session log 或普通日志。
- 当 Host 无图形桌面或浏览器启动失败时返回稳定错误，不把远程 Host 登录误报为客户端成功。
- `auth_provider_command` 缺失/为空/失败/成功、企业 OIDC、devbox、隔离 `GROK_HOME` 加 system/MDM 配置都要用真实 CLI 验证。产品选择是“不支持并明确报错”：不能把 external/OIDC 流程显示成标准浏览器登录，也不能把其凭据送入固定 Proxy。
- external provider 写 stderr、等待用户、经 shell 并启动后台后代的行为只作为 vendor-boundary 证据记录；原始 stderr 不显示。若用户不接受该信任边界，Gate 1 停止。
- stdin ignored 下只验收浏览器自动 callback；不支持手工粘贴授权 code。

### Chat Proxy 协议

- 多轮 system/user/assistant/tool-result 消息角色保真。
- 文本流、reasoning、usage 与 finish。
- 一个和多个工具定义。
- tool call ID、名称和 JSON 参数的分段增量。
- 工具结果回放后继续生成。
- AbortSignal 中止。
- 401、429、5xx、截断 SSE 和空成功响应。
- 缺少/错误 `x-grok-client-version` 的 426；诚实的插件 identifier 必须成功，若只能冒充官方 `grok-shell` 才能调用则阻断发布。
- 每个目录返回模型的 `api_backend` 都必须有对应 codec 与真机最小流；未知 backend 不能被静默隐藏来伪称“全部模型”。

只保留字段名、事件名、类型、状态码和大小等脱敏观察。若工具调用无法无损映射，立即停止并重新评审 ADR-0001。

## 4. 单元测试

### Binary resolver

- macOS 官方相对 symlink 指向 `~/.grok/downloads` 成功。
- symlink 逃出 `~/.grok` 失败。
- Windows reparse point、目录、设备文件和非 `.exe` 候选失败。
- 相对或 UI/RPC 提供的 `GROK_HOME` 失败；只接受 Host 启动时冻结的绝对值。
- workspace/PATH 中的假 `grok` 不会被选中。
- `--version` 超时、超限、非零退出、stderr 非空或非单行 `grok ...` 输出失败；合法的未知版本输出不得仅因版本号不同而失败。
- 登录前 `login --help` 必须成功并包含独立 `--oauth` 选项；缺失、畸形、超时、超限或非零退出时不得启动 `login --oauth`。
- executable 解析、文件验证、`--version`、`login --help` 与最终动作各自使用独立 deadline；Windows 冷启动 fake 让每个准备阶段都低于单阶段预算、累计远超该预算时仍必须到达 `login --oauth`。caller abort 与每阶段自身超时仍立即失败关闭，完成后等待超过预算也不得迟发 abort。另用永不结算的 direct `done` 与 tree fake 证明 stage/teardown wait 都有界，用进程已成功但 tree wait 未完成的 fake 证明 late caller abort 返回 cancelled；cleanup `false`/异常经 official driver 保留为内部 `cleanup-failed`，controller 公开 `failed` 并隔离当前 driver，replacement 后才能恢复。并发 begin 必须只启动一棵树；confirmed logout 与 credential refresh 必须纳入 shutdown；replacement 前后的 pending/stale success、cleanup failure 和 logout confirmation 都按 registration token 失败关闭，不能调用旧 driver 或隔离新 driver。
- 覆盖 macOS `grok 1.0.5 (5115b46bc909)` 与 Windows `grok 0.2.82 (6d0b07d2de) [stable]` 的真实输出形状，并断言两者都能在能力存在时进入固定登录 argv。
- 登录期间 symlink/文件 identity/version 改变，或官方 CLI 自更新到未测试版本时失败关闭；不把 vendor updater 误记成插件下载安装。
- 路径/owner/version 检查不得在 UI 中宣称已密码学证明 publisher；从非官方安装入口取得的候选不在支持范围。

### Login bridge

- 完整 argv 只能是 `[constrainedExecutable, "--version"]`、`[constrainedExecutable, "login", "--help"]`、`[constrainedExecutable, "login", "--oauth"]`、`[constrainedExecutable, "logout"]` 或 `[constrainedExecutable, "models"]`。
- 断言只调用 `ctx.subprocess`，从不 import/call `node:child_process`；验证受控 cwd、环境 tombstone、stdin ignored 和 raw bounded pipes。
- `XAI_API_KEY`、Grok auth/OIDC/endpoint/log override、`BROWSER`、动态加载器、Node/SSL key log、npm/DSH/API secret 都不继承；PATH/PATHEXT/COMSPEC 使用固定系统值，proxy/CA 和必要 OS 变量按冻结策略保留。workspace/PATH canary 不会被登录链执行。环境清理不能被测试误表述成覆盖 system/MDM 配置。
- 第二个并发 login 在 RPC 成功分支返回 `{ kind: "busy" }`，不伪造 RpcErrorCode。
- cancel、AbortSignal、timeout、subprocess service 替换和 dispose 都终止进程、`waitForExit()` 并 settle 一次。
- fake CLI 先写入有效 auth 再挂起：cancel/timeout 后 attempt outcome 与重新读取的 current credential 分开，UI 不谎报未登录，也不静默切换账号。
- stdout/stderr 超过 64 KiB 时终止。
- 退出 0 但 auth 文件缺失/无效仍失败。
- canary secret 出现在 fake CLI 输出时，不出现在 RPC、命令结果、错误和日志。
- Windows 真实 Gate 1 验证无额外 console 闪窗；通常若出现则发布阻断，不能用 rc.2 契约中不存在的 `windowsHide` 伪造单测。对仓库所有者已明确批准发布后验证的精确 `0.1.6`，该项按披露状态后置；若发布后出现闪窗或未打开浏览器，必须使用新的递增稳定版修复。

### Credential source

- 缺失、空、超 64 KiB、损坏 JSON、错误 schema、未知关键字段/模式。
- 唯一且与绑定版本第一方 OIDC schema 相符的候选通过；external 即使带相同 issuer 也拒绝；issuer/scope/client ID 任意不一致、web_login、api_key、legacy scope、企业 OIDC 和多候选歧义全部拒绝。测试名称不得把 metadata 形状称为已证明来源。
- 未知非关键字段只能有界忽略；精确 schema 与生产 issuer 绑定到发布支持的 CLI 版本。
- symlink/reparse、目录、替换竞态和读取中断。
- access/refresh token canary 不出现在 `JSON.stringify(status)`、异常、日志、cache、诊断输出或 fingerprint；测试承认完整文件字节会瞬时进入 Host 内存。
- 新鲜 access token 不启动 CLI；过期的同源官方 record 通过 controller-owned 固定 `models` 命令刷新并只重试一次；并发请求 single-flight；外国 issuer/client/scope/schema 永不触发刷新；刷新失败或刷新后仍过期统一失败关闭。refresh cleanup failure 必须隔离当前 driver；subprocess replacement/dispose 前开始的 refresh 即使迟到成功也不能让 credential source 继续读取或授权操作。
- email、user ID、team/org、subscription 与 fingerprint canary 不进入 `PublicAuthStatus`、RPC、命令返回或持久事件。
- credential source 已挂载但文件缺失、无效或过期且续期失败时，Web/TUI 状态必须为 unavailable；不得把 source/transport 已注册误报为凭据 ready。状态校验与登录/退出 generation 竞态时失败关闭。
- `expires_at` 边界、固定 clock skew、缺失/畸形 expiry 和本机时钟偏移。
- mtime/identity 变化使缓存失效。
- logout/401 与并发读取竞态不会恢复旧缓存。

### Transport

- 只有固定 endpoint ID 可用。
- Authorization 和官方要求 headers 精确；不接受调用方覆盖。
- 301/302/303/307/308 全部失败，第二跳服务器没有收到请求。
- 错误 body、JSON、SSE 行、事件和累计字节上限。
- 极小 SSE event/comment/heartbeat 数量上限、block/tool-call 数量、单个/累计 tool arguments 大小和响应结构深度上限。
- 无 Content-Length、伪造小长度、chunked、gzip/brotli 炸弹。
- 首字节、idle、绝对超时与 AbortSignal。
- 401 使 lease 失效并返回 LLM `AUTH`；已发送 POST 一律不自动重放，也不把被拒 token 改送其他 endpoint。
- 序列化前限制消息数、单条/总 UTF-8 字节、工具数、schema 大小/深度和 tool-result；响应验证 Content-Type。

### 动态模型目录

- `/v1/models` 的 0/1/N、重复 ID、恶意超长 ID/名称、错误类型、未知字段、超限、重定向、401 与取消。
- catalog cache 绑定 auth mode+generation；切换模式、logout、401 或 credential update 立即失效，旧刷新不能覆盖新账号。
- `listModels()` 返回全部合法去重记录；`resolveModel()` 对未列出 ID 做一次有界刷新，但目录缺失本身不被误当作路由拒绝。
- macOS/Windows 真机将插件目录与同一账号同时刻的 `grok models` 对比，不得漏模型；当前 fixture 包含 `grok-4.6` 与 `grok-4.5`，不把它们当永久全集。

### 账户额度

- 新版 credits shape 有显式 `creditUsagePercent` 时直接使用，并拒绝非有限数或 0–100 之外的值。
- 只有官方 weekly/monthly `currentPeriod` 同时具有有效 `start`、`end` 时，才把缺失百分比恢复为 proto3 省略的 `0%`；周期不完整或类型未知时保持 unknown。
- 旧版 shape 仅在 `monthlyLimit.val > 0` 且 `0 <= used.val <= monthlyLimit.val` 时计算百分比。
- reset 只来自 billing 周期结束时间，不得使用 OAuth token expiry；原始 billing、identity、balance 与 history 不进入 renderer。

### Codec 与 adapter

- 文本、reasoning、交错 block 和 UTF-8 边界。
- index 必须为非负 safe integer；重复 start、delta 指向未打开/错误类型 index、成功 finish 时未闭合 block 都失败。
- tool arguments 跨多个事件分片。
- 成功响应 usage 恰好一次并紧邻 finish；finish 缺失/重复/之后还有事件都失败。`error|aborted` finish 携带 failure，并覆盖允许未闭合 block 的 rc.2 路径。
- finish reason 对象精确映射 `stop|tool-calls|max-tokens|error|aborted`；input/cache-read/cache-write 可同时存在但计数集合不重叠，billed input 为三者之和。
- 未知事件、重复 block、截断 JSON、无闭合 tool call 和空响应。
- `prepareCall` 后热更新，旧调用使用旧 generation，新调用使用新 generation。
- 直接 `stream()` 在返回 iterable 前冻结 generation。
- 每个请求都有 Harness attribution headers。
- `0.1.0`–`0.1.3` text-only modality 把图片投影为稳定文本；`0.1.4` 未验证模型继续该行为，精确图片模型不得被 `LlmRuntime` 静默投影。
- 无图 compiler 不查询 attachment store，完整 wire JSON 与 `0.1.3` encoder 一致；user 图片及一层 tool-result 图片保持 `text/image/text` 顺序。
- 用真实故障形状锁定历史兼容：纯文本 user/system 与 `role:user` / `source.kind:subagent-settled` 的 `text/reasoning/text` 只保留可见文本，后续追加普通 user 图片时仍必须编译成功；普通 user 的同一消息内为 `text/reasoning/image/reasoning/text` 时也必须保持可见 text/image 顺序。私有 user reasoning 即使伪带同模型 replay metadata 也不进入 wire，有效 assistant replay 则仍恢复。省略前仍校验 reasoning text 的类型和长度；非字符串/超限负例在纯文本与含图路径均按通用非法 request 失败，含图路径 attachment store lookup 为 0。
- attachment fake 覆盖同一 AbortSignal、请求内相同 attachment ID 只读一次、相同 ID 元数据冲突、缺 store、`ATTACHMENT_PROJECTION_UNSUPPORTED`、存储故障及 I/O 完成前 Responses POST 调用数为 0。
- jpeg/png 正确 MIME/魔数与 jpeg/png 交叉伪造；webp/gif；`bytes === data.byteLength`；`uchar`/sRGB/hasAlpha；4 MiB、16,777,216 pixels、8192 最大边的边界值。
- 图片数 8/9、派生图总字节 8 MiB、含图路径全请求 content blocks 20,000、完整 JSON 16 MiB；跨普通消息/一层 tool-result 均按全局 oldest-first 淘汰，淘汰项不读取 attachment。另锁定 20,001 个纯文本 block 仍走 `0.1.3` fast path。
- 更深 tool-result、assistant/system 图片与未知 block 在 attachment I/O 或 Responses POST 前失败；源图片 policy 错误为 `UNSUPPORTED_CONTENT`，store 返回损坏投影、图片淘汰后仍超限及通用 stop/schema/request 错误保持 `INVALID_RESPONSE`。tool-result 的 reasoning 与图片同行时仍锁定为通用非法 request，不能漂移成图片 capability 错误。
- 本地 fake/codec 测试与 CLI Chat Proxy 脱敏图片 spike 是两类独立证据；精确 `grok-4.6` 必须分别通过普通 user 与一层 tool-result 的红/蓝语义门禁，请求图片固定为 `detail:"high"`。`grok-4.5` 的受控红图语义不可靠，必须失败关闭为 text-only；真实 Harness attachment smoke 还必须独立复验仅 `grok-4.6` 保留图片、`grok-4.5`/未知模型 text-only 且网络请求为 0。
- Provider 只发 tool-call chunks，不执行工具/写文件；未声明工具名、恶意路径参数、伪造 server search/image/tool 事件不能绕过 Harness 权限层。后续搜索/生图版本仍不得把厂商 server-tool 事件映射为 Harness `tool-call`。

### Web RPC 与 TUI

- 非 loopback RPC 在 handler 前拒绝。
- 未知字段、未知 action、错误 sessionId 拒绝。
- `busy|cli-not-found|cli-unsupported|unsupported-auth-config|auth-required` 都是 `ok:true` 的闭合业务 outcome；`bad-request` 带 `details.issues`，signal 中止为 `cancelled`，未分类异常才是 `internal`。
- RPC 业务 DTO 不含 Harness carrier correlation；插件 `diagnosticId` 与 token/process/OAuth state 无关。
- dependency throw、恶意 `toJSON`/序列化 throw 和 canary error message 都由 non-throwing handler 折叠为固定脱敏 `internal` RpcResult；不得逃逸成 HTTP 500。
- RPC 递归扫描不含 token、path、URL、stdout/stderr。
- `/grok` 只接受 `status|login|cancel|logout` 的闭合语法，额外参数返回 usage。
- `/grok` 不进入模型消息；`recordInput: false`。
- `recordInput:false` 仍记录命令名、run/done 和返回 text；验证这些持久字段全部脱敏，并覆盖命令后的原始分隔空白。
- TUI invocation signal 能取消 login。
- Web 与 TUI 同时 login 只产生一个官方 CLI 进程。
- `beginLogin` 只在 spawn 成功后返回 session；Web 轮询 status，TUI 等待同一 session；错误/陈旧 sessionId 不能取消后来启动的 login。
- logout confirmation 单次使用、短 TTL、绑定 auth generation；Web 明确确认，TUI 在 TTL 内第二次 `/grok logout` 才执行。
- E2E 验证 rc.2 loopback trust fence 拒绝错误 Origin/Sec-Fetch 的浏览器请求；不把它误写成网络认证或 sender/frame/user-gesture 证明。前台 login 按钮、logout 二次确认、旧 sessionId/confirmation ID 失效属于防误操作 UX；同用户本地进程不在该边界内。

## 5. 集成测试

使用两个独立 loopback 服务：

1. fake pinned API。
2. fake redirect/attacker origin。

断言第二个服务在所有 3xx 状态与恶意 body 情况下都收不到 Authorization、Cookie、Referer 或请求 body。

使用 fake official CLI executable：

- 记录 argv、cwd 和允许的环境变量名，不记录值。
- 模拟成功、取消、超时、输出超限、退出 0 无凭据、退出非零。
- 原子创建 fake auth 文件，验证 Host 热读。
- 测试卸载时进程和所有 handler 均注销。

## 6. 平台矩阵

| 平台 | 自动测试 | 真实 smoke |
|---|---:|---:|
| macOS arm64 | 必须 | 必须 |
| Windows x64 | 必须 | `0.1.0` 发布后首次验证；后续非强制 |

macOS x64 不在当前官方 Grok CLI 支持矩阵，也不写入 `0.1.0` 发布承诺。只有 Gate 1 对某个精确官方版本取得 Intel macOS 发布证据后，才能作为非阻断实验记录；runner 可用本身不等于官方支持。

所有平台使用 Harness 内置 Node 24。仓库当前是原生 ESM JavaScript，不配置独立 lint/typecheck 命令；`npm test` 负责确定性构建、脚本语法、unit/integration/platform 与发行制品契约，`0.1.1-rc.2` 的真实 Harness 加载负责验证实际 peer/runtime 接口。若后续修改公开 `.d.ts` 契约，必须在发布前增加独立 TypeScript consumer typecheck。

Windows 特有用例：

- `%USERPROFILE%`、盘符大小写、UNC、ADS、保留设备名和 reparse point。
- 路径包含空格与非 ASCII 字符。
- 真实观察登录不闪出额外 shell/console 窗口；rc.2 subprocess seam 没有 `windowsHide` 字段，不能用不存在的契约替代 smoke。
- 取消不会误杀浏览器，只终止登录 CLI。

macOS 特有用例：

- 官方相对 symlink、FileVault 场景说明、arm64 binary 匹配。
- 路径包含空格与非 ASCII 字符。
- 默认浏览器由官方 CLI 打开，不调用插件自己的 `open`。

## 7. Harness 端到端

Web 与 TUI 分别验证：

- 插件安装、Harness 重启和 Provider/模型发现。
- 登录状态、浏览器登录、取消、退出和重新登录。
- Web/TUI 共用官方凭据状态。
- 多轮对话、reasoning、工具调用、工具结果继续生成。
- 中止、429、认证过期、断网和 Harness 重启。
- HMR/unload 后 adapter、RPC、command、settings slot 和子进程全部清理。
- Host 连续 activate → unload → activate 两轮后仍只有一个 adapter/RPC/command；async disposer 在 `Promise.allSettled(inflight)` 后才完成。
- client bundle revision 更新后旧 settings slot、listener、store/controller 被释放，不出现重复页面。
- subprocess service 替换时对应 child fiber 卸载，login tree 终止并 `waitForExit()` 后才重新安装 capability。
- teardown wait 有界；`waitForExit()` 返回 `false` 时 HMR 不永久挂起，登录 capability 保持隔离并要求 Host 重启或 subprocess service replacement，不能自动启动第二棵树。
- Web、TUI、headless profile 分别覆盖缺失 optional peer/service；缺少 subprocess 时登录按钮/命令明确不可用，但已有合格会话的 Provider 可安全启动。
- Web dashboard 只在 credential ready 后请求固定 billing/models；分别覆盖百分比+重置时间、仅重置时间、旧 monthly counters、空 config 与两个分支独立失败。
- dashboard RPC 与 client bundle 断言不含 token、credential path、`user_id`、email、team/principal ID、balance、history、原始响应或远端错误。
- dashboard 从同一模型目录投影 `textInput`/`imageInput`；覆盖精确 image/text-only 卡片和缺失、空、未知、重复、accessor-backed modality，只有 image-capable 卡片渲染图片标签。
- Provider Runtime 覆盖 official source、adapter 创建/注册和 configurable provider 注册各阶段失败；已取得资源逆序回滚，disposer 抛错后继续清理，多错误顺序稳定，`dispose()` 即使首次抛错也不重复执行。
- 视觉验收覆盖桌面双列模型卡和 `max-width:680px` 单列规则；刷新操作不得触发重复登录或持久化额度。

## 8. 打包与供应链

- 确定性构建、脚本语法、unit、integration、platform 与发行制品契约测试全部通过；当前不存在的独立 lint/typecheck 命令不虚构为门禁，新增相应工具后必须接入 CI。
- `npm pack --dry-run --json` 文件白名单符合预期。
- 解包 tarball 后测试 root、`./client`、patch 和 exports。
- 扫描 tarball：无 token、测试账号、本机绝对路径、日志、fixtures 中的真实响应和 `node_modules`。
- root 与完整 runtime/optional dependency 图均无 `preinstall`、`install`、`postinstall`；普通构建/测试 scripts 不在该市场阻断集合中，但候选包不得依赖安装时构建。
- 从真实 tarball 在全新 Harness profile 安装，不依赖仓库外文件。
- GitHub macOS/Windows checkout 后发行文本统一为 LF；`grok-provider.patch.yml` 的逐字节契约不得因 `core.autocrlf` 改写。
- 发布 workflow 契约测试固定 Node `24.19.0`，并要求输入 tag、workflow ref/type/name/SHA、递归 peeled commit、非草稿/非预发行 Release 与唯一精确 asset 全部一致。
- 制品契约测试同时锁定 manifest/lockfile 版本、中英文 README 安装命令、`SECURITY.md` 源码版本和中文在前/英文在后的无重复标题 Release Notes。

## 9. 发布验收

`0.1.0` 发布前必须同时满足：

- 所有 P0/P1 测试通过。
- xAI 官方文档与服务条款复核通过。
- macOS arm64 真实浏览器登录、聊天与工具调用 smoke 通过。
- Windows x64 自动化平台测试通过，且 README、release notes 和 marketplace 元数据在首次真机验证前明确披露“代码支持、真机未验证”。
- npm 回读的 SHA-512 与本地发布 tarball 一致。

`0.1.0` 发布后原计划完成一次 Windows x64 Registry 精确版本真机验收；仓库所有者随后明确决定该验收不再阻断稳定发布，且普通后续版本不重复要求真机验证。`0.1.1` 及后续版本以 CI、契约测试、隔离安装和制品校验为常规门禁。`0.1.6` 改变了认证预检 deadline 所有权，因此加入 Windows slow-fake 与 Windows CI 聚焦门禁；仓库所有者于 2026-08-28 明确决定先发布 Registry 精确版本，再在 Windows x64 上验证浏览器确实弹出、取消与超时结算。发布前不得把代码/CI 覆盖表述为 Windows 真机已确认；验证失败时发布新的递增稳定修复版。

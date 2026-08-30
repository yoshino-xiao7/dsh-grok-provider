# 产品需求

## 1. 产品定义

提供一个原创的 DeepSeek Harness LLM Provider，使 Harness 能把 Grok Build 当作模型后端使用，同时保留 Harness 自己的会话、权限、工具和附件边界。

冻结的 npm 身份：

- 包名：`dsh-grok-provider`
- 首个精确版本：`0.1.0`
- Provider ID：`grok`
- 当前真机模型快照：`grok-4.6`、`grok-4.5`；生产目录动态发现账号可用的全部模型

项目选择无需 scope 所有权的唯一名称，避免把脚手架和 credential owner 绑定到 `@yukiryou` scope。`dsh-grok-provider@0.1.0` 已于 2026-08-26 由 npm 账户 `yukiryou` 首发；后续候选仍须在发布前核对包维护权与 Trusted Publisher 绑定。

## 2. P0 用户目标

- 在 Harness `0.1.1-rc.2` 中安装精确 npm 版本后出现 Grok Provider，并动态列出当前账号通过 Grok Build 可用的全部模型。
- macOS 和 Windows 用户使用相同的插件包，不需要平台专属脚本。
- 用户可从 Harness 发起官方 CLI 浏览器登录；插件能识别登录中、成功、取消、失败、凭据过期和未登录状态。
- Web 设置页能区分官方 CLI 缺失、无效、检测不可用、OIDC discovery 网络超时与真人授权超时，并显示 Provider/已验证 CLI 版本；这些诊断不得暴露路径、stderr、代理配置或 OAuth URL。
- 首版只接受与发布绑定 CLI 版本的 xAI 第一方 OIDC schema 相符的候选。CLI 有效配置若选择外部 auth provider、企业 OIDC、API key 或无法判定的凭据结构，插件必须显示“不受支持的认证配置”并拒绝由本插件把该 token 发给 xAI CLI Chat Proxy；这不把未签名 metadata 宣称成来源证明。
- 支持多轮文本对话、reasoning 增量、流式文本、工具调用、usage 和明确 finish 原因。只有首个非空 summary/raw delta 才创建可见 reasoning block；完整闭合但始终严格空的 lifecycle 仍被校验，却不显示空 `Think`。
- `0.1.9` 引入精确 `grok-4.6` 的 Web/X Search 协议与页面，`0.1.10` 补齐可写 Host settings 集成，`0.1.11` 首次兼容 High Effort + Web Search 的 reasoning 续跑；已发布 `1.0.0` 继续兼容实测的 completed `open_page` 与同一 Search-backed reasoning ID 的多段严格空占位：两个开关仍独立、默认关闭，后台/派生 purpose 不启用 Search，远端 server-tool lifecycle 不得投影为 Harness 本地工具。
- Harness 中止请求时，网络流和解析器都能及时终止。
- 热更新设置或重新认证不会让同一调用混用两组路由或凭据。
- 凭据不进入 renderer、RPC、settings、workspace、本插件日志、错误详情、诊断包或 npm tarball；官方 CLI 自身的日志、网络与遥测属于独立 vendor boundary。
- 本插件拥有并注入 Bearer 的推理请求只到固定 xAI origin，任何 3xx 都失败；官方 CLI 登录网络是独立信任边界。
- 发布物在 macOS arm64 的受管安装、重启和真实聊天 smoke test 中通过；Windows x64 首次真机验证在 `0.1.0` 发布后执行，验证前必须明确标注为“代码支持、真机未验证”。

## 3. P0 安全负需求

首版明确禁止：

- 复制、提取或反编译第三方/xAI 官方 CLI 的 OAuth Client ID，或接受用户提供任意 client ID。
- 保存 client secret，或把官方 access/refresh token 复制到 Harness credentials、settings、环境、日志、workspace 或 renderer。
- 由插件直接启动 shell、PowerShell、`cmd /c start`、`open`、`xdg-open` 或任意 URL opener；本约束不伪装成对官方 CLI 内部行为的保证。
- 通过 renderer/RPC 接收任意可执行路径、命令、参数、环境变量或 cwd；唯一允许的进程入口是 Host 内部验证后的官方 `grok`，参数只能来自闭合命令表。
- 接受用户、模型、远端响应或 marketplace 配置提供的 `baseURL`。
- 跟随重定向发送 Authorization。
- 把 Authorization、Cookie 或 Referer 带到图片、附件或远端返回的 URL。
- 将远端错误 body、请求 headers、完整 SSE 事件或凭据文件内容原样返回 UI。
- 在安装期间运行 `preinstall`、`install` 或 `postinstall`。

## 4. `0.1.0` 范围

### 账户与模型概览

- Web 设置页以账户状态卡、额度卡、模型能力卡的层级展示信息，并适配窄屏单列布局。
- 登录后展示官方 billing 返回的真实使用百分比和额度周期结束时间；数据缺失时明确显示不可用，不猜测。
- 展示账号动态可见的全部模型，以及上下文窗口、推理档位、文本/流式/tool capability。
- 首版不提供模型隐藏开关；Harness 模型选择器继续显示账号可见的全部模型。
- 页面支持手动刷新；额度与模型不写入插件配置或 workspace。

包含：

- 通过固定 `/v1/models` 动态发现的全部账号可用 Grok Build 模型；当前真实快照为 `grok-4.6` 与 `grok-4.5`。
- 文本输入与输出。
- reasoning 增量（远端协议实际支持时）。
- Harness 定义的工具调用增量。
- 流式 usage、finish、超时、取消与稳定错误码。
- 只读官方 Grok CLI 会话凭据。
- Host 侧官方 CLI 登录桥：`login`、`cancel`、`status`、`logout`。
- Web 设置页：认证状态、“使用 Grok 登录”、取消、退出、安装说明和隐私说明。
- TUI 闭合命令：`/grok status`、`login`、`cancel`、`logout`；Web 与 TUI 共用同一认证协调器。

不包含：

- 插件自管 OAuth、device flow、authorization-code callback、任意 URL opener、client ID 或 client secret。
- xAI API Key 模式。
- Grok ACP 或 `grok -p` headless 代理。
- 厂商侧 Web Search、X Search、远程抓取。
- 图片生成、图片 URL 下载或文件落盘。
- 图片输入（`0.1.0`–`0.1.3`）；已发布 `0.1.4` 按[能力路线图](./11-capability-roadmap.md)与 [ADR-0008](./adr/0008-image-input-request-compiler.md)只为精确 `grok-4.6` 独立引入，`grok-4.5` 与所有其他模型继续 text-only；维护版 `0.1.5`–`0.1.7`、发布后撤回的 sidebar quota `0.1.8` 与已发布 `0.1.9`–`1.0.0` 均不扩大该图片集合。
- 自定义 endpoint、企业 OIDC、自定义代理或多账号。
- 自动安装或更新 Grok CLI。
- 在远程 Web/headless 主机自动打开浏览器或无人值守登录的承诺。
- Linux 的发布承诺；实现应避免无谓的平台绑定，但首版只验收 macOS 与 Windows。

## 5. 用户流程

### 首次使用

1. 用户从 xAI 官方渠道安装与本机架构匹配的 Grok Build CLI。
2. 用户在 Web 设置页点击“使用 Grok 登录”，或在 TUI 输入 `/grok login`。
3. Host 从官方默认目录解析并对 `grok`/`grok.exe` 做路径、owner 和版本约束，通过 Harness `ctx.subprocess` 用固定 argv `[constrainedExecutable, "login", "--oauth"]` 启动它；该 seam 不做 shell 解释。
4. 在受支持的标准配置下，官方 CLI 打开系统浏览器、处理 OAuth/loopback callback，并管理自己的共享凭据；它可能先清除旧会话并在成功后同步 managed config。
5. 插件只向 UI 返回 `starting`、`running`、`succeeded`、`cancelled`、`failed` 等可观察闭合状态；不猜测“浏览器已打开”，也不回传原始 stdout/stderr、授权 URL 或 token。
6. 登录进程以成功、失败、取消或超时结算后，插件都先等待受管树、失效缓存并重新检查凭据；只有唯一、非歧义且符合绑定 CLI 版本第一方 OIDC schema 的记录才能把当前 credential 状态标成 `valid`，其他模式失败关闭。登录尝试 outcome 与当前 credential 状态分开显示。
7. 插件刷新固定 `/v1/models` 目录，用户选择当前账号可用模型并开始对话。

### 凭据过期

1. 官方 CLI 凭据过期或进入固定 skew 时，插件只对完全匹配的官方 OIDC record 启动一次 single-flight、30 秒有界的 `grok models`，由 CLI 自行刷新其凭据；随后重新读取并校验。刷新失败、CLI capability 缺失或 record 仍无效时以 LLM `AUTH` 失败，不循环、不降级。
2. 首个 401 使内存中的 lease 失效；已经发送的 POST 不自动重放。
3. 设置页显示“重新登录”；下一次明确用户动作才启动官方 CLI 浏览器登录。
4. 插件不删除、不修改官方 `auth.json`。

### 退出

Web 的“退出”或 TUI `/grok logout` 先中止本插件所有在途 Grok 请求并推进认证 generation，再由 Host 以同样的受限方式执行官方 `grok logout`，最后清除插件内存缓存。较早请求不得在退出后重新填充旧 token。插件不直接删除或修改其他应用的凭据文件。

## 6. 隐私与可观察性

- 提示词、工具参数、附件、搜索词默认不写日志。
- 普通日志只允许 endpoint ID、状态码、耗时、字节计数、插件错误码和随机 diagnostic ID；Harness RPC correlation 由 carrier 内部所有。
- 设置页明确说明提示词与工具结果会发送给 xAI Grok Build 服务；打开 Web/X Search 时，还必须就近披露模型生成的检索词、额外用量、citation 与 prompt-injection 风险。
- 两个 Search 开关默认关闭。关闭时 request 不声明厂商侧搜索工具；开启时只允许精确 `grok-4.6` 的已验证 descriptor/lifecycle。无论设置如何，插件都不能保证服务商内部永不检索，此残余行为需依据 xAI 当时文档披露。

## 7. 成功指标

- 受管市场安装结果为 `artifact-verified`。
- macOS arm64 和 Windows x64 的自动测试通过。macOS x64 不在当前官方 CLI 支持矩阵，也不属于 `0.1.0` 承诺。
- `0.1.0` 发布前至少一台真实 macOS arm64 设备完成安装、登录、流式对话、工具调用、中止、重启与重新认证 smoke。
- `0.1.0` 发布后在一台真实 Windows x64 设备对 Registry 中的精确 `0.1.0` 执行首次安装、登录、流式对话、工具调用、中止、重启与重新认证 smoke；该项是发布后跟进，不回溯阻断已经完成的首次发布。
- `0.1.1` 及后续版本不把重复真机 smoke 设为常规发版门禁；由 macOS/Windows CI、契约测试、干净安装和精确 tarball 校验承接。认证、官方 CLI、Harness subprocess 或平台安全边界变化时安排定向真机复核，但除非当次发布另行声明，不作为强制门禁。`0.1.7` 必须分别记录 CLI 缺失、discovery 超时与 discovery 可访问三种状态；在最后一种状态完成前不得声称 Windows 浏览器弹出已修复或已验证。
- canary secret 扫描确认日志、RPC、错误、临时文件和打包产物无泄漏。
- 协议测试确认第二个测试 origin 永远收不到 Authorization。
- `0.1.9` 的固定 Proxy 脱敏门禁分别覆盖 Web、X、Web+X、Web+Harness function；离线回归确认默认关闭 wire 不变、未支持 route 在 POST 前失败、Search 产生零本地 tool-call chunk，未知或未闭合 lifecycle 失败关闭。
- `0.1.10` 的真实 SettingsProvider 与隔离 Web Harness 验收已证明唯一可写 `llm-grok` namespace、两个开关默认关闭且可操作；设置更新只影响首次 await 之后尚未开始的新调用，已准备或在途调用保持原快照。
- `0.1.11` 已验证只在一个已完成 server Search 位于两段 reasoning 之间时允许已关闭 reasoning ID 一次性复用为严格空项；raw `reasoning_text` 与 summary lifecycle 互斥，replay 元数据不保存 raw 明文，后续请求只发送 encrypted content 与空 summary，当前流中的 raw delta 仍作为 Harness 可见 reasoning 输出。脱敏真实 probe 只观察到 summary/Search（34 个 summary delta、0 个 raw delta），因此 raw reasoning 仍只有协议 fixture 证据。
- `0.1.11` 已从 release commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5` 正式发布：final CI run `33303080849` 的 macOS 14 / Windows 2022 全绿；Trusted Publisher run `33303631312` 发布唯一 71 文件、207,022-byte packed / 656,139-byte unpacked 制品。SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`；npm `latest=0.1.11`，Registry、Release 与本地制品逐字节一致。本包 1 个 Registry signature、2 个 package attestations 与精确绑定 `release.yml` / `v0.1.11` / release commit / 发布 run 的 SLSA provenance 均已验证。该供应链证据不构成网络可达 Windows 真机浏览器弹出验收。
- `1.0.0` 已新增失败关闭回归：completed Web `open_page` 只接受 own-data 精确 `{type:"open_page",url}`，其中 URL 为非空且不超过 16 KiB UTF-8；streamed `output_item.done` 与 final `response.output` 必须逐项绑定 action type 和 URL。验证后仅丢弃该动作，不 fetch、不生成 Harness tool chunk、不进入 replay；未知键、accessor、空/超限/非字符串 URL、非 completed `open_page` 或前后不一致均返回 `INVALID_RESPONSE`。
- `1.0.0` 已证明：reasoning ID 的首次复用仍要求旧段已 `output_item.done` 且两段之间存在 completed Web/X Search；一旦该 ID 被 Search-backed 证明，后续只允许相同 ID/type 逐段以严格空 visible summary/content、无 summary/raw lifecycle 的完整 `added → output_item.done` 占位继续出现。terminal 只接受既定 own-data 字段，可选 encrypted content 仅作为有界 opaque 字符串处理；未知键、accessor、任一非空可见内容，以及 `response.incomplete` 发生时仍未 `output_item.done` 的复用段全部失败关闭；所有复用段已闭合后的 max-token 终态仍按既有契约接受。
- `1.0.0` 最终 release commit `c6548199582b122f1d285422eabea0205eaf602f` 的双平台 CI、唯一 72 文件制品、精确授权、Trusted Publisher run `33309083806` attempt 1、Registry 字节、签名、attestations 与 SLSA provenance 回读均已完成；npm `latest=1.0.0`。这些供应链证据不构成网络可达 Windows 真机浏览器弹出验收。
- `1.0.1` 已证明：启用 server Search 时，全部 Harness functions 先完整验证，再只从 wire definitions 移除与已启用 `web_search` / `x_search` 精确同名的 callable definition；关闭对应开关时本地 function 保留，历史 calls/results 不删除、不改名。request/decoder receipts 拒绝名称交集；source transport error 保留既有 `AUTH`、`RATE_LIMIT`、`ABORTED` 与 `PROVIDER_ERROR` 映射，只有真实 framing/JSON/协议错误进入 `INVALID_RESPONSE`。
- `1.0.1` 最终 release commit `3c25a53571531e35ac888df16df4fe6c01849e85` 的双平台 final CI、唯一 73 文件制品、精确授权、Trusted Publisher run `33313699790` attempt 1、Registry 字节、锁定隔离安装、生产依赖审计、签名、attestations 与 SLSA provenance 回读均已完成；npm `latest=1.0.1`。这些供应链证据不构成网络可达 Windows 真机浏览器弹出验收。
- `1.0.2` 只改变严格空 reasoning 的 Harness 投影及其对齐槽：普通空项继续执行既有 ID/type、sequence、output index、状态、summary/content 空性、大小、可选 encrypted content 与闭合校验；Search-backed 同 ID 复用额外保留精确 own-data 键集/accessor 拒绝。生命周期最终为空时产生零个可见 block，首个非空 delta 才按 output index 开始 block。正文、工具、usage、finish、可见非空 replay 与 Search replay 抑制不变；隐藏的普通空项不占 replay 槽，其 encrypted content 校验后不持久化；旧会话不回写。

## 8. `0.1.0` 历史发布阻断项

以下内容记录 `0.1.0` 发布前采用的门禁定义。`0.1.0` 已完成发布；后续版本以 [发布检查清单](10-release-checklist.md) 为强制门禁，并在对应版本分支记录当次风险接受与验证证据。

任一条件不满足都不得发布：

- xAI 官方文档或官方答复不允许第三方本地 adapter 使用官方会话凭据调用 CLI Chat Proxy。
- 服务条款或官方答复不允许独立插件使用该路径。
- 任一真实发现模型的基础流无法映射，或声明支持的工具调用无法无损映射到 Harness。
- 凭据只能通过不安全的 renderer、RPC 或明文复制方式获得。
- 官方 CLI 凭据筛选无法阻止 schema 不符 token 进入固定 Proxy。
- macOS arm64 发布前验收失败；或自动化 Windows x64 平台测试失败。
- GitHub repository 或 provenance 发布链未确定，或冻结包名在发布前被他人占用。

## 9. 后续版本

`0.1.0`–`0.1.3` 的“不包含”列表继续描述这些稳定版的发布事实。仓库所有者已于 2026-08-28 接受后续内容类型序列，完整切片、安全门禁与永久非目标见[能力路线图](./11-capability-roadmap.md)：

- `0.1.4`：仅图片输入。
- `0.1.5`：发布链路、账户面板能力标签和 Provider Runtime 安装事务维护；不新增模型能力。
- `0.1.6`：已发布图片历史中非 assistant 私有 reasoning 的兼容修复，以及 Windows 官方 CLI 登录预检的分阶段 deadline 修复；不新增模型能力。
- `0.1.7`：已发布 Windows 官方 CLI 安装/版本诊断、登录失败可解释性与 Web 设置导航 `IconThinkOutline16` 维护；不改变官方 CLI 网络/代理或 OAuth 流程，不新增模型能力。
- `0.1.8`：sidebar quota 维护版曾发布后撤回；npm Registry 已消耗该版本号，不能把 Search 重新标记或发布为 `0.1.8`。
- `0.1.9`：已为精确 `grok-4.6` 发布默认关闭、设计为可独立开启的 Web Search / X Search 协议与页面，但遗漏 Host `llm-grok` namespace，真实页面开关不可用。
- `0.1.10` 已发布：补齐 canonical settings namespace 与按调用动态快照，使 `0.1.9` 的两个开关真正可写。
- `0.1.11` 已发布：修复 High Effort + Web Search reasoning 生命周期兼容并支持官方 raw reasoning 事件；不改变 Search descriptor、支持模型、认证或图片边界。
- `1.0.0` 已发布：接受 fixed Proxy 已实测的 completed `open_page` 精确动作，并把 Search-backed reasoning ID 从“一次复用”收窄调整为“可多段复用、每段必须严格空且闭合”；不执行 URL、不新增本地工具、不扩大模型、认证、图片或 origin 边界。
- 再后续独立切片：默认关闭的图片生成（内联结果 → Harness attachment）。

`prompt_cache_key` 不与图片输入捆绑；若以后排期，需独立分析会话标识隐私和 POST 不自动重放边界。任意 URL 下载、API Key、企业 OIDC、ACP、Headless 和 Linux 仍不在路线内。公开协议可驱动隔离原型，但每个切片在声明能力、合并发布基线前必须有独立 ADR 与固定 CLI Chat Proxy spike；`0.1.4` 的 `grok-4.6` user/tool-result 红蓝语义门禁已于 2026-08-28 通过，`grok-4.5` 因语义不可靠失败关闭，最终 Harness attachment 复验见[上游证据页](./12-upstream-image-input-evidence.md)。

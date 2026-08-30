# 能力路线图

- 状态：**`1.0.0` Search 响应兼容修复开发候选；尚未发布**
- 当前 npm 稳定版：`0.1.11`
- 最近发布：`0.1.11`
- 当前候选：`1.0.0`（completed `open_page` 与多段 Search-backed reasoning 占位）
- 最近撤回：`0.1.8`（npm 版本号不可复用）
- 当前发布基线：`yukiryou/main@2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`

本文是 `0.1.3` 之后内容类型迭代的单一事实来源。`0.1.0`–`0.1.3` 的历史范围仍以 [ADR-0002](./adr/0002-v0.1-scope.md) 和[产品需求](./01-product-requirements.md)为准。

本插件仍是 DeepSeek Harness 的 LLM Provider，不复刻 Grok Build 的 Plan mode、Skills、MCP、Subagents、ACP 或 Headless agent。

## 1. 原则

1. **一次一刀。** 图片输入、搜索和图片生成不得进入同一个稳定版本。
2. **开发证据与发布证据分开。** 公开 xAI Responses 文档可以冻结离线接口并驱动测试；固定 CLI Chat Proxy 的脱敏真机 spike 是发布图片能力的额外硬门禁，二者不能互相冒充。
3. **能力按精确模型失败关闭。** `api_backend: "responses"` 只表示协议，不表示图片能力。未知模型默认 `inputModalities:["text"]`。
4. **不下载任意 URL。** 图片输入只读取 Harness attachment 的已验证字节并生成 data URL；不接受 URL、路径、file ID 或调用方预制 data URL。
5. **先完成本地编译，再发 Responses POST。** attachment 读取、投影校验、淘汰和最终 JSON 限额全部成功后，Adapter 才能启动推理 transport；模型目录 GET 可能已在 route 解析阶段发生。
6. **未知 SSE 继续失败关闭。** `0.1.4` 不放行搜索或生图事件。
7. **不改认证边界。** 不引入 API Key、企业 OIDC、自定义 endpoint、多账号，也不放宽官方 CLI 路径、argv 或凭据契约。

## 2. 版本序列

| 版本 | 能力 | 发布前置条件 | ADR |
| --- | --- | --- | --- |
| `0.1.4` | 图片输入 | Proxy 接受本版本的 data URL wire shape；Harness attachment 投影与限额可执行 | [ADR-0008](./adr/0008-image-input-request-compiler.md) |
| `0.1.5` | 发布链路、能力展示与安装事务维护；不新增模型能力 | 精确 tag/commit/Release 制品绑定、回滚与 UI 投影测试 | 复用现有接口与发布契约 |
| `0.1.6` | 图片历史 reasoning 兼容与 Windows 官方 CLI 分阶段 deadline | 聚焦回归、macOS/Windows CI、唯一制品与发布回读 | 复用现有图片与认证契约 |
| `0.1.7` | Windows 运行时诊断、登录失败可解释性与 `IconThinkOutline16` 设置导航图标维护 | 闭合 DTO/reason、lifecycle、UI/图标回归与 Windows 三态真机证据 | [ADR-0009](./adr/0009-runtime-diagnostics-and-login-failures.md) |
| `0.1.8`（已撤回） | sidebar quota 维护；不含 Search | 发布后撤回；npm 号码已消耗且不得复用 | 见 `0.1.8` 撤回说明 |
| `0.1.9`（已发布） | 默认关闭的 Web Search / X Search 协议与页面；Host namespace 遗漏导致开关不可用 | 固定 Proxy、双平台 CI、隔离 Harness、唯一制品与 Registry 回读均已关闭；发布后确认功能集成缺口 | [ADR-0010](./adr/0010-default-off-web-x-search.md) 与固定 Proxy 证据 |
| `0.1.10`（已发布） | 修复 `llm-grok` 注册与按调用读取 Search 设置 | 真实 SettingsProvider/LLM 回归、隔离安装、双平台 CI、唯一制品与 Registry 回读均已关闭 | [ADR-0010](./adr/0010-default-off-web-x-search.md) 的发布后修正 |
| `0.1.11`（已发布） | 修复 High Effort + Web Search reasoning ID 空占位复用，并支持官方 raw reasoning lifecycle | 闭合状态机回归、脱敏 summary/Search probe、双平台 CI、唯一制品与 Registry 回读均已关闭 | [ADR-0010](./adr/0010-default-off-web-x-search.md) 的响应兼容修正 |
| `1.0.0`（候选） | 接受 completed `open_page` 精确动作，并允许同一 Search-backed reasoning ID 多段严格空且闭合地复用 | open-page/reasoning 正负契约、脱敏真实 Web/X 完成、全量 Node 24、双平台 CI、唯一制品与明确发布授权 | [ADR-0010](./adr/0010-default-off-web-x-search.md) 的 `1.0.0` 增量 |
| 再后续版本 | 默认关闭的图片生成 | Proxy 返回可有界提交到 Harness attachment 的内联结果 | ADR-0011 |

版本号可因缺陷修复顺延。`prompt_cache_key` 与图片输入相互独立，不属于 `0.1.4`：它需要独立的会话标识隐私、路由稳定性和“不得自动重放已经发送的 POST”分析，不得作为图片请求失败后的重试/降级机制。

## 3. `0.1.4`：图片输入

目标：把 Harness 中的 jpeg/png 图片作为有界、无远端下载的 Responses `input_image` 发送给明确支持图片的 Grok 模型，同时保持纯文本 wire request 逐字兼容 `0.1.3`。

### 接口设计

`responses-request` 保留同步、纯函数的文本 encoder。新增异步 request compiler，调用方只有一条接口：

```js
const request = await requestCompiler.compile(options, preparedRoute)
```

- `preparedRoute` 与 auth/transport generation 一起由 `prepareCall()` 冻结，包含公开模型信息和私有 `imageInput` policy。
- Host 只惰性提供 `() => ctx.get("attachments")`；attachment 不是必需 inject，无图请求不查询服务。
- compiler 内部完成普通 user 与一层 tool-result 的有界图片发现、`readImageRequest`、data URL、旧图淘汰和 16 MiB 最终检查；transport 不理解这些细节。
- 普通 user 内容按顺序映射为 `input_text` / `input_image`；一层 tool-result 含图时映射为 `function_call_output.output` 内容数组。纯文本消息和纯文本 tool-result 保持原字符串形状。
- assistant/system 图片、更深 tool-result、webp/gif、无 projection 或超限内容都在 attachment I/O 或 Responses POST 前失败关闭。

### 模型能力

- `0.1.4` 发布版只对公开 xAI 模型页声明 text+image、当前 Proxy 目录已观察到且红蓝语义门禁通过的精确 ID `grok-4.6` 生成图片 route；`0.1.5` 不扩大该集合。
- 新出现的模型即使也是 Responses backend，也只声明文本，直到完成同等级证据更新。
- `grok-4.5` 即使公开模型页声明图片，也因固定 Proxy 红图语义不可靠保持 text-only；HTTP 200/SSE 完成不能替代语义门禁。`grok-4.6` 的普通 user 与一层 tool-result 红蓝证据见[上游证据](./12-upstream-image-input-evidence.md)。

### 资源上限

| 项 | xAI 公开上限 | `0.1.4` 本地上限 |
| --- | --- | --- |
| 格式 | jpeg/png | jpeg/png；同时校验 attachment 元数据、投影元数据与魔数 |
| 单图 | 20 MiB | 投影后最多 4 MiB |
| 像素 | 未声明 | 投影后最多 16,777,216 pixels |
| 最大边 | 未声明 | 投影后宽、高各不超过 8192 |
| 张数 | 未声明上限 | 每请求最多保留最新 8 张 |
| 总图片原始字节 | 未声明 | 投影后最多保留最新 8 MiB |
| 图片编译内容块 | 未声明 | 整个请求最多 20,000 个 block；只约束含图路径 |
| tool-result 嵌套 | 未声明 | 只支持消息中的一层 tool-result，不递归编码 |
| 完整请求 JSON | 未声明 | UTF-8 最多 16 MiB |

12 MiB raw 不能作为 16 MiB JSON 的图片预算：base64 本身就会膨胀到 16 MiB，尚未包含 data URL、文本、工具 schema 与 JSON。实现先按张数淘汰最旧图片，只读取保留项；再按投影后的真实字节淘汰；最后若完整 JSON 仍超限，继续逐张淘汰最旧图片。所有图片被淘汰后，剩余非图片请求仍超限属于通用 request 错误，不再伪装成图片 policy 错误。

### 错误与取消

- 文本模型、无 attachment store、store 不支持 `readImageRequest`、不支持的源图片位置/引用/MIME，或 attachment service 明确报告 projection 不可用，映射为 `UNSUPPORTED_CONTENT`。
- attachment 缺失、存储 I/O 故障，以及 store 返回 attachment ID、字节数、MIME 魔数、尺寸或色彩元数据不自洽的投影，都不伪装成用户内容错误；按未分类 provider 本地失败关闭为 `INVALID_RESPONSE`。
- 超过含图路径的 20,000-block 编译预算、更深 tool-result，以及图片全部淘汰后剩余 request 仍不合法，保持通用 request 的 `INVALID_RESPONSE`。
- AbortSignal 在查询 attachment 前检查，并原样传入每次投影；取消映射为 `ABORTED`。
- 任一编译失败时 `transport.streamResponses()` 调用次数必须为 0；这不表示此前没有模型目录 GET。

### `0.1.4` 不包含

- `prompt_cache_key`、`web_search`、`x_search`、`image_generation` 或任何新 SSE 事件。
- 公网/内网图片 URL、signed URL、file ID、路径读取、citation 跟随或 markdown 图片下载。
- assistant 图片输出、workspace 文件写入、第二个网络 origin、API Key 或 endpoint 配置。

### `0.1.4` 发布结果

- [x] request compiler / attachment seam / per-model route 接口冻结。
- [x] 用户图片、一层 tool-result、Abort、缺服务、旧图淘汰和纯文本回归测试。
- [x] ADR-0008、威胁模型、Harness 契约与测试计划同步。
- [x] 固定 CLI Chat Proxy 对精确 `grok-4.6` 的脱敏图片 POST：普通 user 与一层 tool-result 各覆盖红/蓝，4 次 stream 全部 completed，规范化整段只含正确颜色词与可选句末标点。
- [x] `grok-4.5` 红图语义不可靠，决定与未知模型一起保持 text-only；图片请求固定 `detail:"high"`。
- [x] 按最终集合复验 Harness `0.1.1-rc.2` 真实 `attachment-local` → request compiler → `LlmRuntime`：普通 user 与一层 tool-result 均保留有序图片 wire，仅 `grok-4.6` 保留图片，`grok-4.5`/未知模型 text-only，共编译 4 个请求且网络请求为 0。
- [x] 开发树 Node 24 本地全量测试、preflight `npm run pack:check` 与真机脚本加入后的聚焦测试。
- [x] 最终版本/发行文档同步后的 Node 24 全量测试（119 项、117 pass、0 fail、2 项 Windows-only skip）、生产依赖审计（0 漏洞）与 `npm run pack:check`（58 个文件）。
- [x] 代码 PR [#8](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/8) 已合并，macOS/Windows CI run [33149124946](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33149124946) 全绿。
- [x] 最终 release commit `59776af8e954aa6e14463c659a22c6c3d5798bb5` 的唯一 tarball、隔离安装、digest 与精确发布授权。
- [x] GitHub Release `v0.1.4` 与 Trusted Publisher run `33151195684` 发布完成；npm `latest=0.1.4`，Registry、Release 与本地制品逐字节一致，签名和 SLSA provenance 均已回读。

`grok-4.6` Proxy 语义门禁、Harness 最终 modality 复验、本地自动化、双平台 PR/CI、唯一制品与发布回读均已关闭，`grok-4.5` 保持失败关闭。

## 4. `0.1.5`：发布链路、能力展示与安装事务维护

- [x] 发布 workflow 强绑定精确稳定 tag ref、剥离后的 commit、唯一正式 Release asset 与候选 SHA-512，并固定 Node `24.19.0`。
- [x] 账户面板从严格模型目录投影 text/image capability；Provider Runtime 安装失败时逆序回滚，正常卸载保持幂等并尽力执行全部清理。
- [x] 代码 PR #10、发布证据 PR #11 与最终 release commit `4f0bcd84f96c1cd5d95dda2a01ce63ff6403b828` 的双平台 CI 全绿。
- [x] 唯一 59 文件、135,800-byte tarball 完成隔离安装与摘要核验；`v0.1.5`、GitHub Release 与 Trusted Publisher run `33162280108` 发布完成。
- [x] npm `latest=0.1.5`；Registry、Release 与本地制品逐字节一致，Registry 签名、npm publish attestation 与 SLSA provenance 精确绑定 release commit。

`0.1.5` 不新增模型、搜索或生图能力。下一内容切片必须重新完成独立 ADR、安全边界和发布门禁。

## 5. `0.1.6`：图片历史与 Windows deadline 维护

- 普通 user/system 历史中的私有 reasoning 只被省略，不转成 user text；相邻可见 text/image 顺序保持。
- 同 Provider assistant 的有效 encrypted reasoning replay 保持不变；一层 tool-result 仍只接受公开 text/image。
- executable 解析、只读验证、`--version`、`login --help` 和最终 CLI action 各自拥有 deadline，避免 Windows 冷启动累计消耗登录预算。
- 本版不改 Config、模型能力集合、固定 origin、认证模式或响应事件集合，不包含 Web/X Search。
- 最终 release commit `93519f77adc4ce2edfc1bbd27bce9e44d4805da6` 的唯一 tarball 为 60 个文件、145,620 bytes；SHA-256 为 `fd660d91216086496a4d189cb7e60b3445079913c97da41fccf805e3086c0347`，npm SRI 为 `sha512-Vsmzm+8tgmHCuS8WKfzicjgauupY9FZ5B/V+55KbCTggBrThDDArjeS2bwHUVpjd92CvO47ya3SHELdWtTijAQ==`。
- Trusted Publisher run `33177647530` 已完成，Registry 签名与 provenance 验证通过；npm `latest=0.1.6`。
- 发布后仓库所有者确认图片输入可用；Windows 直接运行官方 CLI 时在生成登录 URL 前发生 xAI OIDC discovery timeout，因此没有外部浏览器弹出证据，不得声称 Provider 已修复或已验证 Windows 浏览器登录。

## 6. `0.1.7`：Windows 诊断、闭合登录失败与设置图标维护

- 独立只读 diagnostics RPC 只在页面打开、用户重新检测或登录结算后运行，不进入每秒认证状态轮询；公开 DTO 只投影插件版本与 CLI 的 `ready|missing|invalid|unavailable` 闭合集合。
- CLI 缺失或无 `login --oauth` 能力时禁用登录，显示 xAI 官方安装入口与重新检测；插件不下载、安装、更新 CLI，不搜索 PATH 或接受 UI 任意路径。
- 登录失败只投影白名单 reason；固定 OIDC discovery endpoint 与 timeout 特征同时出现时显示“登录链接尚未生成”，不把 stderr、路径、环境或授权 URL 送到 renderer。本版不修复系统代理、上游网络或自行打开浏览器。
- 诊断并发共享、调用方取消、capability teardown、driver replacement 与认证轮询 epoch 必须闭合；失败进程树无法确认退出时锁存 `unavailable`，防止旧结果污染新 driver。
- Harness `settings.section` 当前没有原生 icon slot；候选包内嵌 MIT `IconThinkOutline16` 几何，通过设置导航内的精确本地化标签唯一匹配应用。匹配缺失或歧义时保留桌面端原图标，卸载时清理 marker、style 与 observer，并在发行制品中保留第三方归属。
- 本版不新增模型能力、Responses wire、认证 origin 或 Search runtime；Windows 可访问 discovery 时由官方 CLI 实际弹出浏览器仍是发布门禁，不得由自动化或图标变更替代。
- 最终 release commit `68f6b474bd860b829f03e7712ec79e8afe2b9b8d` 的唯一 64 文件、167,970-byte tarball 已由 Trusted Publisher run `33226665968` 发布；npm `latest=0.1.7`，Registry、Release 与本地制品逐字节一致，签名与 provenance 已验证。

## 7. `0.1.9`：已发布默认关闭的 Web/X Search

- 两个独立开关默认关闭；关闭时 request wire 不包含 server tool。
- 固定 CLI Chat Proxy 的 Web、X、双开与生产 function → `web_search` 顺序 Web+function 四组脱敏协议观察已完成；实现只允许实测 lifecycle，详见[证据页](./13-upstream-search-evidence.md)。
- request 与 response receipt 由同一深模块绑定；精确 `grok-4.6` 之外失败关闭，Web/X 远端调用产生零 Harness tool-call chunk。
- 搜索词、远端检索、额外用量、citation 和 prompt injection 风险必须在 UI 与安全文档中就近披露。
- 本地精确 Node 24 全量测试、生产依赖审计、69 文件 dry-run pack、生成 bundle/diff/秘密模式门禁已通过；候选与 main 合并提交的双平台 CI、隔离 Web Harness 四场景验收也已完成。隔离验收不覆盖浏览器手工对话、Agent/session loop、OAuth、真实账号/真实 xAI 请求或 Windows 真机。
- 最终 release commit `a0af7b74882546dc3d9477b8f6c1494935e6bfb4` 的 CI run `33295408650` 全绿；唯一 69 文件、190,049-byte tarball 的 unpacked size 为 603,475 bytes，SHA-256 为 `78c73c95ea71d66cad6e6146fed41c281f1c8b29f60353e3f20247ec23833210`，SRI 为 `sha512-GeXQg3qedCGZz9D5MMaHd8Afe5Bn0nxjG+PQmKOB2AxB3m6IiGA07PMD77dEAOJVbAzKk0SnxAOKTZMTQFtuYg==`。Trusted Publisher run `33295761336` 完成，npm `latest=0.1.9`，Registry、Release 与本地制品逐字节一致。精确 Registry 安装的 Host/client import/export smoke 通过；精确安装审计图汇总 71 个已验证签名与 3 个 attestations，本包 attestations endpoint 返回 2 项，SLSA provenance 精确绑定 tag、workflow、commit 与 release run。
- 上述协议与供应链门禁均已完成；但隔离 UI 使用合成 ready scope，Host Config 测试也只覆盖 startup config，未发现真实 `llm-grok` namespace 没有注册。发布后的真实页面因此失败关闭为不可用。

### `0.1.10` 修复切片

- 使用 Harness canonical settings module 注册 `llm-grok`，默认值、组合配置和用户层按标准顺序解析；无 settings service 时仍使用组合配置。
- Adapter 在调用开始且首次目录 await 前冻结策略；设置更新只影响后续调用，不改变已准备或在途请求。
- 不改变 Search descriptor、响应 lifecycle、模型 allowlist、citation 或 replay 规则；本版不新增能力。
- 真实 SettingsProvider/LLM 回归、真实页面可写 smoke、隔离安装、双平台 CI、唯一制品、Registry signature 与 provenance 门禁均已完成；npm `latest=0.1.10`。

### `0.1.11` 修复切片

- 只在一个已完成 server Search 位于两段 reasoning 之间时，允许已闭合 reasoning ID 以严格空 reasoning item 再出现一次；无 Search 间隔、未闭合、跨类型、非空或第二次复用保持失败关闭。
- 接受完整闭合的空 reasoning item；事件序号、output index、状态、内容与 encrypted replay 仍受闭合校验。
- 支持官方 raw `reasoning_text` content/delta/done 生命周期，并与 summary reasoning 严格互斥；replay 元数据不保存 raw 明文，后续请求只回传 `encrypted_content` 与 `summary: []`，当前流中的 raw delta 仍作为 Harness 可见 reasoning 输出。
- 脱敏真实 `grok-4.6` Web Search probe 经生产 decoder 完成 1 次 POST、68 个事件、34 个 summary delta、0 个 raw delta与 1 个 finish。它只证明 summary/Search 路径，raw reasoning 仍只有 fixture 证据。
- 不改变 Search descriptor、开关、模型 allowlist、citation、认证、图片或平台边界。代码 PR #25、merge commit `307ae3ac83526f388c6b4a0d1e1346353bd5f4aa` 与 main CI run `33302830043` 已通过。
- 最终 release commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5` 的 final CI run `33303080849` 在 macOS 14 / Windows 2022 全绿；唯一 71 文件 tarball 为 207,022 bytes packed、656,139 bytes unpacked，SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`。Trusted Publisher run `33303631312` 已完成，npm `latest=0.1.11`；Registry、Release 与本地制品逐字节一致。本包公开 metadata 的 1 个 Registry signature 与 2 个 package attestations 已验证，SLSA provenance 精确绑定 `release.yml`、`v0.1.11`、release commit 与该发布 run。

### `1.0.0` 修复切片（候选）

- completed Web Search 额外接受 own-data 精确 `{type:"open_page",url}`；URL 必须为非空且 UTF-8 不超过 16 KiB。streamed `output_item.done` 与 final `response.output` 必须绑定相同 action type 与逐字相同 URL。
- `open_page` 仅作为 xAI 已执行 server-tool 的协议结果验证后丢弃；插件不 fetch、不打开 URL、不生成 Harness tool-call chunk、不保存到 replay。非 completed 形状、未知键、accessor、错误类型、空/超限 URL 或 stream/final 不一致均失败关闭。
- reasoning ID 的首次复用继续要求旧段已闭合且两段间存在 completed Web/X Search；Search-backed 证明建立后，只允许相同 ID/type 继续出现逐段严格空 visible summary/content、无 summary/raw lifecycle 且有 `output_item.done` 的占位。terminal 只允许既定 own-data 字段；可选 `encrypted_content` 仅作为有界 opaque 字符串接受。任一非空内容、未闭合段、未知键、accessor 或 `response.incomplete` 继续失败关闭。
- `0.1.11` 的 raw reasoning 互斥、Search replay 抑制、固定 origin、Search 开关、精确模型 allowlist、图片、认证和平台边界保持不变。
- 公开 xAI 资料只证明 `open_page` 函数名和 `web_search_call` 分类，没有公开 fixed Proxy 的完整 action wire schema；本候选只接受脱敏真实观察到的精确形状，不推测 `find`、`browse` 或其他 action。
- 脱敏真实验证不得保存 URL、检索/回复内容、prompt 或凭据；本地全量测试已通过，发布状态仍必须等双平台 CI、最终提交、冻结制品、明确授权、Registry/signature/provenance 回读全部关闭后再更新。

## 8. 后续：默认关闭的图片生成

- 只接受已验证的内联 base64 结果并有界提交 Harness attachment。
- 不下载 URL，不写 workspace，不把 Authorization/Cookie/Referer 发送到第二 origin。
- 当前 SSE 单事件上限与生成图 base64 大小、assistant replay 形状必须先另行解决；`0.1.4` 不提前放行任何实现。

## 9. 永久非目标

- xAI API Key 模式，或订阅路径失败后静默 fallback 到 API Key。
- 任意 URL 下载、模型可控路径读取/写入、把 Bearer 带到第二 origin。
- 自定义 endpoint、企业 OIDC、多账号、自动安装/更新 CLI。
- ACP、`grok -p` Headless、Linux / macOS x64 发布承诺。
- 厂商 `code_execution`；Harness 已有本地工具权限层。

English summary: `0.1.11` is the current stable npm release from commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`; version `0.1.8` was briefly published for sidebar-quota maintenance and then withdrawn, and its npm version number remains unusable. Final CI run `33303080849` passed on macOS 14 and Windows 2022. The unique 71-file artifact is 207,022 bytes packed and 656,139 bytes unpacked, with SHA-256 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d` and SRI `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`. Trusted Publisher run `33303631312` completed; npm reports `latest=0.1.11`, and the Registry, Release, and local bytes are identical. This package's one Registry signature and two package attestations verified, and SLSA provenance binds `release.yml`, `v0.1.11`, the release commit, and the publish run exactly. The release repairs exact `grok-4.6` High Effort + Web Search continuation: one strictly empty reuse of a closed reasoning ID only across a completed server Search, closed empty items, and a mutually exclusive official raw `reasoning_text` lifecycle. Replay metadata does not retain raw plaintext; later requests send only encrypted content with an empty summary, while live raw deltas remain visible to Harness. A redacted real probe emitted 34 summary deltas and zero raw deltas, so raw reasoning remains fixture-verified rather than live-probe verified. Authentication, Search descriptors, image input, and platform support are unchanged; network-reachable browser launch on a physical Windows device remains a separate acceptance boundary. Version `1.0.0` is an unpublished candidate that narrowly adds exact completed `open_page` validation and repeated strictly empty, closed placeholders for a Search-backed reasoning ID. It never fetches the URL or exposes a local tool call, keeps Search replay suppressed, and must complete its own CI, frozen-artifact authorization, signature, provenance, and Registry verification before it can replace `0.1.11` as stable.

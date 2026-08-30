# `0.1.9`–`1.0.1` Web/X Search 上游与固定 Proxy 证据

- 状态：`0.1.9`–`1.0.0` 的协议、集成、双平台 CI、最终制品与发布回读均已关闭；`1.0.1` 同名工具冲突修正的代码/main 双平台 CI 已完成，但仍只是无冻结制品的源码候选
- 观察日期：2026-08-30
- 固定 origin/path：`https://cli-chat-proxy.grok.com/v1/responses`
- Provider client identity：`dsh-grok-provider/1.0.5`
- 协议目标版本：`0.1.9`；设置链路修正：`0.1.10`；首次 reasoning 响应兼容修正：`0.1.11`；补充响应兼容发布：`1.0.0`；同名工具冲突与 transport 错误归因候选：`1.0.1`

sidebar quota 维护版 `0.1.8` 曾发布后撤回，npm Registry 已消耗该版本号且不能复用；本页的 Search 能力基线始于已发布 `0.1.9`，并由已发布 `1.0.0` 补充响应兼容，不能据此把 Search 描述为 `0.1.8` 能力，也不能替代 `0.1.10` 的真实 settings 集成验收。

本页只保存协议形状、计数、闭合结果和错误边界，不保存 access token、refresh token、搜索词、prompt、回答正文、`open_page`/citation URL、X 帖子/用户内容或原始响应。

## 官方资料

- [xAI Tools Overview](https://docs.x.ai/developers/tools/overview)：Responses request 的 `web_search` 与 `x_search` descriptor。
- [xAI Web Search](https://docs.x.ai/developers/tools/web-search) 与 [X Search](https://docs.x.ai/developers/tools/x-search)：两个 server-side tool 的公开行为。
- [Tool Usage Details](https://docs.x.ai/developers/tools/tool-usage-details)：server tool 与 function call 的语义区别。
- [Citations](https://docs.x.ai/developers/tools/citations)：inline Markdown、annotation 与顶层 citations。
- [Streaming and Synchronous Requests](https://docs.x.ai/developers/tools/streaming-and-sync)：streaming lifecycle 与默认不返回大体积 tool output。
- [官方 Grok Build sampler source](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-sampler/src/client.rs)：X Search output 需要按 xAI-specific custom tool call 处理。
- [官方 Grok Build conversation types](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-sampling-types/src/conversation.rs)：Web 保存为 `WebSearchToolCall`，X 保存为 `CustomToolCall`，以及四类 X 子工具语义。

这些公开资料可以证明 `open_page` 函数名以及 Web 结果属于 `web_search_call` 类别，但没有公开 fixed CLI Chat Proxy 的完整 action wire schema，也不能证明 streamed item 与 final `response.output` 的逐字段形状。production allowlist 因此只采用下列脱敏真实观察到的精确形状，不推测 `find`、`browse` 或其他 action。

## 探针边界

`spikes/search-protocol-probe.mjs`：

- 只读取官方默认 Grok home 中已存在的生产 OIDC 登录状态；不打印凭据。
- 只允许一次 `GET /v1/models` 与一次 `POST /v1/responses`，拒绝重定向、其他 origin/path/query 和第二次 POST。
- request body 逐字绑定 guard；每次运行需要 case、模型和 UTC 分钟绑定的显式确认值。
- 只输出事件名、own-key shape、枚举、计数、字节数与 usage 数字；未知标识符使用 alias。
- 不输出 prompt、delta、arguments、custom tool input、搜索 query、source、citation title/URL 或回答文本。

真机调用可能产生额外用量；探针不承诺模型一定只调用一次远端工具。四组固定 case 均使用 `grok-4.6`。

## 观察结果

| Case | request bytes | Responses POST | server-tool 结果 | terminal |
| --- | ---: | ---: | --- | --- |
| Web only | 有界，单请求 | 1 | `web_search_call`；`in_progress/searching/completed` 各 1 次 | completed |
| X only | 346 | 1 | `custom_tool_call`；input delta/done 各 1 次；名称属于四项闭合集合 | completed |
| Web + X | 319 | 1 | Web 标准 lifecycle 各 1 次；X custom input delta/done 各 1 次 | completed |
| Web + function | 597 | 1 | Web 标准 lifecycle 各 1 次；fixture function name/JSON arguments 精确匹配 | completed |

Web + X 观察共 68 个 SSE event、4 个 output item、8 个 citation annotation；X only 观察共 65 个 event、3 个 output item、1 个 citation annotation；生产顺序的混合 function 观察共 57 个 event、3 个 output item、0 个 citation annotation。所有观察都只有一个 `response.completed`，没有未知 event 或 enum。

混合 function 已按生产 compiler 的 function → `web_search` request 顺序复验：request 为 597 bytes，只执行 1 次 models GET 与 1 次 Responses POST；Web lifecycle、fixture function name/JSON arguments 和 completed 终态全部精确匹配。

### Web Search 冻结形状

- request tool：`{"type":"web_search"}`。
- output item own keys：`action,id,status,type`。
- action own keys：`query,sources,type`，`type:"search"`；query/source 内容不进入 Harness chunk或日志。
- lifecycle event own keys：`item_id,output_index,sequence_number,type`。
- event：`response.web_search_call.in_progress`、`.searching`、`.completed`。

### `1.0.0` completed `open_page` 增量（已发布）

- 只在 completed `web_search_call` 接受 action own keys 精确 `type,url`，且 `type:"open_page"`。
- `url` 必须是非空、UTF-8 不超过 16 KiB 的 own-data 字符串；未知键、accessor、错误类型、空值和超限均失败关闭。
- streamed `output_item.done` 与 final `response.output` 必须绑定相同 action type 与逐字相同 URL；任何漂移均失败关闭。
- 校验后的 `open_page` 被丢弃：不 fetch、不打开 URL、不发 Harness tool-call chunk、不持久化、不进入 reasoning replay。
- `search` 的既有精确 `{query,sources,type}` 接受域保持不变；非 completed `open_page` 不能借此扩展。

### X Search 冻结形状

- request tool：`{"type":"x_search"}`。
- output item type：`custom_tool_call`；own keys 为 `call_id,id,input,name,status,type`。
- 允许名称：`x_user_search`、`x_keyword_search`、`x_semantic_search`、`x_thread_fetch`。
- input 流事件：`response.custom_tool_call_input.delta` 与 `.done`。
- `done.input` 和 completed item input 必须与累计 delta 一致；input 内容不输出、不持久化。

### Citation 冻结形状

- inline 可见 Markdown 由普通 `response.output_text.delta` 提供，保持为普通文本。
- annotation event：`response.output_text.annotation.added`。
- `url_citation` own keys：`end_index,start_index,title,type,url`。
- 相同 annotation 还可能出现在 content part、message item 与 final response output 中；implementation 有界校验后丢弃。
- 顶层 `response.citations` 按官方文档同样有界校验后丢弃；插件不请求、不打开 URL。

## 能力结论

- `0.1.9` 仅为精确 `grok-4.6` route 提供 Web/X Search capability。
- `grok-4.5` 与未来动态模型默认无 Search，直到完成相同等级的固定 Proxy 证据。
- X 不能按公开候选 `x_search_call` 事件实现；当前固定 Proxy 必须使用四项闭合 custom-tool policy。
- Web/X lifecycle 产生零个 Harness tool-call chunk；function call 仍由 Harness 权限层处理。
- 观察到任一 server-tool 后禁用本响应的 encrypted reasoning replay。
- `1.0.0` 中，reasoning ID 的首次复用仍须由旧段闭合和位于两段之间的 completed Web/X Search 共同证明。建立 Search-backed 状态后，只允许相同 ID/type 继续出现逐段严格空 visible summary/content、无 summary/raw lifecycle 且收到 `output_item.done` 的占位；terminal 可选 `encrypted_content` 仅作为有界 opaque 字符串处理。未知键、accessor、任一非空内容、未闭合段，以及 `response.incomplete` 仍有 open 复用段时继续失败关闭；闭合复用段后的 max-token 终态保持有效。

## 发布门禁与集成后记

- [x] request/compiler、严格 codec、Adapter、真实 Host Config → LlmRuntime 与 settingsScope 设置页聚焦测试全绿。
- [x] 全量 Node `24.19.0` 测试通过（221 项、219 pass、0 fail、2 项 Windows-only skip）；生产依赖审计为 0 漏洞，干净提交的 dry-run pack 为 69 个文件，生成 bundle/diff/秘密模式扫描通过。
- [x] 以 function → `web_search` 顺序单独重跑 mixed 固定 Proxy 脱敏协议探针，并更新该 case 的 request bytes 与事件计数。
- [x] 候选 push/PR 与 main 合并提交的 macOS 14 / Windows 2022 CI 通过。
- [x] macOS 隔离 Web Harness profile 的真实 `ctx.llm` 路径完成默认关闭、Web-only、X-only 与 function → `web_search` Mixed 四组验收；fetch 在插件导入前由失败关闭 fixture 接管，无 passthrough 或外部 xAI、npm、login 请求。该证据不覆盖浏览器手工对话、Agent/session loop、OAuth、真实账号、真实 xAI 请求或 Windows 真机。
- [x] 发布证据 PR #21 合并后的最终 release commit 为 `a0af7b74882546dc3d9477b8f6c1494935e6bfb4`，CI run `33295408650` 全绿。唯一 `dsh-grok-provider-0.1.9.tgz` 含 69 个文件、190,049 bytes，unpacked size 为 603,475 bytes，SHA-256 为 `78c73c95ea71d66cad6e6146fed41c281f1c8b29f60353e3f20247ec23833210`，SRI 为 `sha512-GeXQg3qedCGZz9D5MMaHd8Afe5Bn0nxjG+PQmKOB2AxB3m6IiGA07PMD77dEAOJVbAzKk0SnxAOKTZMTQFtuYg==`。
- [x] 不可变 `v0.1.9`、GitHub Release 与 Trusted Publisher run `33295761336` 已完成；npm `latest=0.1.9`，Registry、Release 与本地制品逐字节一致。精确 Registry 安装的 Host/client import/export smoke 通过；精确安装审计图汇总 71 个已验证签名与 3 个 attestations，本包 attestations endpoint 返回 2 项，SLSA provenance 精确绑定 tag、workflow、commit 与 release run。

`0.1.9` 发布后的真实页面检查证明上述协议证据没有覆盖 Host namespace 注册：`settings.describe` 可写但不包含 `llm-grok`，客户端因此正确派生 `unavailable` 并禁用开关；Host 同时只在启动时读取一次组合配置。`0.1.10` 增加真实 SettingsProvider + LLM Runtime 回归和 Adapter 首次 await 前快照回归，只修复设置进入后续请求的链路，并已正式发布。

`0.1.10` 发布后的真实 High Effort + Web Search 使用暴露另一条响应兼容边界：一次已完成 server Search 可以位于已关闭 reasoning item 与复用同一 ID 的严格空 reasoning 占位之间。`0.1.11` 只在这个精确顺序下允许一次复用；无已完成 Search 间隔、未闭合、跨类型、非空或再次复用仍失败关闭。它同时接受完整闭合的空 reasoning，并支持与 summary 严格互斥的官方 raw `reasoning_text` lifecycle。replay 元数据不保存 raw 明文，后续请求只发送 encrypted content 与空 summary；当前流中的 raw delta 仍作为 Harness 可见 reasoning 输出。

`0.1.11` 已从 release commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5` 正式发布；final CI run `33303080849` 的 macOS 14 / Windows 2022 全绿，Trusted Publisher run `33303631312` 已完成。唯一 tarball 含 71 个文件，为 207,022 bytes packed、656,139 bytes unpacked，SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`。npm `latest=0.1.11`，Registry、Release 与本地制品逐字节一致；本包公开 metadata 的 1 个 Registry signature 与 2 个 package attestations 已验证，SLSA provenance 精确绑定 `release.yml`、`v0.1.11`、release commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5` 与 Trusted Publisher run `33303631312`。

脱敏真实 `grok-4.6` Web Search probe 经生产 decoder 只发出 1 次 POST，观察 68 个事件、34 个 summary delta、0 个 raw delta、decoder accepted 与 1 个 finish；没有保存 prompt、回复正文、检索词、citation URL 或凭据。该结果验证当前 summary/Search 路径，不得描述为 raw reasoning 真机证据；raw reasoning 当前只有协议 fixture 回归。

`0.1.11` 发布后的补充脱敏诊断复现了两个独立拒绝点：同一已闭合 reasoning ID 在 completed Search 后再次作为严格空占位出现，以及 completed Web Search 返回 `open_page` action。最终 `1.0.0` 源码分两层复跑：原始 High Effort Web/X 协议各完成 1 次、各 64 个 SSE event，分别观察到对应 Search 且终态 `completed`；生产 adapter 共完成 5 次 Responses，direct Web/X 均为 `finish(stop)`，Harness 形状的本地 `x_search` call/result 续跑三轮依次为 `tool-calls`、`tool-calls`、`stop`，前两轮各 1 次本地调用。该续跑没有在同一 wire request 中同时放入 Harness `x_search` function definition 与 xAI `{ type: "x_search" }` server descriptor；`1.0.1` 后续才通过单变量 A/B 确认这一 HTTP 400 冲突。这只是当前账号环境中的协议兼容观察；冻结制品与发布授权另有独立证据。记录未保存 URL、检索/回复内容、prompt、原始响应或任何凭据。

`1.0.0` 的本地与发布门禁均已通过：新增 open-page/reasoning 聚焦回归 40/40、完整 Node 24 suite 245 项、生产依赖审计 0 漏洞、build/bundle、72 项 dry-run pack、秘密扫描与 diff 检查均完成。最终 release commit `c6548199582b122f1d285422eabea0205eaf602f` 的 final CI run `33308603394` 双平台全绿；annotated tag object `192561cda1ac58cbc4077f0de8fa614dff9a5557` peel 到该提交。Trusted Publisher run `33309083806` attempt 1 发布明确授权的唯一 72 文件制品；冻结候选、GitHub Release 与 npm Registry tarball 逐字节一致，npm `latest=1.0.0`，隔离安装、Registry signature、2 个 attestations 与 SLSA provenance 精确绑定均已验证。

## `1.0.1` 同名工具冲突证据（源码候选）

`1.0.0` 发布后的真实桌面会话仍出现 `INVALID_RESPONSE`。对实际运行代际和配置的只读核对证明已加载 Registry `1.0.0`，精确 `grok-4.6` 且 Web/X Search 均开启。一次授权回放在发送任何 SSE event 前收到 fixed Proxy HTTP 400；生产 SSE wrapper 将该 transport error 包装为 parser error，才造成 UI 的误导性 `INVALID_RESPONSE`。

请求结构检查定位到同名能力交集：40 个 Harness function definitions 中已经包含 `web_search` 与 `x_search`，而 Provider 又追加 `{type:"web_search"}` 与 `{type:"x_search"}`。因果 A/B 只改变这一项：保留 40 functions + 2 server tools 时 HTTP 400；移除两个同名 function definitions、保留其余 38 + 2 server tools 时请求被接受并完成。工具总数、模型、reasoning 档位和 Search 设置本身不是该差分的解释。

最终候选按生产路径完成一次额外、明确授权的原失败 X 会话结构验证：

| 维度 | 脱敏结果 |
| --- | ---: |
| Messages | 8 |
| Source function definitions | 40 |
| Wire function definitions | 38 |
| Wire server Search tools | 2 |
| 保留的历史 reserved-name function calls | 2 |
| Models GET | 1 |
| Responses POST | 1 |
| SSE events | 314 |
| 终态 | `response.completed` |

候选规则是：先完整验证所有 40 个 source functions，再精确过滤与本次已启用 server Search 同名的 wire definitions；关闭开关时保留本地工具；历史 `function_call` / `function_call_output` 不删除、不改名；request receipt 与 decoder receipt 都拒绝 function/server-tool 名称交集。SSE parser 透传 source transport error，使 fixed Proxy HTTP 400 进入既有 `PROVIDER_ERROR` 映射，只有真正 framing/JSON/协议错误仍为 `INVALID_RESPONSE`。

诊断与最终验证没有保存或输出消息正文、回复正文、URL、账号身份、凭据或原始响应。精确 Node `24.19.0` 本地全量门禁（253 tests、251 pass、0 fail、2 platform skips）、生产依赖审计（0 漏洞）、确定性 build、隔离 cache 的 73 文件 dry-run pack 与预期仅 fixture canary 的秘密模式扫描已完成。代码 PR #31、merge commit `0c60200e12c3b8455331f31a317ece9b1945c458` 与 main CI run `33312621786` 的双平台门禁也已完成。当前证据仍不包含固定 final release commit 及其 CI、冻结候选 tarball、隔离安装、精确制品发布授权、Registry/signature/attestation/provenance 回读或 Windows 真机浏览器登录；`1.0.1` 仍未发布。

这些自动化与脱敏证据仍不构成所有平台完整真实账户验收；浏览器手工对话、OAuth、长会话 Agent loop 和网络可达 Windows 真机浏览器弹出保持独立边界。

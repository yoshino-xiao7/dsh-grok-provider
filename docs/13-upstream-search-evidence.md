# `0.1.9` Web/X Search 上游与固定 Proxy 证据

- 状态：`grok-4.6` 四组脱敏观察、生产顺序 mixed 复验、双平台 CI、隔离 Web Harness、最终制品与发布后回读门禁均已完成；`0.1.9` 已正式发布
- 观察日期：2026-08-30
- 固定 origin/path：`https://cli-chat-proxy.grok.com/v1/responses`
- Provider client identity：`dsh-grok-provider/1.0.5`
- 目标版本：`0.1.9`

sidebar quota 维护版 `0.1.8` 曾发布后撤回，npm Registry 已消耗该版本号且不能复用；本页所有 Search 证据只属于已发布 `0.1.9`，不能据此把 Search 描述为 `0.1.8` 能力。

本页只保存协议形状、计数和边界，不保存 access token、refresh token、搜索词、回答正文、citation URL、X 帖子/用户内容或原始响应。

## 官方资料

- [xAI Tools Overview](https://docs.x.ai/developers/tools/overview)：Responses request 的 `web_search` 与 `x_search` descriptor。
- [xAI Web Search](https://docs.x.ai/developers/tools/web-search) 与 [X Search](https://docs.x.ai/developers/tools/x-search)：两个 server-side tool 的公开行为。
- [Tool Usage Details](https://docs.x.ai/developers/tools/tool-usage-details)：server tool 与 function call 的语义区别。
- [Citations](https://docs.x.ai/developers/tools/citations)：inline Markdown、annotation 与顶层 citations。
- [Streaming and Synchronous Requests](https://docs.x.ai/developers/tools/streaming-and-sync)：streaming lifecycle 与默认不返回大体积 tool output。
- [官方 Grok Build sampler source](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-sampler/src/client.rs)：X Search output 需要按 xAI-specific custom tool call 处理。
- [官方 Grok Build conversation types](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-sampling-types/src/conversation.rs)：Web 保存为 `WebSearchToolCall`，X 保存为 `CustomToolCall`，以及四类 X 子工具语义。

公开资料不能替代固定 CLI Chat Proxy 的实测，所以 production allowlist 只采用下列脱敏观察。

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

## 发布门禁

- [x] request/compiler、严格 codec、Adapter、真实 Host Config → LlmRuntime 与 settingsScope 设置页聚焦测试全绿。
- [x] 全量 Node `24.19.0` 测试通过（221 项、219 pass、0 fail、2 项 Windows-only skip）；生产依赖审计为 0 漏洞，干净提交的 dry-run pack 为 69 个文件，生成 bundle/diff/秘密模式扫描通过。
- [x] 以 function → `web_search` 顺序单独重跑 mixed 固定 Proxy 脱敏协议探针，并更新该 case 的 request bytes 与事件计数。
- [x] 候选 push/PR 与 main 合并提交的 macOS 14 / Windows 2022 CI 通过。
- [x] macOS 隔离 Web Harness profile 的真实 `ctx.llm` 路径完成默认关闭、Web-only、X-only 与 function → `web_search` Mixed 四组验收；fetch 在插件导入前由失败关闭 fixture 接管，无 passthrough 或外部 xAI、npm、login 请求。该证据不覆盖浏览器手工对话、Agent/session loop、OAuth、真实账号、真实 xAI 请求或 Windows 真机。
- [x] 发布证据 PR #21 合并后的最终 release commit 为 `a0af7b74882546dc3d9477b8f6c1494935e6bfb4`，CI run `33295408650` 全绿。唯一 `dsh-grok-provider-0.1.9.tgz` 含 69 个文件、190,049 bytes，unpacked size 为 603,475 bytes，SHA-256 为 `78c73c95ea71d66cad6e6146fed41c281f1c8b29f60353e3f20247ec23833210`，SRI 为 `sha512-GeXQg3qedCGZz9D5MMaHd8Afe5Bn0nxjG+PQmKOB2AxB3m6IiGA07PMD77dEAOJVbAzKk0SnxAOKTZMTQFtuYg==`。
- [x] 不可变 `v0.1.9`、GitHub Release 与 Trusted Publisher run `33295761336` 已完成；npm `latest=0.1.9`，Registry、Release 与本地制品逐字节一致。精确 Registry 安装的 Host/client import/export smoke 通过；精确安装审计图汇总 71 个已验证签名与 3 个 attestations，本包 attestations endpoint 返回 2 项，SLSA provenance 精确绑定 tag、workflow、commit 与 release run。

发布与供应链门禁已经关闭，但固定 Proxy 观察、隔离 Web Harness 与精确 Registry Host/client import/export smoke 仍不构成浏览器手工对话、Agent/session loop、OAuth、真实账号/真实 xAI 请求或 Windows 真机验收。

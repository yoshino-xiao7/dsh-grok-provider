# ADR-0010：默认关闭且独立配置的 Web/X Search

- 状态：已接受，已在 `0.1.9` 正式发布
- 日期：2026-08-30
- 适用版本：`0.1.9`
- 取代：无

## 背景

xAI Responses 支持由服务端执行的 Web Search 与 X Search。它们会把普通对话内容以及模型据此生成的检索词交给 xAI，可能产生额外用量，并把网页、帖子、用户、线程及 citation 等不可信远端内容带回模型上下文。Harness 的本地 function tool 则由权限层执行，安全语义完全不同。

公开 xAI 文档只能说明候选 request descriptor；不能证明官方 Grok Build 登录所使用的固定 CLI Chat Proxy 会返回哪套 SSE。`0.1.9` 因此先对精确 Proxy、精确模型和精确 Grok Build client contract 做脱敏探针，再冻结实现。sidebar quota 维护版 `0.1.8` 曾发布后撤回，npm Registry 已消耗该号码且不能复用；本 ADR 的 Search 决策从未作为 `0.1.8` 发布，全部适用范围迁移到 `0.1.9`。

## 决策

### 1. 用户接口

Provider Host Config 增加两个独立 boolean：

```js
{
  webSearch: false,
  xSearch: false,
}
```

两项默认关闭。现有 Grok Build 设置页通过 Harness `settingsScope` 写入同一个 `llm-grok` 配置 namespace；不新增 Search RPC，不使用 `localStorage`，不维护第二份 renderer 状态。

设置页必须就近说明远端检索、额外用量、citation 与 prompt injection 风险。插件不会打开、下载或预览 citation，也不会把 Search 结果直接执行为命令或文件操作。

### 2. 一个深的 Responses call module

Adapter 只准备一次 call，并把精确 route 与现有 transport 交给同一个 protocol module：

```js
const call = responsesCalls.prepare(options)
for await (const chunk of call.stream({ route, transport })) {
  yield chunk
}
```

该 module 隐藏 request compiler、最终 request/receipt 绑定、SSE parser、server-tool 状态机和 citation 校验。Adapter 不接触也不能错误配对 response receipt。

最终 request 编译完成后，implementation 只从 `request.tools` 反向派生本次调用的私有 receipt：

```js
{
  functionNames: [/* exact requested names */],
  serverTools: [/* web_search and/or x_search */],
}
```

request 与 receipt 均复制并冻结。decoder 不从 Config、route 或原始 options 再计算允许项。

### 3. 请求规则

- 两项全关时不读取 `options.purpose`，不增加 request 字段；纯文本 wire 必须与 `0.1.7` 逐字节一致。
- 任一 Provider 开关打开时才读取 own-data `purpose`。`undefined` 表示普通对话；任意非空字符串表示后台/派生调用并强制关闭 Search；accessor、空字符串和其他类型在 Responses POST 前失败。
- `web_search`、`x_search` 只对固定 Proxy 已验证的精确 `grok-4.6` route 开放。动态目录中的其他模型默认没有 Search capability。
- 用户开启了模型不支持的 Search 时，整个调用在 POST 前返回 `UNSUPPORTED_CONTENT`；不静默裁剪、不删除工具后重放。
- 工具顺序固定为 Harness functions、`web_search`、`x_search`，共同受 128 项与 16 MiB 完整 JSON 上限约束。
- Search 继续复用唯一固定 `/v1/responses` transport，不增加 endpoint、origin、API Key 或任意 URL 请求。

### 4. 响应规则

固定 Proxy 的 `grok-4.6` 实测结果为：

- Web 使用标准 `web_search_call` output item 与 `in_progress → searching → completed` 事件。
- X descriptor 虽为 `{type:"x_search"}`，输出却是 `custom_tool_call`；只允许官方 Grok Build 使用的 `x_user_search`、`x_keyword_search`、`x_semantic_search`、`x_thread_fetch` 四个名称，并闭合校验 input delta/done。
- Web/X 都是服务端已执行的过程，产生零个 Harness `tool-call` chunk，不占本地权限层 block，也不改变 finish reason。
- Harness function call 的名称必须属于本次最终 request 的 function 集合。
- 任一 server-tool lifecycle 被观察到后，本响应不保存 encrypted reasoning replay，避免将未提交的检索轨迹带入后续回放；可见 reasoning/text/function call 仍正常投影。
- inline citation Markdown 已属于普通 assistant text，按原字符流保留。结构化 `url_citation` annotation 与顶层 citations 只做有界验证后丢弃，不拼接、不跟随 URL。
- 未启用类别、未知 tool/name/event/annotation、重复、乱序、截断或未闭合生命周期全部失败关闭。
- 只有 server-tool、没有任何可见 reasoning/text/function-call 的 completed stream 仍视为无效响应。

### 5. 并发与错误

每个 call 持有独立、冻结的 receipt 与 decoder FSM。设置更新只影响后续创建的 call，不改变在途请求。

- 不支持的精确模型能力：`UNSUPPORTED_CONTENT`。
- 协议、receipt、未知事件、未声明 function 或不闭合 lifecycle：`INVALID_RESPONSE`。
- Abort、认证、429 与其他 HTTP 错误沿用现有 `ABORTED`、`AUTH`、`RATE_LIMIT`、`PROVIDER_ERROR`。
- 任意 POST 一旦发出，失败后不得自动移除 Search 并重放。

## 安全后果

启用 Search 会扩大传给 xAI 和模型上下文的数据范围，且远端内容可能包含恶意提示。默认关闭、后台 purpose 关闭、精确模型 allowlist、零 URL 跟随和本地工具权限层分离共同限制该风险，但不能保证搜索结果正确或无提示注入。

## 被拒绝的方案

- 通用 server-tool registry：当前只有两个共享语义的闭合类别，会增加开放扩展面与错误配对风险。
- 独立 SearchClient/第二 transport：会复制认证、origin 和 deadline 边界。
- 把 Search 映射为 Harness function tool：会把服务端已执行的行为误报为等待本地授权。
- 从 `api_backend:"responses"` 或模型名前缀推导能力：协议类型不能证明 Search capability。
- 将结构化 citation 投影成可点击/可下载资源：引入第二 origin、SSRF 和宿主接口变化，不属于本切片。
- 每次对话临时传私有 Search 字段：Harness rc.2 没有正式 call config seam，会污染公共 GenerateOptions。

## 验证

协议证据与脱敏观察见 [`docs/13-upstream-search-evidence.md`](../13-upstream-search-evidence.md)。发布前还必须通过 request/codec/Adapter/UI 聚焦回归、全量 Node 24 测试、双平台 CI、生产依赖审计和唯一制品门禁。

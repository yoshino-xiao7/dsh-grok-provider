# ADR-0008：图片输入使用异步请求编译器

- 状态：Accepted；`grok-4.6` Proxy 门禁与 Harness 最终 modality 复验均已通过
- 日期：2026-08-28
- 适用版本：`0.1.4`

## 背景

`0.1.3` 的 `encodeResponsesRequest(options)` 是同步纯函数，只接受文本、reasoning replay、Harness function call 与纯文本 tool result。Harness 的图片块只保存不可伪造为 URL/路径的 `ImageAttachmentRef`；Provider 若要发送图片，必须异步调用可选 attachment service 的 `readImageRequest(ref, policy, signal)`，得到针对精确模型 route 的有界投影字节。

把 attachment I/O 直接塞进 GrokAdapter 会让内容遍历、格式校验、base64、资源预算和 transport 编排散落在多个 module。把所有 Responses backend 都标为图片模型又会把“协议”误当成“能力”，并导致 Harness 在到达 Adapter 前错误决定是否把图片投影为文本。

公开 xAI 文档给出了 Responses `input_image` data URL 与 `detail:"high"` 示例，并明确 `grok-4.6` 为 text+image 输入模型。固定 CLI Chat Proxy 随后对 `grok-4.6` 的普通 user 与一层 tool-result 分别使用红/蓝合成图；4 次 stream 均为 HTTP 200、`text/event-stream`、completed，规范化整段回复只含正确颜色词与可选句末标点。`grok-4.5` 的红图语义结果不可靠，因此失败关闭。

## 决定

### 1. 深化 request module

保留同步 `encodeResponsesRequest()` 作为无图唯一编码实现和兼容性 oracle；新增：

```js
createResponsesRequestCompiler({ getAttachmentStore }).compile(options, route)
```

compiler 是唯一理解图片输入的 module。它隐藏：普通 user 与一层 tool-result 的有界内容发现、attachment 投影、格式与元数据校验、data URL 生成、确定性淘汰和最终 JSON 限额。GrokAdapter 只 await compiler；compiler 成功后才启动 Responses 推理 transport。模型目录 GET 可能已在 route 解析阶段发生。

这是一条真实 seam：生产传入惰性的 `() => ctx.get("attachments")`，测试传入内存 store。attachment 不加入插件 mandatory inject；无图时 getter 不得被调用。

### 2. route 与 generation 一起冻结

model catalog 为每条记录生成同源的两类信息：

- 对 Harness 公开的 `resolvedModelInfo.inputModalities`；
- 只供 Adapter/Compiler 使用的 `imageInput` policy。

`prepareCall()` 必须在同一个 auth/transport generation 中解析完整 route，并将它与 stream closure 一起冻结。图片能力不能由 `api_backend === "responses"` 推导。

`0.1.4` 发布版与维护版 `0.1.5` 的精确图片模型集合只有 `grok-4.6`；`grok-4.5` 与未知 ID 明确保持文本。若 Proxy 后续提供可信、闭合的逐模型 modality 字段，可另行修订 catalog parser；在此之前不接受模糊 family、alias 或前缀匹配。

### 3. wire shape

- 无图：继续使用 `0.1.3` 字符串 content 形状，序列化结果逐字兼容。
- 普通 user 内容含图：一条 Responses message 的 `content` 为有序 `input_text` / `input_image` 数组。
- 一层 tool-result 含图：`function_call_output.output` 为同样的内容数组；纯文本 tool-result 仍是字符串；更深 tool-result 不递归编码并在 attachment I/O 前拒绝。
- `input_image.image_url` 只由已验证投影字节生成 `data:image/jpeg;base64,...` 或 `data:image/png;base64,...`；按 xAI 官方 Responses 图片示例固定使用 `detail:"high"`。
- system/assistant 图片及其他未知内容失败关闭。

tool-result 图片数组既有 OpenAI Responses 公开接口依据，也已由固定 CLI Chat Proxy 对 `grok-4.6` 的红/蓝合成图分别验证：`function_call_output.output` 的 `text → image → text` 数组被接受并完成整段颜色语义断言，因此 `0.1.4` 对该精确模型保留一层支持。更深 tool-result 仍在本地失败关闭，不做静默改写。

### 4. 资源策略

精确 route policy：

- jpeg/png；
- 投影后单图 `4 MiB`；
- 投影后最多 `16,777,216` pixels；
- 投影后宽、高各最多 `8192`；
- 每请求保留最新 `8` 张；
- 投影后保留图片原始字节合计最多 `8 MiB`；
- 含图编译路径整个请求最多 `20,000` 个 content block；纯文本继续沿用 `0.1.3` 接受域；
- 完整 JSON UTF-8 最多 `16 MiB`。

compiler 先按图片数淘汰最旧项，避免读取无用历史；再依据实际投影字节淘汰；最终 `JSON.stringify` 后若仍超限，逐张继续淘汰最旧图片。`12 MiB raw` 被拒绝，因为其 base64 长度已等于 `16 MiB`，没有为文本和 JSON 留空间。

返回投影必须满足：attachment ID 相同、`bytes === data.byteLength`、安全整数尺寸、像素/最大边、`depth:"uchar"`、`space:"srgb"`、允许 MIME 与匹配魔数。Provider 不在内存跨请求缓存；变体缓存归 attachment implementation 所有。

### 5. 错误与取消

- 不支持模型、无 store、无 projection、源图片位置/引用/MIME 不支持，或 attachment service 明确报告 projection 不可用：`UNSUPPORTED_CONTENT`。
- 已中止 signal 在查询 store 前终止；同一 signal 传给所有 `readImageRequest`，最终映射 `ABORTED`。
- attachment 缺失、读 I/O 故障，或 store 返回不自洽的 ID、bytes/data、MIME 魔数、尺寸和色彩元数据，均按内部投影契约错误映射 `INVALID_RESPONSE`，不冒充用户内容错误。
- 超过含图路径的 20,000-block 编译预算、更深 tool-result，以及图片全部淘汰后剩余非图片 JSON 仍超限，保持通用 request 的 `INVALID_RESPONSE` 语义。
- 任一编译失败都必须发生在 `streamResponses()` 前；route 解析所需的模型目录 GET 不计入此断言。

### 6. 明确排除 prompt cache

`prompt_cache_key` 不进入 compiler 或 `0.1.4`。它会引入会话标识隐私与 server-affinity 语义；“上游拒绝后去掉字段再试”还会重放已经发送的 POST，违反当前 401/失败不自动重放边界。若以后需要，必须独立 ADR，并设计首次发送前可判定的能力或明确幂等策略。

## 备选方案

### 把 `encodeResponsesRequest` 全部改为 async

拒绝。这样会让所有纯文本调用与测试无谓迁移，失去可直接比较的 `0.1.3` wire oracle。

### GrokAdapter 直接操作 `ctx.attachments`

拒绝。会把 Cordis 生命周期、图片协议和资源策略泄漏给编排层，形成浅 module。

### 向 compiler 传散落的 `supportsImages/maxBytes/...`

拒绝。完整私有 route 能让 capability 与 policy 来自同一事实，并随 generation 一起冻结。

### 所有 Responses 模型都声明图片

拒绝。backend 不是 modality；未知模型必须失败关闭。

### 直接发送 URL 或本地路径

拒绝。会扩大 SSRF、重定向、凭据跨 origin 和本地文件泄漏边界。

## 后果

- request module 从纯编码器深化为“同步文本 encoder + 异步图片 compiler”，调用方只有一个稳定的 compile seam。
- 无图调用多一次已决 Promise，但 wire 与 attachment 访问保持零漂移。
- 精确模型集合需要随证据维护；这种滞后是失败关闭的预期成本。
- 最多可能读取 8 张后再因实际总字节或最终 JSON 淘汰部分，产生有界本地浪费，但不会错误越过请求上限。
- 固定 CLI Chat Proxy 的 `grok-4.6` 两种图片位置×红蓝共 4 次真机请求与 Harness `0.1.1-rc.2` 最终 modality 复验均已通过；`grok-4.5` 因语义不可靠保持 text-only。详细脱敏证据见[上游证据页](../12-upstream-image-input-evidence.md)。全量测试、审计、打包、双平台 CI、制品验收和精确发布授权仍属于独立发行门禁。

# `0.1.4` 图片输入上游证据

- 状态：**公开协议、`grok-4.6` CLI Chat Proxy 图片语义门禁、Harness 最终 capability 复验及 `0.1.4` 发布回读均已完成；`grok-4.5` 已失败关闭**
- 核对日期：2026-08-28（Asia/Shanghai）

本文只记录脱敏、可公开的能力事实和验证边界。不得写入 token、身份字段、真实用户图片、prompt 或模型输出。

## 1. 公开 xAI 协议

xAI 官方 Image Understanding 文档给出 Responses API 的多模态 message 形状：`content` 数组按顺序包含 `input_text` 与 `input_image`，图片可使用 `data:image/...;base64,...`。公开限制为：

- jpeg/png；
- 单图最大 20 MiB；
- 图片与文本顺序可交错；
- 发送图片时建议 `store:false`。

官方 `grok-4.6` 模型页在核对日将其标为 Text、Image 输入和 Text 输出；Responses 图片示例使用 data URL，并显式设置 `detail:"high"`。公开 API 文档只证明 xAI Responses 接口与模型的公开能力，不证明 Grok Build CLI 凭据对应的固定 `https://cli-chat-proxy.grok.com` 已开放同一能力。即使公开模型页声明图片，插件也必须以固定 Proxy 的逐模型语义门禁决定是否广告该能力。

来源：

- https://docs.x.ai/developers/model-capabilities/images/understanding
- https://docs.x.ai/developers/models/grok-4.5
- https://docs.x.ai/developers/models/grok-4.6

OpenAI Responses 参考同时允许 function/custom tool output 使用 text/image/file 内容数组；这支持离线冻结一层 tool-result 的候选 wire shape，但不能替代 Proxy spike：

- https://platform.openai.com/docs/api-reference/responses-streaming/response/output_item

## 2. 已有 CLI Chat Proxy 证据

[Grok CLI 1.0.5 上游契约证据](./08-upstream-cli-1.0.5-evidence.md)已证明：

- 固定 `/v1/models` 当前返回 `grok-4.6`、`grok-4.5` 且 backend 为 `responses`；
- 两个模型的纯文本 Responses smoke 成功；
- `store:false`、reasoning replay、function call 与当前固定 headers 可用。

这些既有探测没有发送图片，因此不得写成图片能力已在 Proxy 验证。

## 3. 当前离线实现证据

Node 24 协议测试使用内存 attachment store 和合成 jpeg/png 字节，不访问网络，已覆盖：

- 纯文本 JSON 与旧 encoder 逐字一致且不查询 attachments；
- user `text → image → text` 顺序；
- 一层 tool-result `text → image → text` 数组；
- attachment 读取完成前 transport 不启动；
- 缺 store 时以 `UNSUPPORTED_CONTENT` 失败且 Responses POST 调用为 0；
- 已中止请求在查询 store 前终止，attachment I/O 期间的自定义取消 reason 最终映射为 `ABORTED`；
- 同一 attachment ID 请求内只读取一次；第 9 张图在读取前淘汰最旧项，投影字节超过 8 MiB 后也按全局顺序淘汰最旧项；
- webp 源引用在 attachment lookup 前拒绝；store 返回魔数、字节数、尺寸、像素、色深、色彩空间或 alpha 元数据不自洽的投影按内部契约故障拒绝；
- 含图路径超过 20,000 个 content block 时在读取前拒绝，同时 20,001 个纯文本 block 保持 `0.1.3` fast path 行为；
- 完整 JSON 超过 16 MiB 时确定性淘汰最旧图片；
- 最终离线 smoke 已验证 attachment 编译与 `LlmRuntime` 隔离链路：仅精确 `grok-4.6` 保留图片，`grok-4.5` 与未知模型均投影为 text-only。

离线测试证明本地接口与安全不变量，不证明服务端接受请求或模型真正观察到图片。

## 4. 2026-08-28 固定 CLI Chat Proxy 脱敏门禁

真机脚本使用当前官方 CLI 会话、固定 `https://cli-chat-proxy.grok.com`、诚实 client headers、`redirect:"error"` 与 `store:false`。网络 guard 只允许 `GET /v1/models` 和 `POST /v1/responses`，并在发送前逐项断言模型、消息位置、`text → image → text` 顺序、data URL、`detail:"high"`、tool call/result 关联和请求数量。

执行结果：

- [x] `grok-4.6` 普通 user 红图：HTTP 200、`text/event-stream`、唯一 completed finish；规范化整段回复只含正确颜色词与可选句末标点，语义断言命中。
- [x] `grok-4.6` 普通 user 蓝图：HTTP 200、`text/event-stream`、唯一 completed finish；同一闭合语义断言命中。
- [x] `grok-4.6` 一层 `function_call_output.output` 红图：HTTP 200、`text/event-stream`、唯一 completed finish；同一闭合语义断言命中。
- [x] `grok-4.6` 一层 `function_call_output.output` 蓝图：HTTP 200、`text/event-stream`、唯一 completed finish；同一闭合语义断言命中。
- [x] `grok-4.5` 的受控红图响应语义不可靠；不能因 HTTP 200/SSE completed 广告图片能力，最终决定与未知模型一起保持 text-only。
- [x] 所有探测均未发生第二 origin 或重定向；只有闭合 guard 允许的模型目录 GET 与 Responses POST。
- [x] 脚本在内存中完成语义判定后清空回复字符串，只输出模型 ID、case、method/path、HTTP 状态、归类后的 Content-Type、请求/图片/文本字节数、允许事件计数、terminal 与布尔断言；不输出或持久化 token、身份字段、图片、prompt、模型正文或原始事件。

多图淘汰、非 jpeg/png、单图/像素/总量上限、attachment/SSE 取消和失败时 Responses POST 为 0 由第 3 节的确定性本地测试覆盖；本次真机门禁不为这些失败路径额外消耗请求或保存远端错误正文。

## 5. Harness `0.1.1-rc.2` attachment 隔离门禁

隔离脚本加载真实 `@deepseek-ai/dsh-attachment`、`@deepseek-ai/dsh-attachment-local` 与 `@deepseek-ai/dsh-llm` `0.1.1-rc.2`，使用临时 `dshHome` 和本地受控 Responses transport。按最终模型集合的复验已完成，断言为：

- [x] `LocalAttachmentStore.saveImage()` 生成 `sha256:` 内容寻址引用，`readImageRequest()` 返回 128×64、`uchar`、sRGB 的 299-byte PNG projection；projection 保持原 attachment ID 并使用独立 variant ID。
- [x] 真实 `LlmRuntime` 仅对精确 `grok-4.6` 保留内联 `data:image/png;base64,...` `input_image`。
- [x] 同一 attachment 引用经真实 `LlmRuntime` 的一层 tool-result `text → image → text` 后，编译为保持顺序、精确 data URL 且固定 `detail:"high"` 的 `function_call_output.output`。
- [x] 同一目录中的 `grok-4.5` 与未知 `grok-future` 都投影为确定性 text-only 占位，不因 Responses backend 自动获得图片能力。
- [x] 共编译 4 个请求，网络请求数为 0；临时 attachment 目录在 finally 中删除。

## 6. `0.1.4` 发行结果

`grok-4.6` 的图片 wire、普通 user 与一层 tool-result 红蓝语义门禁已经完成，`grok-4.5` 已失败关闭。以下独立发布门禁也已关闭：

- [x] 按第 5 节最终模型集合完成 Harness attachment/LlmRuntime 复验。
- [x] 最终版本与发行文档同步后的 Node 24 全量测试（119 项、117 pass、0 fail、2 项 Windows-only skip）、`npm audit --omit=dev`（0 漏洞）与 `npm run pack:check`（58 个文件）。
- [x] 代码 PR [#8](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/8) 已合并，macOS/Windows CI run [33149124946](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33149124946) 全绿。
- [x] 最终 release commit `59776af8e954aa6e14463c659a22c6c3d5798bb5`、唯一 58 文件/130,958-byte tarball、隔离安装与制品 digest。
- [x] 不可变 `v0.1.4` tag、GitHub Release、Trusted Publisher run `33151195684`、Registry 逐字节回读、签名和 SLSA provenance。
- [x] 仓库所有者明确授权并完成精确 `dsh-grok-provider@0.1.4` 发布；npm `latest=0.1.4`。

这些发布事实不扩大图片能力集合。维护版 `0.1.5` 沿用相同的 `grok-4.6` image / 其他模型 text-only policy；`0.1.6` 只省略普通 user/system 历史中的私有 reasoning 并保留相邻可见 text/image，不改变图片模型集合、投影来源、资源上限或 Proxy wire。

`0.1.6` 已从 release commit `93519f77adc4ce2edfc1bbd27bce9e44d4805da6` 正式发布：唯一 tarball 为 60 个文件、145,620 bytes，SHA-256 `fd660d91216086496a4d189cb7e60b3445079913c97da41fccf805e3086c0347`，npm SRI `sha512-Vsmzm+8tgmHCuS8WKfzicjgauupY9FZ5B/V+55KbCTggBrThDDArjeS2bwHUVpjd92CvO47ya3SHELdWtTijAQ==`；Trusted Publisher run `33177647530` 完成，Registry 签名与 provenance 验证通过。发布后仓库所有者确认该精确版本的图片输入可用。

已发布 `0.1.7` 只增加 Windows 运行时诊断、登录失败可解释性与 `IconThinkOutline16` 设置导航图标维护。曾发布后撤回的 sidebar quota `0.1.8` 同样不修改图片边界；该 npm 版本号已消耗且不承载 Search。已发布 `0.1.9` 独立增加默认关闭的 Web/X Search，但不修改上述图片模型集合、attachment 投影、资源上限或图片 wire。

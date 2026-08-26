# Grok CLI 1.0.5 上游契约证据

状态：**开发绑定，尚未通过发布门禁**
核验日期：2026-08-25（Asia/Shanghai）

## 1. 精确版本

- 官方 stable 指针：`1.0.5`。
- 本机输出：`grok 1.0.5 (5115b46bc909)`。
- 首个开发 allowlist：只包含精确版本 `1.0.5` 与 build `5115b46bc909`；任何其他输出失败关闭，增补版本必须重新跑完整契约与真机门禁。
- 本机安装路径：默认 `~/.grok/bin/grok` 相对链接到 `../downloads/grok-macos-aarch64`。插件仍只支持默认路径；官方安装器支持 `GROK_BIN_DIR` 不代表插件必须接受自定义可执行路径。

## 2. 分发完整性现状

- `https://x.ai/cli/grok-1.0.5-macos-aarch64` 与安装脚本声明的 GCS fallback 逐字节相同。
- 两者 SHA-256 都是 `3dfa7f04fbb5427a8fbead286591543aaecb478b3a0ab222c4329eca1a3b2f86`。
- 官方路径未发现 `.sha256`、`.sha256sum` 或 `.sig` sidecar；本地记录的哈希只能用于复现实验，不能证明发布者身份。
- Mach-O 嵌入指定要求含 Team ID `5Y6N3AJ54S`，但重新下载且尚未执行的 CDN/GCS 副本以及本机安装副本均未通过 `codesign --verify --strict`，错误为 `invalid signature (code or signature have been modified)`。
- 因此当前不得把 macOS 签名描述为“已验证”，也不得把插件的路径、owner、版本检查包装成 publisher verification。该异常是发布阻断项；开发可继续，但 `0.1.0` 发布前必须由 xAI 修复或提供可验证的官方完整性机制，并重新记录证据。

## 3. 登录命令

`grok login --help` 确认 `1.0.5` 支持：

- `--oauth`：经 `auth.x.ai` 的 Grok OAuth；
- `--device-auth`：远程/headless 设备码；
- `--debug`、`--debug-file`、`--leader-socket`。

本插件只调用固定 argv `[constrainedExecutable, "login", "--oauth"]`，不传 debug 文件、leader socket 或设备码参数。

## 4. 真实凭据 schema（脱敏结构检查）

本机浏览器授权后的 `~/.grok/auth.json`：

- 权限为 `0600`，当前大小 1730 bytes；
- 顶层只有一条记录；map key 精确匹配 `https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828`；
- 记录字段包含 `key`、`auth_mode`、`create_time`、`user_id`、`email`、`first_name`、`profile_image_asset_id`、`principal_type`、`principal_id`、`team_id`、`coding_data_retention_opt_out`、`refresh_token`、`expires_at`、`oidc_issuer`、`oidc_client_id`。

核验过程只输出字段名、类型、字符串长度和 scope 是否命中，未输出任何字段值。实现只需要 `key`、`auth_mode`、`expires_at`、`oidc_issuer`、`oidc_client_id` 与顶层 scope；身份字段不得进入状态、日志或诊断。

## 5. refresh token 风险更正

直接读取该 JSON 文件意味着 Host 进程读到的原始字节包含 refresh token，即使解析器不使用该字段。原先“插件不掌握 refresh token”的绝对表述不成立。

实现约束：

- 使用有界、一次性读取；不缓存原始文本或完整对象；
- 解析后立即只保留闭合校验所需元数据和 access token lease，显式忽略 refresh token 与全部身份字段；
- 不把原始文本/异常、字段值或 token 放入日志、错误、设置、测试快照或诊断包；
- 插件不执行 refresh grant、不写回 `auth.json`；失效后要求官方 CLI 重新认证/刷新；
- 这只是缩短暴露窗口，不是进程级秘密隔离。发布说明必须披露 Host 会短暂读取含 refresh token 的文件内容。

若后续官方 CLI 提供只返回短期 access token 的受支持 broker 接口，应优先迁移并新增 ADR；在此之前这是已接受路线新增的 P0 审计面。

## 6. 尚待绑定

- `auth_mode`、issuer、client ID 的精确值关系（只通过常量比较验证，不在日志中打印用户记录值）。
- access token 到固定 Chat Proxy 的最小请求/流事件契约与 refresh 行为。
- Windows x64 官方 artifact 的哈希、Authenticode 与真实登录结构。
- xAI 对第三方本地适配器读取此凭据并调用 CLI Chat Proxy 的公开支持/许可依据。

## 7. 真实模型目录与 Responses 流

2026-08-26 使用本机已授权会话对固定 `GET https://cli-chat-proxy.grok.com/v1/models` 做了脱敏只读探测：

- HTTP 200，`application/json`，顶层 `{ object, data }`；
- `grok-4.6`：500000 context，backend `responses`，reasoning efforts 为 `xhigh|high|medium|low`，默认 `high`；
- `grok-4.5`：500000 context，backend `responses`，reasoning efforts 为 `high|medium|low`，默认 `high`。

随后用不含用户数据的最小 prompt 对 `grok-4.6` 做真实 `POST /v1/responses` 流探测：

- 缺少 `x-grok-client-version` 时返回 HTTP 426；
- 使用 `X-XAI-Token-Auth: xai-grok-cli`、`x-grok-client-version: 1.0.5` 与诚实的 `x-grok-client-identifier: dsh-grok-provider` 返回 HTTP 200；无需且不得冒充 `grok-shell`；
- 响应为 `text/event-stream`，观察到 Responses API 的 created/in-progress、reasoning summary part/text、output item、content part、output text 与 completed 事件；
- `grok-4.5` 使用相同诚实 headers 的最小流也返回 HTTP 200；当前真实目录中的两个模型都已完成基础调用 smoke；
- `grok-4.6` 的无副作用强制 fixture function call 返回 `function_call` item、`response.function_call_arguments.delta/done` 与 completed usage，确认 `item.id` 用于流关联而 `call_id` 用于 Harness 工具结果关联；
- 检查只保存事件名、字段名、状态和字节数，未保存 token、身份、prompt 内容或模型输出内容。

因此旧的固定 Chat Completions 假设已撤回。当前真实目录的两个模型都必须走 Responses codec；其他 backend 只有完成同等级协议与真机门禁后才能计入“全部模型支持”。

## 8. 当前 clean-room 实现真机回归

2026-08-26 在 macOS arm64 上直接运行本仓库的 credential loader、动态 catalog、固定 transport、Responses request encoder、SSE parser 与 Harness chunk codec；未经过第三方插件，也未输出 token、提示内容或回复内容。

- `/v1/models` 返回并成功映射 `grok-4.6`、`grok-4.5`。
- 两个模型均接受 `store:false` 与 `include:["reasoning.encrypted_content"]`，并完整产生 reasoning block、text block、usage 和 terminal finish。
- 两个模型返回的 reasoning item 都含非空 `encrypted_content`。当前实现把它按 Harness `ReplayEnvelope.blocks` 与内容块对齐保存，并在同一 provider、同一 model、版本与块数均匹配时恢复为下一轮 native reasoning input；两个模型的真实第二轮请求均成功。探测只记录字段名、类型、长度和 chunk 计数，未打印或保存密文。
- 两个模型均在同一 fake、未执行的 `fixture_tool` smoke 中恰好产生一个可解析 function call；name 与 JSON arguments 经当前 codec 校验通过。
- `grok-4.6` 的 `max_output_tokens:16` 真机探测以 `response.incomplete` 和 `max_output_tokens` 原因结束；当前 codec 对截断 text 合成闭合 block，并映射为 Harness `max-tokens` finish。截断 tool arguments 仍失败关闭。
- 当前实现因此覆盖本账号在该时点可见的全部模型；生产仍以动态目录为准，未来出现未知 backend 时失败关闭而不是猜测协议。

该回归只完成 macOS 上的官方 CLI credential 路径。它不替代 Harness 受管安装测试、浏览器登录真机测试、Windows x64 真机测试或发布门禁。

## 9. 已放弃的自管 OAuth 路线

2026-08-26 重新读取 `https://auth.x.ai/.well-known/openid-configuration`：issuer 公开 Device Authorization、refresh、revoke、PKCE 和 `none` client authentication，但没有 `registration_endpoint`。同日官方 `https://docs.x.ai/sitemap.xml` 中也没有 OAuth 应用注册或第三方 public client 申请页面。

这只能证明“协议能力存在、公开自助注册入口未发现”，不能推导任意 client ID 获得授权。ADR-0005 因而删除自管状态机、持久化、轮换和注销实现；`0.1.0` 不再等待独立 client ID，也不得复制官方 CLI client ID 或让用户输入第三方 client ID。

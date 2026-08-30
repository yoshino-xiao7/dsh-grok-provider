# 安全策略 / Security Policy

`dsh-grok-provider` 处理官方 Grok CLI 的本机会话，并把模型请求发送到固定的 xAI Grok Build 服务，因此凭据泄漏、任意 endpoint、重定向、命令执行和解析器绕过都属于高优先级安全问题。

## 支持范围

本安全策略对应当前稳定版 `1.0.0`，npm Registry 的 `latest` 也指向 `1.0.0`。最终 release commit 为 `c6548199582b122f1d285422eabea0205eaf602f`；annotated tag object `192561cda1ac58cbc4077f0de8fa614dff9a5557` peel 到该提交，final CI run `33308603394` 双平台全绿，Trusted Publisher run `33309083806` attempt 1 发布了仓库所有者明确授权的唯一 72 文件制品。该 tarball 为 226,704 bytes，unpacked size 715,014 bytes，SHA-1 为 `50e5d898dba241d1e19def7705db216e3060b892`，SHA-256 为 `30cd83dad77f7d2611126b3c4737c8fabffeae79f385fa623e61dcecfe39f5e2`，SRI 为 `sha512-WL2f6Kfg5yT5nNf1p4//mLSajCnZttL/pDR3BISrFgSGtZd9DEJlnibq08ETz503n1wHIdCBcU/ICMPG9K4vOw==`；冻结候选、GitHub Release 与 npm Registry 字节一致。Node 24 Registry 隔离安装的 Host `name`/`apply` 与 client `id` smoke 通过；`npm audit signatures` 确认安装图中 11 个包具有已验证 Registry 签名、2 个包具有已验证 attestations，本包公开 metadata 包含 1 个 Registry signature、2 个 attestations，provenance 精确绑定 `release.yml`、`v1.0.0`、release commit 与 publish run。`0.1.8` 曾发布后撤回且版本号不可复用。DeepSeek Harness、Node.js 与操作系统按发布线明确维护；网络可达 Windows 真机外部浏览器弹出仍未验收。

`1.0.0` 把 reasoning ID 复用收窄为 Search-backed 且严格空的完整生命周期：可见 summary/content 及 summary/raw lifecycle 必须为空，允许有界 opaque `encrypted_content`；每次复用都必须到达自己的 `response.output_item.done`，仅当 `response.incomplete` 到来时仍有复用段未闭合才失败关闭，所有复用段闭合后的 `max_output_tokens` 终态仍有效。非空、跨类型、未知 terminal 字段或 accessor 字段继续拒绝。完成态 Web Search `open_page` 只允许精确且有界的 `type + url`，streamed/final action 的类型与 URL 必须一致，校验后 URL 被丢弃且不会被访问、预览、下载或回放。脱敏真实账号复验未保存结果、URL、prompt、身份或凭据；供应链回读也不构成 OAuth、完整桌面会话或 Windows 真机浏览器验收。

当前 npm Registry `latest` 与稳定发布版均为 `1.0.0`；源码 manifest/lock 已进入尚未发布的 `1.0.1` 候选。候选在启用 server Search 时先完整验证全部 Harness functions，再只从最终 wire definitions 过滤与已启用 `web_search` / `x_search` 精确同名的 callable definition；历史 function call/result 保留，关闭对应开关时本地 function 保留。request 与 decoder receipt 都拒绝 function/server-tool 名称交集。SSE source transport error 原样上抛并保持既有认证、限流、中止与 `PROVIDER_ERROR` 映射，只有 framing、JSON 或协议错误归类为 `INVALID_RESPONSE`；失败后不自动降级或重放 POST。一次授权的脱敏原失败会话结构回放已完成，但没有保存正文、URL、身份、凭据或原始响应，也不构成制品、CI、发布或 Windows 真机浏览器登录证据。

`0.1.11` 沿用已发布版本的图片边界：只为精确 `grok-4.6` 提供有界图片输入；`grok-4.5` 与所有其他模型保持 text-only。普通 user/system 历史中的私有 reasoning 会被省略并保留相邻可见 text/image；只有有效的同 Provider assistant 历史可进入加密 reasoning replay，一层 tool-result 仍只接受公开 text/image。图片只能来自 Harness attachment service 的已验证 JPEG/PNG 投影，以 `detail:"high"` 发送，并受单图字节、像素、边长、数量、总字节与最终 JSON 上限约束；URL、路径、file ID 和调用方预制 data URL 都会被拒绝。

`0.1.7` 的闭合运行时诊断、CLI 安装恢复、OIDC timeout 脱敏结算和 `IconThinkOutline16` 兼容层在本版保持不变。官方 CLI 仍负责生成登录 URL 与打开外部浏览器；插件不修复系统 DNS、代理、防火墙、VPN 或 CLI 行为。

已发布的 `0.1.10` 通过 Harness 官方 settings module 注册 `llm-grok`，按 schema 默认值、组合配置、持久化用户层的顺序解析两个 Search 开关；设置提交只影响之后创建的调用。`0.1.11` 不改变这条设置链路，只收窄地扩展响应 codec：已闭合的 reasoning ID 最多可再出现一次，且必须有一个已完成的 server Search 位于两段 reasoning 之间，第二段必须是严格空项；无 Search 间隔、未闭合、跨类型、非空或第二次复用继续失败关闭。空 reasoning 项仍须完整闭合。官方 raw `reasoning_text` 与 summary reasoning 采用互斥状态机，混用、乱序、重复、截断和内容不一致均被拒绝；replay 元数据只保存加密内容及类型标记，不保存 raw 明文，下一请求只发送 `encrypted_content` 与 `summary: []`，不会回传或伪装为 summary；当前流中的 raw delta 仍作为 Harness 可见 reasoning 输出。脱敏真实探针完成 1 次 POST、68 个事件、34 个 summary delta、0 个 raw delta、1 个 finish，因此只能证明当前 summary/Search 路径，raw reasoning 仍只有协议 fixture 证据。Search 继续只为精确 `grok-4.6` 默认关闭地开放；结果和 citation 仍是不可信远端数据，Provider 不把远端 lifecycle 映射为 Harness 本地工具，也不跟随或下载 citation URL。固定路径/argv、最小环境、无 shell、输出上限、凭据、固定 origin 与 URL 拒绝边界不变；本版不新增生成、认证模式或 endpoint。

## 私下报告漏洞

公开仓库已启用 GitHub **Private vulnerability reporting**，请优先通过该入口报告。如果入口暂不可用，请只创建一个不含技术细节、凭据或个人信息的公开联络 Issue，请维护者提供私下沟通渠道。

报告应包含：

- 受影响的精确版本与平台；
- 最小复现条件和安全影响；
- 已脱敏的请求/响应形状或错误码；
- 建议修复方向（如有）。

绝对不要发送真实 `auth.json`、access/refresh token、`user_id`、Cookie、邮箱、姓名、完整提示词、工具参数、原图/投影图片字节或包含这些数据的诊断包。若秘密已暴露，请先通过官方 Grok CLI 注销/重新登录并按相应服务流程撤销凭据。

## 不属于漏洞的情况

- 网络可达 Windows 真机外部浏览器弹出尚未完成验收这一已披露状态；
- 上游未提供额度字段时 UI 显示 unknown；
- 不受支持的 CLI/Harness/平台版本被明确拒绝；
- 官方 CLI 或 xAI 服务自身的行为，且无法由本插件边界缓解的问题。

## 披露原则

维护者会先确认报告是否可复现和是否落在本项目边界内，再协调修复与发布。请在修复版本可用前避免公开可直接利用的细节。

---

Release security note: `1.0.0` accepts only complete Search-backed strictly empty reasoning reuse (empty visible summary/content and no summary/raw lifecycle, with bounded opaque `encrypted_content` allowed) and exact bounded completed `open_page` type/URL pairs whose streamed and final values agree. Every reuse requires its own `response.output_item.done`; an open/incomplete reused lifecycle, non-empty or cross-type reuse, unknown terminal fields, and accessor-backed Search items or response containers fail closed. A later max-token response remains valid after every reused lifecycle has closed. Redacted probes retained no results, URLs, prompts, identity, or credentials. Release commit `c6548199582b122f1d285422eabea0205eaf602f`, final CI run `33308603394`, the unique artifact, explicit authorization, Trusted Publisher run `33309083806` attempt 1, Registry integrity, signatures, attestations, and provenance are verified.

The current stable release and npm Registry `latest` are both `1.0.0`; the source manifest and lockfile now describe an unpublished `1.0.1` candidate. When server Search is enabled, the candidate fully validates every Harness function before omitting only callable definitions whose names exactly collide with enabled `web_search` / `x_search` server descriptors. Historical calls/results remain, local functions remain when the matching switch is off, and request/decoder receipts reject every function/server-tool intersection. SSE source transport errors retain their existing auth, rate-limit, abort, and `PROVIDER_ERROR` mappings; only framing, JSON, and protocol failures become `INVALID_RESPONSE`, and failures are never silently retried without Search. One authorized redacted replay of the original failing session structure completed without retaining text, URLs, identity, credentials, or raw responses. This is not artifact, CI, publication, or real-device Windows login evidence.

English summary: GitHub Private vulnerability reporting is enabled and preferred. The current stable release and npm Registry `latest` are both `1.0.0`; version `0.1.8` was published and then withdrawn, and npm version numbers cannot be reused. Release commit `c6548199582b122f1d285422eabea0205eaf602f`, annotated tag object `192561cda1ac58cbc4077f0de8fa614dff9a5557`, final dual-platform CI run `33308603394`, and Trusted Publisher run `33309083806` attempt 1 bind the explicitly authorized unique 72-file artifact. The tarball is 226,704 bytes packed and 715,014 bytes unpacked, with SHA-1 `50e5d898dba241d1e19def7705db216e3060b892`, SHA-256 `30cd83dad77f7d2611126b3c4737c8fabffeae79f385fa623e61dcecfe39f5e2`, and SRI `sha512-WL2f6Kfg5yT5nNf1p4//mLSajCnZttL/pDR3BISrFgSGtZd9DEJlnibq08ETz503n1wHIdCBcU/ICMPG9K4vOw==`. Frozen-candidate, GitHub Release, and Registry copies are byte-identical; the isolated Node 24 Host/client smoke and `npm audit signatures` passed. Public metadata exposes 1 Registry signature and 2 attestations, and provenance exactly binds `release.yml`, `v1.0.0`, the release commit, and publish run. The release accepts only complete Search-backed strictly empty reasoning reuse and exact bounded completed `open_page` pairs, discards validated URLs without visiting them, and retains the fixed-origin, credential, settings, model, image, and platform boundaries. Network-reachable external-browser launch remains unverified on a physical Windows device. Search results and citations remain untrusted remote data. Never send credentials, identity data, prompts, tool arguments, cookies, image bytes, Search contents, or unreviewed diagnostics.

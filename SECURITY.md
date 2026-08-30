# 安全策略 / Security Policy

`dsh-grok-provider` 处理官方 Grok CLI 的本机会话，并把模型请求发送到固定的 xAI Grok Build 服务，因此凭据泄漏、任意 endpoint、重定向、命令执行和解析器绕过都属于高优先级安全问题。

## 支持范围

本安全策略对应已发布的 `dsh-grok-provider@1.0.2` 制品。它只改变已通过严格校验的 reasoning lifecycle 向 Harness 可见 block 的投影：完整闭合且始终没有非空 summary/raw delta 的 item 不产生可见 block；首个非空 delta 到来时才开始 block。协议接受域、固定 origin、凭据、Search、模型、图片、工具和 URL 边界均不放宽。`0.1.8` 曾发布后撤回且版本号不可复用；网络可达 Windows 真机外部浏览器弹出仍未验收。

`1.0.0` 把 reasoning ID 复用收窄为 Search-backed 且严格空的完整生命周期：可见 summary/content 及 summary/raw lifecycle 必须为空，允许有界 opaque `encrypted_content`；每次复用都必须到达自己的 `response.output_item.done`，仅当 `response.incomplete` 到来时仍有复用段未闭合才失败关闭，所有复用段闭合后的 `max_output_tokens` 终态仍有效。非空、跨类型、未知 terminal 字段或 accessor 字段继续拒绝。完成态 Web Search `open_page` 只允许精确且有界的 `type + url`，streamed/final action 的类型与 URL 必须一致，校验后 URL 被丢弃且不会被访问、预览、下载或回放。脱敏真实账号复验未保存结果、URL、prompt、身份或凭据；供应链回读也不构成 OAuth、完整桌面会话或 Windows 真机浏览器验收。

`1.0.1` 已完成同名 function/server-tool 冲突、receipt 和 transport 错误归因修复及其独立供应链回读。`1.0.2` 不改变这些 request 或错误规则：普通空 reasoning 在决定“不可见”前继续执行既有 ID/type、sequence、output-index、状态、summary/content 空性、大小、可选 encrypted-content 与 terminal 闭合校验；Search-backed 同 ID 复用继续额外执行精确 own-data 键集与 accessor 拒绝。非空复用、乱序和未闭合复用项继续归类为 `INVALID_RESPONSE`。隐藏的普通空项不占 replay 对齐槽，其有界 encrypted content 校验后不持久化；server Search 仍不投影为本地工具。

`1.0.2` 的发布回读已关闭：最终 release commit `be200f9352afe93b27dd2856d89c01674f0cd637`，annotated tag object `b7efd3aabb99c73e1747d2d87890cdf9b284c438`，macOS 14 / Windows 2022 final CI run `33318426571`，Trusted Publisher run `33319150964` attempt 1。仓库所有者明确授权的唯一 74 文件制品为 255,282 bytes packed / 789,962 bytes unpacked，SHA-1 `3feddb7048fe4c796037804518999b12ae491802`、SHA-256 `010a21770cb3e4e42b7195984df1f5bf8dc5027066198cf99b7d713ac045f605`、SRI `sha512-TcvvPUXBJZEA728pVnUrXSZebGfIoB5ATG5041wA1OFzOE+hFTO98C5Fxl99WuFW2y7V89gkusYIKCpGlLNQIg==`；冻结候选、GitHub Release asset 与 npm Registry tarball 逐字节一致，npm `latest=1.0.2`。锁定隔离安装、本包 1 个 Registry signature / 2 个 package attestations、安装图 11 个 signed / 2 个 attested packages，以及精确绑定 `release.yml` / `refs/tags/v1.0.2` / release commit / publish run 的 SLSA provenance 均已验证。候选源码的真实账号验收只保留 Web `5/1/0/1/1` 与 X `3/1/0/1/1` 的 Search/non-empty-reasoning/empty-reasoning/non-empty-text/finish 计数；不保存内容、URL、身份、凭据或原始响应。上述证据均不构成 OAuth、完整桌面会话或网络可达 Windows 真机外部浏览器弹出验收。

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

Release security note: the published `1.0.2` artifact changes visible reasoning projection and its aligned replay envelope. A reasoning lifecycle that remains strictly empty produces no Harness block, while the first non-empty summary/raw delta begins the same visible block lifecycle used previously. Ordinary empty items retain their existing validation, and Search-backed same-ID reuse retains exact own-data/accessor checks. A hidden ordinary empty item's validated encrypted content is not persisted because no visible replay-alignment slot exists. No authentication, model, image, fixed-origin, URL, permission, or protocol-acceptance boundary is expanded. Version-specific publication and supply-chain facts above come from completed Registry, GitHub Release, signature, attestation, and provenance readback.

The `1.0.2` artifact retains the `1.0.1` function/server-tool collision and transport-error rules. An ordinary strictly empty lifecycle keeps the existing ID/type, sequence, output-index, status, empty summary/content, size, optional encrypted-content, and closure checks; a Search-backed same-ID reuse additionally keeps exact own-data key/accessor validation. Invalid reused content, ordering violations, and an open reused lifecycle at an incomplete terminal still fail closed; an ordinary non-reused partial item retains the existing max-token behavior. Visible non-empty replay and Search replay suppression remain unchanged, while a hidden ordinary empty item has no replay slot. Existing stored conversations are not rewritten, and this change does not establish real-device Windows browser login.

English summary: GitHub Private vulnerability reporting is enabled and preferred. This policy describes the published `1.0.2` artifact, which suppresses the visible block for a reasoning lifecycle that remains strictly empty. The first non-empty summary/raw delta starts the existing block lifecycle in output-index order. Ordinary empty items retain their existing validation; Search-backed same-ID reuse retains exact key/accessor rejection; invalid, out-of-order, or incomplete responses with an open reused lifecycle still fail closed. Hidden ordinary empty items have no replay slot, while visible non-empty replay and Search suppression remain unchanged. Ordinary non-reused partial items retain the existing max-token behavior. The final release commit, tag object, CI and Trusted Publisher runs, byte-identical frozen/Release/Registry tarballs, Registry metadata, signatures, attestations, isolated installation, and SLSA provenance have all been read back for `1.0.2`; these supply-chain facts do not prove OAuth, complete live desktop sessions, or real-device Windows browser launch. Version `0.1.8` was published and withdrawn and cannot be reused. Fixed-origin, credential, settings, Search, model, image, URL, permission, and platform boundaries remain unchanged. Network-reachable external-browser launch is still unverified on a physical Windows device. Search results and citations remain untrusted remote data. Never send credentials, identity data, prompts, tool arguments, cookies, image bytes, Search contents, or unreviewed diagnostics.

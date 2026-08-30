# 安全策略 / Security Policy

`dsh-grok-provider` 处理官方 Grok CLI 的本机会话，并把模型请求发送到固定的 xAI Grok Build 服务，因此凭据泄漏、任意 endpoint、重定向、命令执行和解析器绕过都属于高优先级安全问题。

## 支持范围

本安全策略对应当前稳定版 `0.1.11`，npm Registry 的 `latest` 也指向 `0.1.11`。`0.1.8` 曾发布后撤回且版本号不可复用。`0.1.11` 在已发布 `0.1.10` 的 Web/X Search Host settings 修复基础上，收窄修复精确 `grok-4.6` 在 High Effort + Web Search 续跑时复用已关闭 reasoning ID 作为空占位的兼容缺口，并加入官方 raw reasoning 事件支持。最终 release commit 为 `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`；annotated tag object `353bcd3717d4440ab20a2b05a5e9d51eef22fa7f` peel 到该提交，final CI run `33303080849` 双平台全绿，Trusted Publisher run `33303631312` 发布了仓库所有者明确授权的唯一 71 文件制品。该 tarball 为 207,022 bytes，unpacked size 656,139 bytes，SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`；Registry、GitHub Release 与本地字节一致。Registry 隔离安装及 Host/client smoke 通过；`npm audit signatures` 确认安装图中 9 个包具有已验证 Registry 签名、3 个包具有已验证 attestations，本包公开 metadata 包含 1 个 Registry signature、2 个 attestations，provenance 精确绑定 `release.yml`、`v0.1.11`、release commit 与 publish run。DeepSeek Harness、Node.js 与操作系统按发布线明确维护；Grok CLI 不使用完整版本字符串作为信任门禁，而是严格校验官方默认路径、命令能力、生产 OIDC 凭据契约和固定服务端协议。图片发送已在真实 Harness 对话中确认可用；脱敏真实 Search 探针不保存 prompt、回复、检索词、citation URL 或凭据，但也不覆盖浏览器手工对话、OAuth、完整真实会话或网络可达 Windows 真机外部浏览器弹出。

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

English summary: GitHub Private vulnerability reporting is enabled and preferred. The current stable release and npm Registry `latest` are both `0.1.11`; version `0.1.8` was published and then withdrawn, and npm version numbers cannot be reused. `0.1.11` repairs the High Effort + Web Search empty reasoning-ID reuse compatibility gap and adds a mutually exclusive official raw `reasoning_text` lifecycle. Annotated tag object `353bcd3717d4440ab20a2b05a5e9d51eef22fa7f` peels to release commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`; final dual-platform CI run `33303080849` and Trusted Publisher run `33303631312` bind the explicitly authorized artifact. The unique tarball contains 71 files, is 207,022 bytes packed and 656,139 bytes unpacked, has SHA-256 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d` and SRI `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`, and is byte-identical across local, GitHub Release, and Registry copies. The exact Registry install passed Host/client smoke; `npm audit signatures` confirmed verified Registry signatures for 9 packages and verified attestations for 3 packages, while public metadata for this package exposes 1 Registry signature and 2 attestations. Provenance exactly binds `release.yml`, `v0.1.11`, the release commit, and publish run. Replay metadata does not retain raw plaintext; later requests carry only `encrypted_content` plus `summary: []`, while live raw deltas remain visible to Harness. A redacted real probe produced one POST, 68 events, 34 summary deltas, zero raw deltas, and one finish, so it verifies only the summary/Search path; raw reasoning remains fixture-verified. Authentication, settings, image input, citations, endpoints, and platform support are unchanged. Network-reachable external-browser launch remains unverified on a real Windows device. Search results and citations remain untrusted remote data. Never send credentials, identity data, prompts, tool arguments, cookies, image bytes, Search contents, or unreviewed diagnostics.

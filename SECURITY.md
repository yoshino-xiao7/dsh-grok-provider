# 安全策略 / Security Policy

`dsh-grok-provider` 处理官方 Grok CLI 的本机会话，并把模型请求发送到固定的 xAI Grok Build 服务，因此凭据泄漏、任意 endpoint、重定向、命令执行和解析器绕过都属于高优先级安全问题。

## 支持范围

本安全策略对应源码候选版本 `0.1.9`。`0.1.8` 曾发布后撤回，npm 版本号不可复用；npm Registry 的 `latest` 与当前可安装的稳定基线仍为 `0.1.7`。DeepSeek Harness、Node.js 与操作系统按发布线明确维护；Grok CLI 不使用完整版本字符串作为信任门禁，而是严格校验官方默认路径、命令能力、生产 OIDC 凭据契约和固定服务端协议。已发布的 `0.1.7` 基线在 macOS arm64 完成真实验收，图片发送也已在真实 Harness 对话中确认可用；`0.1.9` Search 的隔离 Harness 验收仍待完成。Windows x64 有代码与 slow-fake 覆盖，`0.1.9` 正式候选仍需通过 Windows CI，且尚未在网络可达的 Windows 真机上确认外部浏览器弹出。

`0.1.9` 沿用已发布 `0.1.7` 的图片边界：只为精确 `grok-4.6` 提供有界图片输入；`grok-4.5` 与所有其他模型保持 text-only。普通 user/system 历史中的私有 reasoning 会被省略并保留相邻可见 text/image；只有有效的同 Provider assistant 历史可进入加密 reasoning replay，一层 tool-result 仍只接受公开 text/image。图片只能来自 Harness attachment service 的已验证 JPEG/PNG 投影，以 `detail:"high"` 发送，并受单图字节、像素、边长、数量、总字节与最终 JSON 上限约束；URL、路径、file ID 和调用方预制 data URL 都会被拒绝。

`0.1.7` 的闭合运行时诊断、CLI 安装恢复、OIDC timeout 脱敏结算和 `IconThinkOutline16` 兼容层在本版保持不变。官方 CLI 仍负责生成登录 URL 与打开外部浏览器；插件不修复系统 DNS、代理、防火墙、VPN 或 CLI 行为。

`0.1.9` 只为精确 `grok-4.6` 增加两个默认关闭的 Web/X Search 开关。启用后，普通对话内容与模型生成的检索词会交给 xAI，并可能产生额外用量；结果和 citation 属于可能错误或含提示注入的不可信远端数据。Provider 只允许固定 Proxy 实测的 Web lifecycle 与四项 X custom-tool 名称，不把它们映射为 Harness 本地工具，不跟随或下载 citation URL，并在观察到 Search 后放弃该响应的 encrypted reasoning replay。后台 purpose、未验证模型、未启用类别、未知事件和未闭合 lifecycle 均失败关闭。固定路径/argv、最小环境、无 shell、输出上限、凭据、固定 origin 与 URL 拒绝边界不变；本版不新增生成、认证模式或 endpoint。

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

English summary: GitHub Private vulnerability reporting is enabled and preferred. The current source candidate is `0.1.9`. Version `0.1.8` was published and then withdrawn, and npm version numbers cannot be reused; npm Registry `latest` and the current installable stable baseline remain `0.1.7`. Bounded JPEG/PNG input with fixed `detail:"high"` remains enabled only for exact `grok-4.6`; browser sign-in diagnostics remain closed and redacted, and the official CLI still owns URL generation and browser launch. The `0.1.9` candidate adds independent, default-off Web/X Search only for exact `grok-4.6`, and its isolated Harness acceptance remains pending. When enabled, prompts and model-derived queries reach xAI and may incur additional usage; results and citations are untrusted remote data. The provider accepts only the fixed-Proxy Web lifecycle and four verified X custom-tool names, emits no Harness-local tool calls for server search, never follows citation URLs, and suppresses encrypted reasoning replay after Search. Background-purpose calls, unverified models, disabled categories, unknown events, and incomplete lifecycles fail closed. Windows x64 remains covered by code and slow fakes without network-reachable real-device browser-launch acceptance. Fixed path/argv, no-shell, credential, origin, and URL-rejection boundaries remain unchanged; no image generation, new auth mode, or custom endpoint is added. Never send credentials, identity data, prompts, tool arguments, cookies, image bytes, Search contents, or unreviewed diagnostics.

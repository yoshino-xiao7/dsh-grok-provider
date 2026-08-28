# 安全策略 / Security Policy

`dsh-grok-provider` 处理官方 Grok CLI 的本机会话，并把模型请求发送到固定的 xAI Grok Build 服务，因此凭据泄漏、任意 endpoint、重定向、命令执行和解析器绕过都属于高优先级安全问题。

## 支持范围

本安全策略对应源码版本 `0.1.5`；当前已发布稳定版本以 npm Registry 的 `latest` 标签为准。DeepSeek Harness、Node.js 与操作系统按发布线明确维护；Grok CLI 不使用完整版本字符串作为信任门禁，而是严格校验官方默认路径、命令能力、生产 OIDC 凭据契约和固定服务端协议。macOS arm64 已完成真实验收；Windows x64 有代码与 CI 覆盖。`0.1.5` 沿用 `0.1.4` 的图片边界：只为精确 `grok-4.6` 提供有界图片输入；`grok-4.5` 与所有其他模型保持 text-only，不改动认证、凭据、CLI subprocess 或 endpoint 边界。图片只能来自 Harness attachment service 的已验证 JPEG/PNG 投影，以 `detail:"high"` 发送，并受单图字节、像素、边长、数量、总字节与最终 JSON 上限约束；URL、路径、file ID 和调用方预制 data URL 都会被拒绝。项目不再发行预发行版，安全或兼容性缺陷使用新的递增稳定版本修复。

## 私下报告漏洞

公开仓库已启用 GitHub **Private vulnerability reporting**，请优先通过该入口报告。如果入口暂不可用，请只创建一个不含技术细节、凭据或个人信息的公开联络 Issue，请维护者提供私下沟通渠道。

报告应包含：

- 受影响的精确版本与平台；
- 最小复现条件和安全影响；
- 已脱敏的请求/响应形状或错误码；
- 建议修复方向（如有）。

绝对不要发送真实 `auth.json`、access/refresh token、`user_id`、Cookie、邮箱、姓名、完整提示词、工具参数、原图/投影图片字节或包含这些数据的诊断包。若秘密已暴露，请先通过官方 Grok CLI 注销/重新登录并按相应服务流程撤销凭据。

## 不属于漏洞的情况

- Windows x64 在 `0.1.0` 发布后仍未完成首次 Registry 真机验证这一已披露状态；
- 上游未提供额度字段时 UI 显示 unknown；
- 不受支持的 CLI/Harness/平台版本被明确拒绝；
- 官方 CLI 或 xAI 服务自身的行为，且无法由本插件边界缓解的问题。

## 披露原则

维护者会先确认报告是否可复现和是否落在本项目边界内，再协调修复与发布。请在修复版本可用前避免公开可直接利用的细节。

---

English summary: GitHub Private vulnerability reporting is enabled and is the preferred reporting channel. Version `0.1.5` preserves the `0.1.4` bounded JPEG/PNG attachment boundary with `detail:"high"` only for exact `grok-4.6`; `grok-4.5` and all other models remain text-only. It accepts no URL, path, file ID, or caller-supplied data URL and does not change authentication or endpoints. If private reporting is unavailable, open only a detail-free contact issue. Never publish or send real credentials, identity data, prompts, tool arguments, cookies, source/projected image bytes, or unreviewed diagnostic archives. Include exact versions, platform, minimal reproduction conditions, impact, and redacted evidence.

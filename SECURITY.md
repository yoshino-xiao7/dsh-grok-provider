# 安全策略 / Security Policy

`dsh-grok-provider` 处理官方 Grok CLI 的本机会话，并把模型请求发送到固定的 xAI Grok Build 服务，因此凭据泄漏、任意 endpoint、重定向、命令执行和解析器绕过都属于高优先级安全问题。

## 支持范围

本安全策略对应源码候选版本 `0.1.7`；npm Registry 的 `latest` 与最近发布的稳定版本均为 `0.1.6`。DeepSeek Harness、Node.js 与操作系统按发布线明确维护；Grok CLI 不使用完整版本字符串作为信任门禁，而是严格校验官方默认路径、命令能力、生产 OIDC 凭据契约和固定服务端协议。macOS arm64 已完成真实验收，`0.1.6` 的图片发送也已在真实 Harness 对话中确认可用；Windows x64 有代码与 slow-fake 覆盖，正式候选仍需通过 Windows CI，且 `0.1.7` 尚未在网络可达的 Windows 真机上确认外部浏览器弹出。

`0.1.7` 沿用已发布 `0.1.6` 的图片边界：只为精确 `grok-4.6` 提供有界图片输入；`grok-4.5` 与所有其他模型保持 text-only。普通 user/system 历史中的私有 reasoning 会被省略并保留相邻可见 text/image；只有有效的同 Provider assistant 历史可进入加密 reasoning replay，一层 tool-result 仍只接受公开 text/image。图片只能来自 Harness attachment service 的已验证 JPEG/PNG 投影，以 `detail:"high"` 发送，并受单图字节、像素、边长、数量、总字节与最终 JSON 上限约束；URL、路径、file ID 和调用方预制 data URL 都会被拒绝。

`0.1.7` 新增独立、single-flight 的运行时诊断，只向 renderer 投影 Provider 版本及闭合的 CLI 状态/安全版本号；可执行路径、stderr、环境、代理信息和 OAuth URL 均不得越过 Host 边界。CLI 缺失或无效时登录保持禁用，并只提供官方安装入口与重新检测。只有固定 OIDC discovery 地址与 timeout 特征同时匹配时才投影脱敏的网络超时原因；未知输出折叠为通用失败。官方 CLI 仍负责生成登录 URL 与打开外部浏览器，本版不修复系统 DNS、代理、防火墙、VPN 或 CLI 行为。`IconThinkOutline16` 兼容层只在 Harness `0.1.1-rc.2` 设置导航中唯一精确匹配并随 effect 卸载清理，不扩大 Host DOM 或网络边界。固定路径/argv、最小环境、无 shell、输出上限、取消和登录后凭据重验边界不变；本版不新增认证模式、Search、生成或 endpoint，Search 顺延至独立 `0.1.8` 切片。

## 私下报告漏洞

公开仓库已启用 GitHub **Private vulnerability reporting**，请优先通过该入口报告。如果入口暂不可用，请只创建一个不含技术细节、凭据或个人信息的公开联络 Issue，请维护者提供私下沟通渠道。

报告应包含：

- 受影响的精确版本与平台；
- 最小复现条件和安全影响；
- 已脱敏的请求/响应形状或错误码；
- 建议修复方向（如有）。

绝对不要发送真实 `auth.json`、access/refresh token、`user_id`、Cookie、邮箱、姓名、完整提示词、工具参数、原图/投影图片字节或包含这些数据的诊断包。若秘密已暴露，请先通过官方 Grok CLI 注销/重新登录并按相应服务流程撤销凭据。

## 不属于漏洞的情况

- `0.1.7` 尚未完成网络可达 Windows 真机外部浏览器弹出验收这一已披露状态；
- 上游未提供额度字段时 UI 显示 unknown；
- 不受支持的 CLI/Harness/平台版本被明确拒绝；
- 官方 CLI 或 xAI 服务自身的行为，且无法由本插件边界缓解的问题。

## 披露原则

维护者会先确认报告是否可复现和是否落在本项目边界内，再协调修复与发布。请在修复版本可用前避免公开可直接利用的细节。

---

English summary: GitHub Private vulnerability reporting is enabled and is the preferred reporting channel. The current source candidate is `0.1.7`; npm Registry `latest` and the most recent stable release are `0.1.6`, whose image sending has been confirmed in a real Harness conversation. `0.1.7` preserves bounded JPEG/PNG input with `detail:"high"` only for exact `grok-4.6` and adds closed Provider/CLI version diagnostics, missing/invalid CLI recovery, and redacted settlement of the known OIDC discovery timeout. Executable paths, stderr, environment, proxy data, and OAuth URLs do not cross the Host boundary. Windows code and slow-fake coverage are present, while the final candidate still has to pass Windows CI. The official CLI still owns sign-in URL generation and external-browser launch; `0.1.7` does not repair Windows network configuration or claim network-reachable real-device browser acceptance. The lifecycle-owned `IconThinkOutline16` compatibility layer is exact-match and fail-safe for Harness `0.1.1-rc.2`. Fixed path/argv, no-shell, credential, origin, and URL-rejection boundaries remain unchanged; Search moves to an independent `0.1.8` slice, and no generation, new auth mode, or custom endpoint is added. Never send credentials, identity data, prompts, tool arguments, cookies, image bytes, or unreviewed diagnostics.

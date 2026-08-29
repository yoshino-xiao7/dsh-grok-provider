# ADR-0009：运行时版本诊断与闭合登录失败

- 状态：Accepted
- 日期：2026-08-28
- 目标版本：`0.1.7`

## 背景

Windows 真机先后暴露了两个容易混淆的状态：未安装官方 Grok Build CLI 时，Provider 只知道 Harness subprocess driver 已注册；安装 CLI 后，官方 `grok login --oauth` 又可能在读取 xAI OIDC discovery 配置时超时。前者仍会显示可点击登录，后者会长时间显示“登录进行中”，两者都无法告诉用户浏览器登录是否真正开始。

这些观察发生在精确 `0.1.6` 发布后：图片输入已确认可用；Windows 直接运行官方 CLI 时，进程在生成登录 URL 前报告 discovery timeout。`0.1.7` 因此只负责把本机安装状态与该闭合失败安全投影到页面，不把上游网络失败误写成 Provider 浏览器按钮故障，也不声称浏览器弹出已修复或已验证。

当前 `status` 每秒轮询登录 session。若把 `grok --version` 直接塞进该接口，会在登录期间反复启动本机进程；若把 stderr、路径或任意错误文本送到 renderer，又会扩大凭据、授权 URL、代理信息和本机布局的泄漏面。

## 决定

1. 增加独立只读 `diagnostics({})` RPC；页面首次打开、用户主动重新检测或登录结算后调用，不进入每秒 `status` 轮询。同一 CLI inspector 的并发请求共享一次检测，subprocess capability 卸载时 Host 先取消并等待该检测，再完成 driver shutdown。
2. Host 从安装包 `package.json` 读取 Provider 版本。CLI inspector 仍只解析并验证官方默认 executable，再执行有界 `grok --version` 与 `grok login --help`；只有独立 `--oauth` 能力存在时才报告 ready。公开 DTO 只能是：
   - `{ state: "ready", version }`
   - `{ state: "missing" }`
   - `{ state: "invalid" }`
   - `{ state: "unavailable" }`
3. `version` 只取安全单行输出中 `grok` 后的首个有界字段，例如 `1.0.5`；完整构建哈希、路径、stdout/stderr 和环境不跨越 Host 边界。
4. 未安装时 UI 禁用登录，显示 xAI 官方安装入口与“重新检测”；插件不下载、安装、更新 CLI，也不搜索 PATH 或接受任意 UI 路径。
5. 登录 session 的失败原因只允许 `cli-missing`、`cli-invalid`、`auth-network-timeout`、`login-timeout`、`cli-failed`。未知或畸形值折叠为无 reason 的通用失败。
6. 只有固定 `auth.x.ai/.well-known/openid-configuration` 与 `operation timed out` 特征同时出现在有界 CLI stderr 时，Host 才投影 `auth-network-timeout`。renderer 只说明“登录链接尚未生成”，不显示原始 stderr 或 URL。
7. 保留五分钟真人 OAuth deadline 与取消操作。网络错误提前退出时立即结束 spinner；deadline 本身投影为 `login-timeout`。
8. 若诊断进程树无法在有界 teardown 内确认退出，该 CLI 实例永久锁存为 `unavailable`，同步中止同实例的在途认证 action，并移除对应认证 driver；只有 subprocess capability 被替换后才能恢复。登录状态轮询使用串行定时器与单调 request epoch，用户发起登录、取消、退出或刷新后，旧 generation/session、旧 epoch 或已卸载页面的响应不得回写状态。

## 结果

- 安装状态与 subprocess capability 不再混为一谈，版本展示有单一真源。
- 登录轮询保持轻量且不重叠；诊断进程只在明确时机运行，并拥有独立的 single-flight、取消与 dispose 生命周期。
- Windows 网络、代理或 OIDC discovery 失败能得到可操作提示，同时不把任意上游文本带入页面。
- Provider 仍不负责修复系统代理、打开自行构造的 OAuth URL 或接管官方授权流程；只有官方 CLI 在 discovery 可访问时实际打开浏览器，才能形成对应 Windows 真机证据。

## 发布门禁

- 覆盖 ready/missing/invalid/unavailable 与 Provider/CLI 双版本投影。
- 覆盖并发诊断 single-flight、检测中 capability teardown、cleanup failure 锁存隔离，以及陈旧登录轮询不能覆盖结算状态。
- 覆盖 OIDC timeout、action deadline、未知 stderr、畸形 reason 和 Host/RPC 严格字段检查。
- Windows 真机需分别验证：CLI 缺失提示；可访问 discovery 时浏览器弹出；discovery 超时时 spinner 结束并显示网络提示。

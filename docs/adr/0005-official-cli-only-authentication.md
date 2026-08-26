# ADR-0005：`0.1.0` 收敛为官方 CLI 单一认证路径

- 状态：Accepted
- 日期：2026-08-26
- 取代：ADR-0003 在 `0.1.0` 中关于 `managed-device`、插件持久化 OAuth grant 和双认证选择的决定
- 修订：ADR-0007 从 `0.1.2` 起把精确版本门禁改为能力与凭据契约门禁

## 背景

仓库所有者将首版要求调整为“能够从 Harness 跳转浏览器登录即可”。xAI 当前没有公开的第三方 OAuth client 自助注册入口；复制官方 Grok CLI 或其他应用的 client ID 会让本插件冒充另一客户端，也会增加无法独立审计的授权与封禁风险。

官方 Grok CLI 已提供浏览器 OAuth 登录并负责自己的 token 持久化。插件只需要从 Host 经 Harness subprocess seam 调用固定的 `grok login --oauth`，无需拥有第二套 OAuth 身份或 refresh token 生命周期。

## 决定

`0.1.0` 只提供官方 CLI 认证：

- Web 设置页只有一张官方 CLI 登录卡；不显示模式选择或 device-code UI。
- TUI 语法只有 `/grok status|login|cancel|logout`。
- RPC 只有 `status`、`login`、`cancel`、`logout`；请求中不存在 `authMode`。
- Host 不注入 Harness credentials capability，不包含 OAuth client ID、client secret、device flow、插件实现的 refresh/revoke 或独立 grant store。
- 官方 CLI 通过系统浏览器完成授权并持久化 `auth.json`。插件只做有界、只读、版本/schema/权限约束的 credential snapshot，并且不提取、使用或写回其中的 refresh token。完全匹配的 access token 过期时，插件可 single-flight 启动固定、30 秒有界的 `grok models`，由官方 CLI 完成 refresh grant 和文件写回；随后只重读、重新校验并重试一次。
- 模型发现与推理仍使用固定 Grok Build HTTPS endpoints，并动态暴露账号目录中的全部受支持模型。

## 后果

- xAI 独立 OAuth Client ID 不再是 `0.1.0` 发布阻断项。
- 用户必须安装并信任受支持版本的官方 Grok CLI；登录与注销会影响共享同一 Grok home 的其他客户端。
- 插件不能承诺在没有官方 CLI 的环境中登录或续期，也不拥有 OAuth refresh token 协议或凭据迁移能力。
- 如果未来取得 xAI 明确授权的独立 public client，需要新的 ADR、独立安全评审和新的版本；不得在 `0.1.x` 中以隐藏配置恢复已删除路径。

## 非方案

- 不复制、提取或反编译官方 CLI 的 OAuth client ID。
- 不接受用户粘贴任意第三方 client ID。
- 不把官方 refresh token 复制到 Harness credentials、settings、环境变量或 workspace。
- 不用 API key 冒充浏览器 OAuth 登录。

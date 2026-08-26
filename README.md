# dsh-grok-provider

[简体中文](README.md) | [English](README.en.md)

为 DeepSeek Harness 全新实现的 Grok Build Provider。它会动态发现当前 Grok Build 账号可见的全部模型，并将原生 Responses 流映射为 Harness 的文本、推理、加密推理回放、用量与工具调用。

> 预发布状态：`0.1.0` 已完成实现，但目前不得发布。xAI 支持/许可依据、官方 CLI 制品完整性、规范 GitHub 来源以及剩余的 macOS 验收仍是发布门禁。Windows x64 已获得代码支持，但尚未在真实 Windows 设备上验证；首次真机验证是 `0.1.0` 发布后的明确跟进事项。

## 兼容性

- DeepSeek Harness `0.1.1-rc.2`
- Node.js `24.19.0` 或更高版本
- macOS arm64 与 Windows x64
- 官方 Grok CLI `1.0.5 (5115b46bc909)`，使用默认的 `~/.grok` / `%USERPROFILE%\.grok` 目录

macOS x64、Linux、图片、Web/X 搜索、任意下载、API Key 计费、ACP 与 Headless agent 封装不在 `0.1.0` 范围内。

## 身份认证

Host 只会通过 Harness 的子进程管理能力调用已验证的默认可执行文件，并使用固定的 `--version`、`login --oauth`、`models` 或 `logout` 参数。官方 CLI 负责打开浏览器并持有 `auth.json`；当其他条件均有效、仅 access token 过期时，插件可以有界运行一次 `grok models`，由 CLI 自行刷新其文件，随后插件重新读取并验证凭据。插件不会提取 refresh token、实现 refresh grant 或重写该文件。包内不包含独立 OAuth 客户端身份或 token 存储。

## 用户界面

该 bundle 会在 Harness Web 的回环地址界面中提供响应式、中英双语的 `Grok Build` 设置页。页面支持状态查看、由官方 CLI 发起的浏览器登录、取消及二次确认退出，并提供包含计费周期重置时间和动态模型能力卡片的实时账户面板。只有完整、类型明确的当前周期能够唯一确定其含义时，才会恢复 protobuf 省略的零使用率；其他缺失值仍显示为未知。token 和身份信息不会进入 renderer。

TUI 提供以下闭合命令语法：

```text
/grok status
/grok login
/grok cancel
/grok logout
```

这些命令不会发送给模型，其持久化结果文本经过脱敏，可安全保存。

## 模型支持

Provider 会在运行时调用已认证的 Grok Build `/v1/models` 目录；模型 ID 不会硬编码。每条目录记录都必须声明一个已由当前版本严格 codec 支持的 backend。当前账号可见的 Responses 模型 `grok-4.6` 与 `grok-4.5` 均已在 macOS arm64 上通过真实网络测试，覆盖首轮流式输出、第二轮加密推理回放以及不实际执行的 fixture function call。

如果未来账号出现未经验证的 backend，模型发现会失败关闭，而不是隐藏该模型后错误宣称已支持全部模型。

## 安全边界

- 模型、推理和计费 endpoint 均为编译时固定的 HTTPS origin，并拒绝重定向。
- Renderer/RPC 输入不能提供命令、可执行文件路径、环境变量、凭据路径或 base URL。
- 官方登录使用清理后的环境、有界输出和插件自有 deadline；取消和 capability teardown 会等待已启动的进程树退出。
- 官方 CLI 及其有效的用户、系统或 MDM 配置属于可信本地组件。插件的“不使用 shell”保证仅覆盖自身 spawn 边界，不覆盖官方 CLI 内部的不可见行为。
- 官方 `auth.json` 的原始字节包含 refresh token 和身份 metadata。Host 必须瞬时读取这些有界字节，但会忽略 refresh token；`user_id` 仅用于官方固定计费请求。两者都不会由插件记录、持久化或返回 renderer。
- 插件不会创建第二份凭据记录；登录持久化完全由官方 CLI 负责。

完整架构、威胁模型、测试、证据和未解决的发布阻断项位于 [`docs/`](docs/README.md)。

## 开发

```sh
npm ci --ignore-scripts
npm test
npm run pack:check
```

测试与构建以 Node `24.19.0` 为目标。该包没有普通 runtime dependency；Harness services 均为精确 peer dependency。`npm run build` 会生成可丢弃的 `dist/` 制品，npm tarball 不包含源码、测试、spike 和本地证据。

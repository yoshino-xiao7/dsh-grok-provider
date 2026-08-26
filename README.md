# dsh-grok-provider

[简体中文](README.md) | [English](README.en.md)

让 DeepSeek Harness 使用你已登录的官方 Grok Build 账号：动态模型发现、流式推理、工具调用，以及账号额度与模型能力面板。

> 非官方社区项目，与 xAI 或 DeepSeek Harness 官方无隶属关系。`0.1.0` 已发布到 npm，并完成 Registry 完整性与 provenance 回读。Windows x64 已完成代码与 CI 支持，首次 Registry 真机验证仍在发布后跟进中。

## 它解决什么问题

| 能力 | 当前实现 |
| --- | --- |
| 登录 | 调用官方 `grok login --oauth` 打开浏览器；插件不实现 OAuth grant |
| 凭据 | 复用官方 CLI 的登录状态；插件不创建第二份 token 存储 |
| 模型 | 运行时读取账号可见的全部 Grok Build 模型，不维护静态模型白名单 |
| 对话 | Responses 流式文本、reasoning、加密 reasoning replay、usage 与 finish reason |
| 工具 | 将 function call 交回 Harness 权限层；Provider 本身不执行工具 |
| 账户面板 | 登录状态、每周/月额度、重置时间、动态模型能力与 reasoning 档位 |
| 界面 | Web 设置页中英文切换；TUI 提供闭合的 `/grok` 命令 |

## 快速开始

### 1. 准备环境

- DeepSeek Harness `0.1.1-rc.2`
- Node.js `24.19.0` 或更高版本
- macOS arm64 或 Windows x64
- 官方 Grok Build CLI `1.0.5 (5115b46bc909)`

请从 [Grok Build 官方文档](https://docs.x.ai/build/overview) 安装 CLI，并先确认：

```sh
grok --version
grok models
```

首次运行 Grok CLI 会打开浏览器登录。插件只支持官方默认的 `~/.grok`（Windows 为 `%USERPROFILE%\.grok`）目录。

### 2. 安装 Provider

从 npm 安装已发布的精确版本：

```sh
dsh plugin --profile web add dsh-grok-provider@0.1.0
dsh web
```

### 3. 登录并选择模型

打开 **设置 → Grok Build**：

1. 点击“使用 Grok 登录”；
2. 在官方 Grok CLI 打开的浏览器页面完成授权；
3. 返回 Harness，刷新账户面板；
4. 在模型选择器中选择当前账号可见的 Grok 模型。

插件不会接管登录页面，也不会要求粘贴 access token 或 refresh token。

## 使用界面

Web 设置页展示：

- 当前登录状态及登录、取消、退出操作；
- 已使用/剩余额度和真实周期重置时间；
- 当前账号可见模型、上下文窗口、reasoning 档位、streaming 与 tool capability。

当 protobuf-backed billing 返回完整的 weekly/monthly 周期但省略零值百分比时，页面会恢复为“已使用 0% / 剩余 100%”；其他不完整响应保持未知，不伪造额度。

TUI 命令：

```text
/grok status
/grok login
/grok cancel
/grok logout
```

这些命令不会进入模型上下文。退出操作需要二次确认，因为它会调用官方 `grok logout`，并影响共享同一 Grok home 的其他客户端。

## 更新与卸载

更新已安装版本：

```sh
dsh plugin --profile web update dsh-grok-provider
dsh web
```

卸载：

```sh
dsh plugin --profile web remove dsh-grok-provider
dsh web
```

卸载插件不会删除官方 Grok CLI，也不会直接修改或删除 `auth.json`。

## 项目来源与发现

- npm 精确版本：[dsh-grok-provider@0.1.0](https://www.npmjs.com/package/dsh-grok-provider/v/0.1.0)
- GitHub 发行版与校验值：[v0.1.0](https://github.com/yoshino-xiao7/dsh-grok-provider/releases/tag/v0.1.0)
- GitHub 社区发现：仓库已添加 DeepSeek Harness 官方推荐的 `dsh-plugin` 与 `dsh` Topics
- YukiRyou 受管来源：[deepseek-yukiryou-plugin-catalog](https://github.com/yoshino-xiao7/deepseek-yukiryou-plugin-catalog)，精确锁定 `0.1.0`，当前只标记已验证的 macOS arm64

出现在目录中不代表 xAI 或 DeepSeek Harness 官方背书。公共 curated 目录仍需满足其仓库年龄门槛并通过独立维护者评审。

## 兼容性与范围

| 项目 | `0.1.0` 状态 |
| --- | --- |
| DeepSeek Harness | 精确支持 `0.1.1-rc.2` |
| Node.js | `>=24.19.0` |
| macOS arm64 | 已完成真实网络与隔离 Harness 验收 |
| Windows x64 | 代码支持；首版发布后真机验证 |
| macOS x64 / Linux | 不支持 |
| Grok CLI | 精确支持 `1.0.5 (5115b46bc909)` |
| 模型 | 当前账号目录中 backend 已被严格 codec 支持的全部模型 |

首版不包含图片输入、Web/X Search、任意文件下载、API Key 模式、多账号、企业 OIDC、ACP 或 Headless agent 封装。完整范围见[产品需求](docs/01-product-requirements.md)。

## 工作原理

```text
Harness UI / TUI
       │ 仅发送闭合操作与脱敏 DTO
       ▼
dsh-grok-provider Host
       ├── 官方 Grok CLI：login / models / logout
       ├── 固定 Models/Billing endpoint：目录与额度
       └── 固定 Responses endpoint：流式推理
                    │
                    ▼
              xAI Grok Build
```

模型 ID 来自运行时目录，不是硬编码列表。如果账号出现当前版本无法安全映射的新 backend，发现过程会失败关闭，而不是隐藏模型后宣称“全部支持”。

## 安全与隐私

- 模型、目录和计费请求只允许编译时固定的 HTTPS origin/path，并拒绝重定向。
- Renderer 和 RPC 不接收 token、`user_id`、凭据路径、任意 URL 或原始上游响应。
- Host 必须有界读取官方 `auth.json`，其原始文件可能包含 refresh token；解析器不使用、不缓存、不持久化 refresh token，只保留闭合校验所需元数据与短期 access-token lease。
- 插件不实现 refresh grant；凭据临近过期时，只能有界调用一次官方 `grok models`，再重新读取并验证官方文件。
- 登录子进程使用固定 argv、过滤后的环境、输出上限、deadline 与取消处理，不通过 shell 启动。
- 提示词和工具结果会发送给 xAI Grok Build 服务；插件本身不把它们写入日志。

完整边界见[威胁模型](docs/03-security-threat-model.md)。发现安全问题时，请阅读[安全策略](SECURITY.md)，不要在公开 Issue 中提交 token、`auth.json`、个人信息或完整诊断日志。

## 常见问题

### 页面显示“找不到 Grok CLI”

确认官方 CLI 位于默认路径，并在终端执行 `grok --version`。插件不会从 PATH、工作区或 UI 指定的任意路径加载可执行文件。

### 页面要求重新登录

在设置页点击登录，或先在终端运行 `grok login --oauth`。如果官方 CLI 已更新到未验证版本，插件会失败关闭，而不是跳过版本检查。

### 没有看到某个模型

先运行 `grok models`，确认该模型对同一账号可见。Provider 动态返回全部合法目录记录；未知 backend 会让发现失败，而不会被静默过滤。

### 为什么额度百分比显示未知

完整类型化周期下缺失的 protobuf 零值会恢复为 0%；其他情况下，上游没有提供足够信息，插件会保留未知。OAuth token 过期时间绝不会冒充额度刷新时间。

### Windows 能用吗

代码和自动测试覆盖 Windows x64，但 `0.1.0` 首次 Registry 真机验收将在发布后完成；在此之前按“代码支持、真机未验证”处理。

## 开发

```sh
npm ci --ignore-scripts
npm test
npm run pack:check
```

该包没有普通 runtime dependency；Harness services 使用精确 peer dependency。`npm run build` 生成可丢弃的 `dist/`，npm tarball 不包含 `src/`、测试、spike 或本机证据。

项目导航：

- [`docs/README.md`](docs/README.md)：设计文档索引与当前决策；
- [`docs/04-harness-contract.md`](docs/04-harness-contract.md)：Harness 集成契约；
- [`docs/05-test-plan.md`](docs/05-test-plan.md)：平台、安全与发行门禁；
- [`docs/09-implementation-status.md`](docs/09-implementation-status.md)：实现与验收状态；
- [`CHANGELOG.md`](CHANGELOG.md)：版本变化。

提交 Issue 或 PR 前请阅读[贡献指南](CONTRIBUTING.md)。认证、传输、凭据格式或发布边界的变化必须先更新对应 ADR/威胁模型，再开发和测试。

## 路线图

- [x] 官方 CLI 浏览器登录、动态模型目录和 Responses 流
- [x] Web/TUI 账户控制、额度面板与模型能力展示
- [x] 发布 `0.1.0` 并完成 Registry/provenance 回读
- [x] 配置 npm Trusted Publisher、撤销首发 Token，并加入 `dsh-plugin` Topic 与 YukiRyou catalog
- [ ] 发布后完成 Windows x64 首次真机验收
- [ ] 根据已验证的 Harness/xAI 协议逐项评估更多内容类型和平台

路线图不是兼容性承诺；新增能力必须通过文档决策与安全门禁。

## 许可证

[MIT](LICENSE)

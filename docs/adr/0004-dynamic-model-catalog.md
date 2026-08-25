# ADR-0004：动态支持账号可用的全部 Grok Build 模型

- 状态：已接受
- 日期：2026-08-25

## 背景

仓库所有者要求插件可调用 Grok Build 支持的全部模型。模型集合会随账号、团队、区域和上游发布变化，静态只注册 `grok-build` 会漏模型。

2026-08-26 在本机官方 Grok CLI `1.0.5` 的真实账号发现结果为：

- `grok-4.6`（默认）
- `grok-4.5`

该结果是账号/时点快照，不是永久白名单。

## 决策

- Provider ID 保持 `grok`。
- `LlmAdapter.listModels()` 通过固定 `GET https://cli-chat-proxy.grok.com/v1/models` 动态发现当前所选认证来源实际可用的全部模型。
- 使用有界、严格 schema 的内存 TTL cache；认证 generation、logout、401 或 credential record 变化立即失效。不同认证模式和账号不能共享 catalog。
- 列表按上游默认模型优先，其余使用稳定排序；去重后返回 Harness `LlmModelInfo`。模型 ID、名称和显式能力来自经过验证的上游字段，不根据名字猜 context、最大输出或 reasoning effort。
- `resolveModel()` 对明确选择但暂未出现在缓存目录中的 ID执行一次可取消刷新。Harness 的 catalog 是 discovery surface，不是路由白名单；仍必须让 Proxy 对账号权限做最终判定。
- 上游模型新增时无需发布新 npm 版本；未知字段有界忽略，未知模型能力保持 absent，而不是伪造默认值。
- 当前两个模型都声明 backend `responses` 与 500000 context；`grok-4.6` efforts 为 `xhigh|high|medium|low`，`grok-4.5` 为 `high|medium|low`，两者默认 `high`。这些值来自动态 schema，不硬编码成所有账号/未来版本的事实。
- 一个模型只有在其目录 `api_backend` 有已验证 codec 时才能真正调用；真实目录若出现 unsupported backend，发布门禁必须失败并明确列出，不能静默删掉该模型来伪称“全部支持”。
- 无认证时返回空目录并给出脱敏 auth 状态；网络失败时只可返回同一 auth generation 的短期 last-known-good 内存快照，进程重启后不持久化旧目录。
- `grok-4.6` 和 `grok-4.5` 仅作为协议测试与离线 UI fixture，不作为生产硬编码的完整集合。

## 测试门禁

- fake `/v1/models` 覆盖 0/1/N、重复 ID、恶意长字段、未知字段、错误类型、超限、401、重定向、取消和换账号竞态。
- 真实 macOS/Windows smoke 比较插件目录与同一账号同时刻的官方 `grok models` 输出；插件不得漏掉官方列表中的模型。
- 对每个真实发现模型至少完成一次最小流式文本请求；工具、reasoning 和 usage 能力只在该模型实际声明/验证后曝光。

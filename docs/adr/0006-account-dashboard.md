# ADR-0006：账户额度与模型能力面板

- 状态：Accepted
- 日期：2026-08-26
- 适用版本：`0.1.0`

## 背景

设置页需要提供接近 Harness 现有 Provider 页面的一屏式账户概览：登录状态、真实使用额度、额度周期结束时间，以及账号当前可见模型的能力。视觉参考只定义信息层级和交互密度，不构成协议或字段定义。

xAI 官方 Grok Build 源码公开了两条可复用的 CLI Proxy 能力：

- `GET /v1/models`：返回账号当前可见模型与 capability metadata。
- `GET /v1/billing?format=credits`：返回 included credit 使用百分比与当前周/月周期；周期 `end` 是额度重置时间。旧账号可能只返回 `monthlyLimit`、`used` 与 `billingPeriodEnd`。

官方 billing 请求还要求 credential 中的 `user_id` 作为 `x-userid` header。它只在 Host credential lease 内使用，不进入 renderer。

官方实现依据：[`extensions/billing.rs`](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/extensions/billing.rs)。2026-08-26 的本机真实响应确认周期与 reset 可用，但未携带使用百分比；同一账号的官方移动端在完全相同的周期结束时间显示 `0% 已使用`。这符合 proto3 JSON 省略默认标量零值的行为，因此只有完整、类型化的新周期能把缺失百分比解释为零。

## 决策

### 1. Host 直接访问固定官方端点

额度与模型查询都复用现有 `OfficialSessionCredentialSource` 和 `PinnedGrokTransport`：

- origin 固定为 `https://cli-chat-proxy.grok.com`；
- path 固定，禁止 renderer、settings 或配置传入 URL；
- `redirect: "error"`，15–30 秒 deadline，JSON 响应 256 KiB 上限；
- Bearer token 与 `user_id` 只存在于一次 Host callback 和请求 headers 中。

不启动 Grok agent、不解析 TUI 文本、不抓取日志，也不读取浏览器 cookie。

### 2. 页面只接收脱敏 dashboard DTO

新增闭合 RPC action `dashboard`，只接受空对象。成功 DTO 仅包含：

- `models[]`：`id`、`name`、可选 `description`、`contextWindow`、reasoning efforts/default；
- `quota`：闭合状态与可选 `usedPercent`、`remainingPercent`、`periodKind`、`periodStart`、`resetsAt`；
- `fetchedAt`。

禁止返回 access/refresh token、credential path、`user_id`、email、姓名、team/principal ID、原始上游 JSON、任意 URL、请求 headers 或原始错误。

### 3. 额度语义

- 优先使用 `creditUsagePercent`。
- 若百分比缺失，但 `currentPeriod.type` 是官方 weekly/monthly 枚举，且 `start`、`end` 都是有效时间，则解释为 protobuf 省略的 `0% 已使用`。这是新版 credits shape 的零值恢复，不是通用缺省值。
- 若不存在上述完整周期，只有 `monthlyLimit.val > 0`、`used.val >= 0` 时才计算旧格式百分比。
- UI 同时显示“已使用”和“剩余”；进度条填充表示剩余额度，与参考 UI 一致。
- `currentPeriod.end` 或旧格式 `billingPeriodEnd` 才能显示为“重置时间”。OAuth `expires_at` 绝不当作额度刷新时间。
- 周期类型只接受官方 weekly/monthly 枚举；未知类型显示“当前额度周期”，不猜测。
- 不满足新版零值恢复或旧版计数条件时，百分比显示“上游未提供使用比例”；周期结束缺失时显示“上游未提供重置时间”。
- 页面提供手动刷新；初次进入自动获取一次。登录进行中的每秒轮询只调用轻量 `status`，不轮询 billing/models。

### 4. 模型能力语义

模型必须来自本次动态 catalog；不维护静态模型白名单。首版展示已验证的 capability：

- 文本输入；
- 上下文窗口；
- reasoning efforts 与默认 effort；
- Responses 流式输出；
- function tools（Provider transport 已覆盖）。

模型列表是能力展示，不在 `0.1.0` 增加隐藏/禁用模型设置。所有账号可见模型继续出现在 Harness 模型选择器中，避免 UI 过滤与“支持所有模型”的产品要求冲突。

## 失败行为

- 未登录：只展示登录引导，不发 billing/models 请求。
- billing 失败但 models 成功：模型卡正常显示，额度卡显示不可用。
- models 失败但 billing 成功：额度卡正常显示，模型卡显示不可用。
- 401/403：dashboard 返回固定的 unavailable 状态，不泄露上游正文；认证状态在下次刷新时重新校验。
- 旧/新增字段：严格抽取已知安全字段，忽略 history、balances、identity 和未知字段；已知字段类型不合法时该分支失败关闭。

## 安全影响

该功能扩大了固定 xAI Proxy path 集合，并在 credential lease 内新增 `user_id` metadata。renderer 可看到订阅使用比例与周期，这属于用户主动打开本机设置页时要求展示的账号信息；RPC 仍受 loopback authority 限制。额度不持久化到插件配置或 workspace。

## 验证门禁

- parser fixture 覆盖新 credits、完整类型化周期的 protobuf 零值恢复、不完整/未知周期、旧 monthly、字段缺失、越界百分比、超大/错误 JSON。
- transport 测试断言固定 URL、method、redirect、headers、deadline 与响应上限。
- RPC 测试断言闭合 payload、64 KiB 序列化边界和原始错误折叠。
- client bundle 测试断言无 token/path/identity 字段，并渲染 dashboard 关键文案。
- macOS 使用本机已授权 Grok Build 做脱敏真值 smoke；Windows 首版发布后真机验证，发布前保持“代码支持、真机未验证”。

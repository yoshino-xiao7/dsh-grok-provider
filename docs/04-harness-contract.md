# DeepSeek Harness `0.1.1-rc.2` 接口契约

## 1. 目标

插件只使用 Harness 的公开 npm 接口，不读取私有对象、不修改 Harness 源码，也不依赖当前 YukiRyou DeepSeek 工作区的内部实现。

兼容基线：

- DeepSeek Harness：`0.1.1-rc.2`
- Harness 内置 Node：`24.19.0`
- 首版发布平台：`darwin-arm64`、`win32-x64`

## 2. Host peer packages

首版预计需要以下版本。脚手架前必须按真实静态 import 图分为 required 与 optional peer：

```json
{
  "@deepseek-ai/cordis": "4.0.1",
  "@deepseek-ai/dsh-llm": "0.1.1-rc.2",
  "@deepseek-ai/dsh-subprocess": "0.1.1-rc.2",
  "@deepseek-ai/dsh-settings": "0.1.1-rc.2",
  "@deepseek-ai/dsh-commands": "0.1.1-rc.2",
  "@deepseek-ai/dsh-client-connection": "0.1.1-rc.2",
  "@deepseek-ai/dsh-client-runtime": "0.1.1-rc.2",
  "@deepseek-ai/dsh-client-locale": "0.1.1-rc.2",
  "@deepseek-ai/dsh-client-ui-settings": "0.1.1-rc.2",
  "@deepseek-ai/schemastery": "3.18.1"
}
```

初步分组：

- required：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-settings`、`@deepseek-ai/schemastery`。Host 通过 settings 包的 canonical helper 静态注册可选 settings service；包本身必须由 Runtime 提供。
- profile-specific optional：subprocess、commands、connection 和 client UI packages。目标桌面 Runtime 必须实际挂载 subprocess service 才能提供官方 CLI 登录；缺失时模型 Provider 仍可读取已有有效官方凭据，但登录/注销动作不可用。

全部放入 `peerDependencies`，optional 项同时声明 `peerDependenciesMeta.<name>.optional: true`。可选 peer 不得被 Host 入口无条件静态 import；需要通过独立 export、条件加载或已证明的 Runtime external 方式隔离。`@deepseek-ai/dsh-settings` 不是 optional peer，但 `ctx.settings` service 仍是可选能力；canonical helper 在 service 缺失或卸载时回退组合配置。Web、TUI、headless 三种缺失可选 service/peer 的测试必须通过。

这些包由 Harness Runtime 满足，不进入插件普通 dependency 图。版本在脚手架阶段以实际 rc.2 manifest 再核对；不自动放宽到未经测试的 Harness 版本。

目标是零普通 runtime dependencies。登录进程只经过 Runtime 提供的 `ctx.subprocess`；HTTP、流解析、crypto、path 和用户 home 凭据读取使用 Node 24 内建能力。插件不依赖或打包 `@deepseek-ai/dsh-subprocess-local`。

## 3. Cordis 入口

宿主入口形状：

```ts
export const name = "llm-grok"
export const inject = ["llm"]
export const Config = /* Schemastery */

export function apply(ctx, config) {
  // registration only after services validate
}
```

可选服务不能加入强制 `inject`：

- settings 使用可选安装 helper。
- commands 使用 `ctx.inject(["commands"], ...)`。
- Web RPC 使用 `ctx.inject(["connection"], ...)`。
- CLI login/logout 使用 `ctx.inject(["subprocess"], (subprocessCtx) => ...)`；内部只能调用该 child context 的 `subprocessCtx.subprocess`。
- 无 Web、无 TUI、无 settings 的 headless profile 仍应安全启动 LLM Provider。

所有 registration、listener、timer和 inflight promise 都必须由 Cordis effect disposer 管理。登录 capability 安装在 `ctx.inject(["subprocess"], ...)` 的 child fiber；service 被替换或卸载时，先中止登录，再 `waitForExit()`，随后等待 in-flight settle。

## 4. LLM adapter

实现 `LlmAdapter` 的公开成员：

- `providerInfo`
- `providerRetryPolicy`
- `listModels`
- `resolveModel`
- `prepareCall`
- `stream`

注册：

```ts
ctx.llm.registerAdapter(["grok"], adapter)

ctx.llm.registerConfigurableProviders([{
  provider: "grok",
  displayName: "Grok Build",
  settingsNs: "llm-grok",
  settingsPath: [],
}])
```

`0.1.5` 将这组 Host 注册定义为一个事务：先安装官方 auth source，再创建/注册 adapter，最后注册 configurable provider。任一后续步骤失败都按相反顺序回滚已经取得的 disposer；单个 disposer 抛错不得阻止剩余清理。安装错误与清理错误必须同时保留（多错误使用 `AggregateError`）。成功安装后的 `dispose()` 同样逆序、尽力执行全部清理，并在首次调用开始时即标记为已处置，因此即使清理抛错，后续调用也不会重复执行副作用。对外仍只暴露同一个 runtime `adapter`、`auth` 与 `dispose()` Interface。

`listModels()` 是异步动态目录：使用所选 auth generation 请求固定 `/v1/models`，返回该账号当前全部可见模型。目录是 discovery surface，不是路由白名单；`resolveModel()` 对未缓存的显式模型 ID 可做一次有界刷新，但不得根据 ID 名称猜 capability。

每个 provider HTTP 请求必须包含 `attributionHeaders()`。

### `prepareCall` generation

`prepareCall()` 返回公开 `PreparedAdapterCall` 的精确形状只有 `{ model: LlmResolvedModelInfo, stream }`。adapter 在其 `stream` 闭包内冻结私有 generation，例如：

```ts
type AdapterGeneration = {
  resolvedModel: LlmResolvedModelInfo
  transportContractVersion: 1
}
```

retry policy 由 LLM Runtime 与 adapter registration generation 一起绑定，不伪装成 `PreparedAdapterCall` 字段。access token 不写入可序列化 generation；stream 真正发请求前从私有 `HostCredentialSource` 取得一次 lease，并绑定到该次尝试。设置热更新不能改变已经 prepare 的模型和协议；logout/auth generation 可以使尚未发送或在途 lease 失效。直接调用 `stream()` 时，也必须在返回惰性 iterable 前同步捕获 adapter generation。

### 流顺序

本插件对成功响应采用比 rc.2 最低要求更严格的序列：

```text
block-start
  text-delta | reasoning-delta | tool-call-delta ...
block-end
usage
finish
```

- 每个 block chunk 的 `index` 都是非负 safe integer；多个 index 可以交错。同一 index 不可重复 start；delta 只能指向相同 index、相同类型的 open block。
- `block-start` 携带 `blockType`；`tool-call-delta` 携带稳定 `id`、可选 `name` 与原始 JSON `argumentsDelta`；`block-end.block` 是该 index 的完整组装 block。
- 成功 finish（`stop|tool-calls|max-tokens`）前所有 block 必须闭合，`usage` 必须且至多出现一次并紧邻 terminal finish。rc.2 本身允许 usage 缺失，但本插件把缺失视为协议失败。
- `TokenUsage.inputTokens`、`cacheReadTokens`、`cacheWriteTokens` 可同时存在，但各自计数集合不重叠；billed input 是三者之和。
- 必须有且只有一个 terminal `finish`，之后不得再有 chunk。只有 `error`/`aborted` finish 可按 rc.2 容许未闭合 block，并必须携带 `failure`。
- provider stop reason 映射为对象 `{kind:"stop"}`、`{kind:"tool-calls"}`、`{kind:"max-tokens"}`，异常/取消映射 `{kind:"error"|"aborted", failure}`。
- 空成功响应映射为 `EMPTY_RESPONSE`。
- 截断 SSE、未知事件、重复 finish 和无闭合 tool call 必须失败。
- AbortSignal 贯穿 fetch、reader、codec 和 adapter iterator。
- `0.1.0`–`0.1.3` 对外声明 `inputModalities:["text"]`，Harness 会把图片历史投影为确定性文本占位；若 raw image 仍到达旧 Adapter，则在 Responses POST 前拒绝。
- `0.1.4` 只对经过公开模型证据与固定 Proxy 语义验证的精确 `grok-4.6` 声明 `inputModalities:["text","image"]`，并由异步 request compiler 通过可选 `ctx.get("attachments")` 读取图片。`grok-4.5` 与未知模型继续 text-only，不能从 Responses backend 推导 modality。
- 无图请求不查询 attachment service，继续使用 `0.1.3` 同步 encoder；有图请求支持普通 user 内容和一层 tool-result content，按原顺序生成 `input_text`/`input_image`，并固定使用 `detail:"high"`。更深 tool-result、assistant/system 图片、webp/gif、无 projection 或超限均在 attachment I/O 或 Responses POST 前尽早拒绝。
- Provider-neutral 历史允许非 assistant 消息携带 `reasoning` block（例如 `subagent-settled` 上下文）。Grok wire 只重放同模型 assistant 的有效加密 reasoning；普通 user/system 历史中的 schema-valid reasoning 必须像 Harness 其他官方 adapter 一样省略，同时保留相邻可见文本，不得把私有 reasoning 改写成 user text，也不得因此阻断同消息或后续消息中的图片请求。被省略的块仍须通过字符串与长度校验，畸形/超限输入在 attachment I/O 前按通用非法 request 拒绝。一层 tool-result 的公开内容边界仍只接受 text/image，不借此放宽；其中出现 reasoning/未知 block 仍按通用非法 request 拒绝，不能因同行有图片改报为模型图片能力不足。
- request compiler 完成全部读取、jpeg/png 元数据与魔数检查、oldest-first 淘汰和 16 MiB 最终 JSON 检查后，Adapter 才调用推理 transport。源图片 policy 失败映射 `UNSUPPORTED_CONTENT`；损坏投影、图片淘汰后仍不合法的请求与其他通用非法 request 映射 `INVALID_RESPONSE`。完整策略见 [ADR-0008](./adr/0008-image-input-request-compiler.md)。
- Harness `0.1.1-rc.2` 隔离门禁已加载真实 `attachment-local` 与 `LlmRuntime`：内容寻址引用生成有界 PNG request projection，仅 `grok-4.6` 保留内联 `input_image`，`grok-4.5` 与未知 `grok-future` 均投影为 text-only，并使用 0 网络请求的本地受控 transport。
- 认证缺失或被拒使用 Harness 已识别的 LLM code `AUTH`，不用自造 `AUTH_REQUIRED`。

## 5. TUI `/grok` 命令

使用 `@deepseek-ai/dsh-commands` 的公开 human-command registry：

```ts
ctx.commands.register({
  name: "grok",
  description: "Manage Grok Build authentication",
  input: { hint: "status|login|cancel|logout" },
  recordInput: false,
  handler: async ({ rawInput, signal }) => {
    // parse closed grammar; call shared Host AuthCoordinator
    return { kind: "success", text: "<redacted-safe-status>" }
  },
})
```

约束：

- 命令由交互 UI 直接执行，绝不发送给模型。
- 只接受闭合语法：`status`、`login`、`cancel`、`logout`；额外参数返回 usage。
- `recordInput: false` 只是不把 `rawInput` 复制进 `command/run.args`；命令名、run/done 生命周期与返回 text 仍会持久化，因此返回文本必须脱敏。
- parser 必须保留并测试命令名后的原始分隔空白，再按闭合 grammar 决定成功或返回 `{ kind: "error", text: usage }`。
- `signal` 取消 `login` 等待；不会把授权 URL、token 或原始 CLI 输出写入命令结果。
- TUI 先调用共享 controller 的 `beginLogin(mode)`，再用 invocation signal 等待该 session；等待被取消时，由本次命令拥有的 session 执行 `cancel()`。Web 只启动并轮询 `status`。每个 auth mode 同时最多一个事务，selection generation 防止两种 token 混用。
- `/grok logout` 第一次只建立短期 confirmation；在 TTL 内第二次输入同一闭合命令才执行，不新增可携带任意参数的 grammar。

## 6. Web 设置与 RPC

设置 namespace：`llm-grok`。

设置页只存非敏感 UI/功能配置，不存 token、auth 文件路径、binary path 或 base URL。

Host channel 示例：

```ts
ctx.connection.rpc.handle(
  "/grok-auth",
  handler,
  { authority: "loopback" },
)
```

闭合方法：

- `status`
- `diagnostics`
- `dashboard`
- `login`
- `cancel`
- `logout`

`status`、`diagnostics`、`login`、`logout` 只接受空对象；`cancel` 只接受当前公开状态中的 `sessionId`。不存在 `authMode`、模式选择、OAuth URL、device code、access/refresh token、identity 或 token endpoint 字段。

`diagnostics` 与登录 `status` 轮询分离，只在页面首次打开、用户主动重新检测或登录结算后调用。同一 inspector 的并发调用只运行一个有界检测；subprocess capability teardown 会取消并等待它。若进程树无法确认退出，该 CLI 实例锁存为 `unavailable`、取消同实例的在途认证 action，并移除对应 driver，直到 capability 被替换。它返回 `pluginVersion` 与闭合 CLI 状态：`ready` 表示默认 executable、安全单行 `grok --version` 和独立 `--oauth` 能力均通过，并额外携带提取后的版本号；其他状态只能是 `missing`、`invalid` 或 `unavailable`。不得返回可执行路径、stderr、环境变量、代理地址或上游 URL。renderer 的登录轮询串行调度并使用单调 request epoch，必须拒绝旧 generation/session、旧 epoch 或 effect cleanup 后的响应回写。

登录失败状态可额外携带一个闭合 `reason`：`cli-missing`、`cli-invalid`、`auth-network-timeout`、`login-timeout` 或 `cli-failed`。只有固定 OIDC discovery 地址与 timeout 特征同时匹配时才能投影为 `auth-network-timeout`；其他上游文本折叠为 `cli-failed`，renderer 不能取得原始输出。

`dashboard` 也只接受空对象，并且只在 `status.available === true` 时由页面调用。它返回脱敏模型 capability 和额度摘要；模型的 `textInput`/`imageInput` 必须从同一动态目录的 `inputModalities` 严格投影，缺失、重复、未知或 accessor-backed modality 使 models 分支失败关闭，renderer 不按模型名猜测。不得返回 credential metadata、用户身份、上游原文、headers 或 endpoint。额度重置时间只能来自 billing period end，不得使用 OAuth credential expiry。

业务状态不能冒充 rc.2 的 `RpcErrorCode`。成功分支承载闭合 outcome：

```ts
type AuthOutcome =
  | { kind: "status"; status: PublicAuthStatus }
  | { kind: "diagnostics"; diagnostics: { pluginVersion: string; cli: { state: "ready"; version: string } | { state: "missing" | "invalid" | "unavailable" } } }
  | { kind: "login-started"; status: PublicAuthStatus; sessionId: string }
  | { kind: "logout-confirmation-required"; confirmationId: string; expiresAt: string }
  | { kind: "busy"; status: PublicAuthStatus; diagnosticId: string }
  | { kind: "cli-not-found"; diagnosticId: string }
  | { kind: "cli-unsupported"; diagnosticId: string }
  | { kind: "unsupported-auth-config"; diagnosticId: string }
  | { kind: "auth-required"; diagnosticId: string }

return { ok: true, value: outcome }
```

RPC error 分支只使用 rc.2 已有且语义匹配的码：schema 失败为 `bad-request` 并填 `details.issues`，调用 signal 中止为 `cancelled`，未分类异常为 `internal`。不得借用 `agent-busy`。Connection 的 correlation ID 留在 carrier 内部，handler/业务 DTO 不把它当可访问字段；`diagnosticId` 是本插件另行生成的随机安全标识。

handler 必须全程 non-throwing：依赖调用、业务逻辑、DTO 校验与 JSON 可序列化检查全部包在边界内；任何未知 throw 都折叠为固定脱敏的 `internal` `RpcResult`。若 throw 逃到 rc.2 carrier，它会变成可能含 `String(error)` 的 HTTP 500，因此属于 P0 实现错误。

## 7. 客户端 bundle

导出 `./client`，构建为 Harness lazy-CJS wrapper：

```js
window.__ModuleLoader__.load({
  id: "<package-json-name>",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    // compiled client
    return module.exports
  },
})
```

bundle ID 必须由最终 `package.json.name` 在构建时注入，不能在包名决策前硬编码；Host/client/patch 三处必须使用同一个精确 ID。

客户端依赖图至少包含：

- `@deepseek-ai/dsh-client-runtime`
- `@deepseek-ai/dsh-client-ui-settings`
- `@deepseek-ai/dsh-client-locale`
- `@deepseek-ai/dsh-client-connection`

最终 `package.json` 至少声明：

```json
{
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "default": "./dist/host/index.js"
    },
    "./client": {
      "types": "./dist/client/index.d.ts",
      "default": "./dist/client/client.js"
    },
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": {
      "patch": "grok-provider.patch.yml"
    },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-connection"
      ]
    }
  }
}
```

rc.2 的 Host 端 client-module scanner 会执行 `require.resolve("<package>/package.json")` 读取 `dsh.client` 声明，因此 `./package.json` 是 Web bundle 可发现性的必要公开元数据入口；缺失时 Host 插件仍可挂载，但浏览器启动图不会包含该包。

client bundle 导出 Cordis `inject` 与 `apply`，所需 services 至少为 `slots`、`locale`、`connection`。设置页通过 `ctx.slots.inject("settings.section", () => ctx.slots.register(...))` 注册。

Harness `0.1.1-rc.2` 的 `settings.section` options 只有 `id`、`order` 与 `label`，没有图标字段；未知 section id 会由设置 shell 显示 `IconSettingsOutline16`。Provider 可用独立、effect-owned 的视觉兼容层，将结构和规范化标签均唯一精确匹配的 `Grok Build` 导航按钮标记为内嵌的 `IconThinkOutline16` 路径几何。该层不是 Host DOM API：只能在本地读取设置导航标签用于匹配，不得读取设置页正文或用户内容、不得模糊匹配其他按钮，也不得外传或发起网络请求；歧义或结构不符时保留宿主齿轮。独立 style 必须显式带本插件的 `data-plugin` ownership，避免被其他 bundle 的 materialize/HMR 认领和删除。唯一 MutationObserver 必须过滤无关页面变化、合并同轮更新，并在最后一个 effect disposer 中停用待执行任务、断开 observer、移除 marker/style。

三类依赖必须分开：`dsh.client.inject` 只列提供所需 Cordis service 的 client plugin；bundle 动态 `require()` 且不是平台 seed 的 package 列入 `dsh.client.external`；React、UI primitives 等 Runtime 平台 seed 不进入 inject。Host/client 的真实静态和动态 import 图决定 peer 与 external，不能把所有 bundle require 一律塞进 inject。

客户端编译必须证明不能 import Host credential、transport、fs、path、child_process 或 auth JSON parser 模块。

## 8. 认证协调器

公共认证控制与私有凭据源必须在类型边界上拆开，避免 RPC/TUI 即使误用也拿到 token 方法：

```ts
interface PublicAuthController {
  status(): Promise<PublicAuthStatus>
  beginLogin(signal: AbortSignal): Promise<{ sessionId: string; status: PublicAuthStatus }>
  waitForLogin(sessionId: string, signal: AbortSignal): Promise<PublicAuthStatus>
  cancel(sessionId: string, signal: AbortSignal): Promise<PublicAuthStatus>
  beginLogoutConfirmation(): Promise<{ confirmationId: string; expiresAt: string }>
  confirmLogout(confirmationId: string, signal: AbortSignal): Promise<PublicAuthStatus>
}

interface HostCredentialSource {
  acquire(signal: AbortSignal): Promise<HostTokenLease>
  invalidateRejected(fingerprint: string): void
}
```

Web RPC 和 TUI 只获得同一个 `PublicAuthController`；`PinnedGrokTransport` 私有持有 `HostCredentialSource`。二者内部共享一个认证状态核，但没有可互相转换的公开对象。`HostTokenLease` 只能在 Host transport 消费，不可序列化，也不能被 RPC handler 返回。token fingerprint 只使用不可逆、进程内加盐的短摘要，用于缓存失效和测试，不写日志。

`beginLogin()` 只有在受管 CLI 已成功 spawn 后才返回 session；进程随后独立结算并更新共享状态。Web 用 `status` 观察，TUI 用 `waitForLogin` 等待。`cancel` 必须匹配当前 sessionId。logout confirmation 单次使用、短 TTL、绑定当前 auth generation；它是防误操作/陈旧 UI 机制，不是网络认证。

登录事务由 controller 自己的 `AbortController` 所有。RPC request signal 只控制“spawn 并发布 session 之前”的启动阶段；`beginLogin()` 返回后不能再把已结算的 unary request signal 当事务 owner。后台事务只能由匹配的 `cancel(sessionId)`、5 分钟 deadline、subprocess service teardown 或插件 dispose 中止。`PublicAuthStatus` 的 running 分支公开当前不透明 sessionId，因此 `/grok cancel` 可先读 status 后取消，无需用户输入 ID。

## 9. 官方 CLI 边界

Harness rc.2 不提供 HTTPS URL opener，也不需要插件自建 opener：插件通过受管进程 seam 启动官方 `grok login --oauth`，标准配置下由 CLI 自己跨平台打开浏览器。

只使用 `ctx.subprocess.resolveExecutable()` / `ctx.subprocess.spawn()`：

- 经过本插件路径/owner/realpath 检查的绝对 executable path，再交给 seam 验证。
- 固定完整 argv；seam 不做 shell 解释，插件自身不启动 shell。
- stdin ignored；stdout/stderr 使用 raw pipe，自行按 UTF-8 原始字节计数，任一超过 64 KiB 就 abort；始终 drain 且不透传原文。collect 模式的截断本身不会终止进程，因此不用于该门禁。
- 受控 cwd 与过滤环境。
- executable 解析、只读文件验证、`--version`、`login --help` 和最终动作分别取得并释放自己的 deadline；前一阶段不能消耗后一阶段的预算，caller AbortSignal 则贯穿全部阶段。文件系统 API 自身不可取消时，验证阶段在 abort 后停止等待结果且绝不启动 CLI。`handle.done` 与阶段 signal 竞争，不能阻止后续 cleanup；已启动进程的 whole-tree wait 使用新的有界 teardown signal。返回 `false` 或异常时调用幂等 terminate，并把内部 `cleanup-failed` 结果跨 official driver 传给 controller；公开状态只显示 `failed`，当前 driver 被隔离到 Host 重启或 subprocess replacement。tree wait 期间发生的 caller abort 不能被成功返回覆盖。
- 登录 starting、confirmed logout 与 credential refresh 都先登记为 controller-owned operation，再调用 official driver；三者共享 single-flight、AbortController、shutdown fence/async wait 和 driver registration token。replacement 会清除旧 logout confirmation；旧代际成功/失败不得启动后续动作或污染新 driver，当前代际 cleanup failure 会同时禁止 login/logout/refresh，直到 Host 重启或 subprocess replacement。
- single-flight、5 分钟 deadline、AbortSignal、`terminate()`、有界 `waitForExit(teardownSignal)` 与 async dispose cleanup。`waitForExit()` 返回 `false` 时记录脱敏 cleanup failure、让 disposer 有界结算，并把登录 capability 隔离为“需 Host 重启或 subprocess service replacement”；不得自动重新启用或永久卡住卸载。
- 只承诺 seam 可观察到的受管进程树；官方 CLI 根据可信配置启动并主动脱离该树的后代属于 vendor trust boundary。

不引入 npm `open`，不调用 `host.openPath`，也不把 HTTPS URL 当文件路径处理。

`--oauth` 只固定 loopback transport，不保证绕过 external provider/企业 OIDC，也不保证官方 CLI 内部不用 shell。公开 `SubprocessSpawnSpec` 没有 `windowsHide`；“Windows 不出现额外 console 闪窗”必须在 Gate 1 真实设备验证，失败则阻断发布并向 Harness seam 请求能力，不能绕回 `node:child_process`。

## 10. HMR 与卸载

卸载或热替换后必须：

- 注销 adapter 和 configurable provider。
- 注销 settings section、RPC handler 和 `/grok` command。
- 中止所有 fetch 和登录进程。
- 清空 token 内存缓存。
- 清理 timer、reader 与 event listener。
- 等待受控 inflight promise settle，不留下未处理 rejection。
- Provider Runtime 的部分安装失败必须逆序回滚；正常卸载即使某个 disposer 失败也继续清理其他资源，且整个 `dispose()` 只执行一次。
- 覆盖 Host activate → unload → activate 后只有一个 adapter/RPC/command；client bundle revision 更新后旧 slot、listener、store/controller 全部释放；subprocess service 替换时 child fiber 执行进程终止与有界等待后才卸载，并覆盖 `waitForExit()` 返回 `false` 的路径。

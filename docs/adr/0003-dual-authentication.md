# ADR-0003：双认证路径与自管 OAuth 凭据（已被取代）

> 状态：Superseded by ADR-0005。以下内容仅保留为历史设计记录，不属于 `0.1.0` 当前实现、接口或发布门禁。

- 状态：已接受，带发布阻断项
- 日期：2026-08-25
- 决策者：仓库所有者

## 背景

仓库所有者在接受“官方 CLI 登录 + 复用官方会话”后，进一步要求插件也能自行完成并持久化 OAuth token。两条路径服务不同需求，不能静默互相回退：

1. `official-cli`：插件启动官方 `grok login --oauth`，复用 `~/.grok/auth.json`；
2. `managed-device`：插件实现 OAuth 2.0 Device Authorization Grant，自行持久化、刷新和撤销 token。

本 ADR 替代 ADR-0001 中“首版拒绝自行 OAuth”的部分；固定 Proxy、失败关闭和 Host-only token 边界仍有效。

## 决策

### 1. 明确选择，不静默混用

设置 `authMode` 只能是 `official-cli` 或 `managed-device`。每次 `prepareCall()` 冻结认证 generation；同一请求不能从一条路径取模型目录、再从另一条路径取 token。401、缺失或过期都不得自动切换认证来源。

### 2. 自管路径使用 device flow

`managed-device` 使用固定 issuer `https://auth.x.ai` 的 discovery 文档，并只接受以下精确端点：

- device authorization：`https://auth.x.ai/oauth2/device/code`
- token：`https://auth.x.ai/oauth2/token`
- revoke：`https://auth.x.ai/oauth2/revoke`
- JWKS：`https://auth.x.ai/.well-known/jwks.json`

grant type 固定为 RFC 8628 device code；不启动 loopback listener，不接收粘贴 code，不使用 client secret。Web 只在明确用户手势后打开经过固定 origin/path 校验的 verification URI；TUI 显示脱敏的固定 xAI 地址与一次性 user code。轮询严格处理 `authorization_pending`、`slow_down`、过期、拒绝、取消与绝对超时。

### 3. Client ID 是发布阻断项

生产包只能内置 xAI 明确授权给本插件/第三方集成使用的 public client ID。不得直接把 Grok CLI 的 `b1a00492-073a-47ea-816f-4c329264a828` 当作本插件身份，也不得复制其他插件的 Client ID。

当前 xAI discovery 证明 public-client、device-code、refresh-token 与 PKCE 能力存在，但公开文档没有提供第三方 client 注册流程。开发可通过注入 fake OAuth boundary 完成全部单元/集成测试；真实自管 OAuth smoke 和 npm 发布必须等待 xAI 授权的 client ID 或明确书面许可。该阻断不能用隐藏设置、环境变量或用户粘贴第三方 Client ID 绕过。

### 4. 最小 scope

当前官方 CLI access token 的脱敏 claim 显示其 scopes 包含：

```text
openid profile email offline_access grok-cli:access api:access
conversations:read conversations:write workspaces:read workspaces:write
```

这只是上游 CLI 的现状，不是本插件应复制的最小集合。自管客户端首先请求 `openid offline_access grok-cli:access`，再通过 xAI 授权文件和真实 Proxy 门禁确认是否必须增加 scope。不得请求 `api-keys:*`、`logs:read` 或与 LLM Provider 无关的权限。scope 不足必须明确失败，不能暗中扩大授权。

### 5. 使用 Harness credential record

自管 grant 只通过 `ctx.credentials` 的 owner-scoped record 持久化：

```text
credentialKey(<最终 package owner>, "grok-oauth")
```

payload 使用版本化闭合 schema，只保存协议所需的 `accessToken`、`refreshToken`、`expiresAt`、`issuer`、`clientId`、`scopes` 和 `generation`；不保存 email、姓名、头像、team/org、ID token 或 userinfo。刷新必须在 `modifyRecord()` 的跨进程排他读改写中完成，以兼容 refresh-token rotation。

Harness rc.2 的默认 `dsh-credentials-local` 会把 grant 明文保存在 `$DSH_HOME/.credentials.yaml`：POSIX 为 `0700` 目录和 `0600` 文件、原子写入并拒绝宽权限；Windows 无法用 POSIX mode 验证 ACL。同一 OS 用户及其 agent 工具进程仍可能读取文件。这是明确披露的边界，不得称为 Keychain、Credential Manager、DPAPI 或“加密存储”。未来 Harness 提供 OS-keychain provider 时无需改变本插件 record 接口即可获得更强存储。

### 6. 刷新与注销

- 发送前进入固定 skew 时，在 credential record 的原子 mutation 内刷新一次；并发进程不能各自覆盖旋转后的 refresh token。
- token 响应、错误 body 与 JWT 均有字节/字段上限；不得记录原文。
- 已发送 POST 收到 401 后不自动重放；使 generation 失效，下一次明确请求才尝试刷新或返回 `AUTH`。
- 修订说明：该段属于已被 ADR-0005 取代的自管 OAuth 方案。官方 CLI 单一路线从 `1.0.3` 起按 ADR-0011 只允许在 200/SSE 开始前对 401/403 执行一次官方 CLI 刷新与重试；流开始后仍绝不重放。
- managed logout 先在原子 mutation 中把 grant 替换为不可用于推理/刷新的 revocation marker，再调用固定 revoke endpoint。远端撤销成功后删除本地 record；失败时原子恢复原 grant 以便用户明确重试。若恢复本身失败则保留不可用 marker，绝不能让待撤销 token 重新进入推理路径。
- official-cli logout 仍调用受限官方 CLI，绝不删除自管 record；两种 logout 必须显示作用域并分别二次确认。

## 后果

- 用户可以选择共享官方 CLI 会话，或使用插件独立会话。
- 插件承担 OAuth 协议、refresh rotation 和持久化安全责任；安全测试面显著扩大。
- `@deepseek-ai/dsh-credentials@0.1.1-rc.2` 成为自管模式的 required capability；缺失时该模式禁用，但 official-cli 模式仍可启动。
- 没有 xAI 授权的 client ID 时，自管模式不得进行生产真机登录，整个 `0.1.0` 也不得按当前用户要求发布。

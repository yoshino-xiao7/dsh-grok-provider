# ADR-0001：认证与传输路线

> 修订说明：官方 CLI 路径仍有效；“不自行 OAuth”的结论已由 ADR-0003 部分取代。动态模型目录见 ADR-0004。

- 状态：Accepted，已由 ADR-0003/0004 修订
- 日期：2026-08-25
- 决策者：仓库所有者

## 背景

项目需要把 Grok Build 模型接入 DeepSeek Harness，同时支持 macOS 和 Windows。第三方实现暴露出跨平台浏览器命令不完整、凭据边界过宽以及可能把 Bearer token 发送给远端返回 URL 等问题。本项目必须 clean-room 重写，不能以修补第三方代码为基础。

xAI 官方 Grok Build 文档提供三类可用集成面：

- `grok -p` Headless。
- `grok agent stdio` ACP。
- 登录后读取官方 `auth.json`，使用指定 headers 调用 CLI Chat Proxy。

Harness 需要的是 LLM adapter，而不是第二套 agent runtime。

## 决策

`0.1.0` 采用以下组合：

- Web 设置页和 TUI 可以发起登录；Host 只通过 Harness `ctx.subprocess`，以固定 argv 启动经路径/版本约束的 `grok login --oauth`。插件启动层不经过 shell。
- 标准配置下，系统浏览器、OAuth、loopback callback 和官方凭据写入全部由 xAI 官方 Grok Build CLI 完成；首版不实现静默 token refresh，失效时重新触发官方登录。
- 官方 CLI 及其有效 user/system/MDM 配置是明确的 vendor trust boundary。`--oauth` 只固定 loopback transport，不保证绕过 external auth provider、devbox 或企业 OIDC，也不保证 CLI 内部不用 `sh -c`/`cmd /C`。
- 插件只读 Grok 会话凭据，不实现 OAuth，不持久化第二份 token；只接受与绑定 CLI 版本的 xAI 生产 OIDC schema 相符的唯一候选。该 metadata 未签名，筛选用于失败关闭，不是密码学来源证明。
- 目录仅访问固定 `GET /v1/models`；推理按验证过的 catalog `api_backend` 访问闭合 endpoint。当前真实模型走固定 `POST /v1/responses`，不再假设单一 Chat Completions 方言。
- 只使用协议 spike 对绑定版本验证过的 xAI headers，并加入 Harness 要求的 attribution headers；所选动态模型不得被固定 override 偷换。
- 所有带凭据请求禁止重定向，不支持自定义 endpoint。
- 插件自身不启动 shell 或通用浏览器 opener；只允许通过 `ctx.subprocess` 启动 `grok login --oauth`、`grok logout`，并对候选路径、参数、输出、超时、并发与取消做闭合约束。

## 结果

正面结果：

- 不复制 OAuth Client ID，不承担 client secret、PKCE、loopback 和 refresh token 实现。
- 不引入 `open`、直接 `node:child_process` 或平台 shell 依赖；进程树生命周期由 Harness subprocess seam 管理。
- macOS 与 Windows 的登录差异由官方客户端处理。
- official-cli 路径不产生第二份落盘凭据；managed-device 的独立 grant 由 ADR-0003 约束。
- 依赖图可以保持接近零 runtime dependencies。
- 用户可像 `dsh-codex` 的 Web/TUI 流程一样，直接从 Harness 发起浏览器登录。

负面结果：

- 用户必须先安装官方 Grok Build CLI。
- 插件新增一个以当前 OS 用户权限运行、但调用面窄化的官方 CLI 子进程边界，必须覆盖路径劫持、输出超限、超时、取消和卸载测试。
- 官方 CLI 可能根据可信配置执行 external helper/企业 OIDC、同步 managed config 或发送其自身已启用的遥测；本项目不能承诺端到端无 shell或单一网络 origin。
- 重新登录可能替换/清除共享 Grok credential，取消或失败也可能使旧会话失效；logout 影响共享同一 `GROK_HOME` 的其他应用。
- 官方凭据过期时需要从 Harness 再次触发 `grok login --oauth`。
- official-cli 浏览器登录要求 Host 与浏览器处于同一本机桌面会话；managed-device 的远端浏览器语义由 ADR-0003 约束。
- 插件依赖官方凭据文件格式和 CLI Chat Proxy 契约。
- 官方文档的技术示例不等于永久服务条款授权；公开发布前仍需重新核对条款。
- `0.1.0` 当前只承诺官方支持的 macOS arm64 与 Windows x64。

## 失效条件

任一情况出现时必须重新评审本 ADR：

- xAI 移除或反对 auth.json API Access 文档。
- 服务条款明确禁止此类第三方集成。
- 官方凭据改为插件不可安全读取的存储。
- Chat Proxy 不再支持 Harness 所需的工具调用或流式协议。
- DeepSeek Harness 提供官方 OAuth/credential bridge，可在不复制凭据的情况下直接委托登录。
- xAI 提供可验证的 builtin-only/no-config 登录参数；届时应收窄 vendor trust boundary。

## 未采用方案

- 插件自建 OAuth：本 ADR 当时拒绝；仓库所有者随后明确要求并由 ADR-0003 以 device flow 形式采纳。
- Headless：无法保真映射 Harness LLM/tool 语义。
- ACP：引入第二套 agent、权限与会话生命周期。
- API Key：单独计费语义，不等价于 Grok Build 订阅路线。

## 依据

- [xAI Grok Build 官方 README](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/README.md)
- [官方认证 flow：`--oauth` 仅固定 loopback，external/devbox 仍优先](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/auth/flow.rs#L904-L909)
- [官方 external auth 实现：Unix `sh -c` / Windows `cmd /C`](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/auth/flow.rs#L193-L217)
- [官方 auth scope 生成规则](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/auth/config.rs#L200-L251)
- [官方凭据模型：issuer 是 client-side hint，不是 trust assertion](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/auth/model.rs#L123-L139)
- [官方 npm 支持平台](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/npm/grok/README.md)
- [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252)
- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700)

上述 `main` 链接只用于方案阶段说明；Gate 1 必须替换/补充为实际支持 CLI 版本的 immutable tag/commit 链接后，才能形成发布证据。

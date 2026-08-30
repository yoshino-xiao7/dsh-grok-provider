# Grok Build Provider 文档索引

- 状态：**`1.0.0` Search 响应协议修复候选开发中；尚未发布**
- 候选范围：允许已完成 Search 支撑的 reasoning ID 继续以多个严格空且逐次闭合的占位生命周期出现，并接受完成态精确 `open_page` type/URL；其余未知形状继续失败关闭
- 候选门禁：版本号、本地自动化、代码 PR #28 与 main CI run `33308371009` 的双平台门禁已完成；发布证据 final CI、最终提交、唯一制品、摘要/SRI、精确制品授权、发布与 Registry/signature/attestation/provenance 回读仍待完成
- 当前 npm 稳定版本：`0.1.11`
- 最近发布版本：`0.1.11`
- 发布基线：`yukiryou/main@2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`
- 发布路径：代码 PR #25 合入 `yukiryou/main@307ae3ac83526f388c6b4a0d1e1346353bd5f4aa` 后，发布证据 PR #26 形成最终 release commit；annotated tag object `353bcd3717d4440ab20a2b05a5e9d51eef22fa7f` peel 到该提交。final CI run [`33303080849`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33303080849) 的 macOS 14 / Windows 2022 均通过，Trusted Publisher run [`33303631312`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33303631312) 已完成
- 发布状态：仓库所有者明确授权的唯一 71 文件 tarball 为 207,022 bytes，unpacked size 656,139 bytes；SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，npm SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`。Registry、GitHub Release 与本地制品逐字节一致，npm `latest=0.1.11`；Registry 精确版本隔离安装及 Host/client smoke 通过。`npm audit signatures` 确认安装图中 9 个包具有已验证 Registry 签名、3 个包具有已验证 attestations，本包公开 metadata 包含 1 个 Registry signature、2 个 attestations；SLSA provenance 精确绑定 `release.yml`、`v0.1.11`、release commit 与 publish run
- 撤回状态：`0.1.8` 只对应 sidebar quota 维护发布，不包含 Search；撤回不会释放 npm semver，任何 Search 制品都不得复用 `0.1.8`
- 兼容基线：DeepSeek Harness `0.1.1-rc.2`
- 目标平台：macOS arm64、Windows x64

本仓库是一次 clean-room 重写。设计只依据 DeepSeek Harness 的公开接口、xAI 官方 Grok Build 文档和通用协议标准；不会复制、移植或修改 `dsh-llm-grok` 的源码、目录结构或实现细节。

## 推荐结论

首版采用单一认证路线：插件发起官方 Grok Build CLI 浏览器登录并复用由官方 CLI 持久化的会话。插件不注册独立 OAuth client，也不持久化第二份 token。

1. 用户在 Harness 设置页点击“使用 Grok 登录”，或在 TUI 输入 `/grok login`。
2. 插件 Host 通过 Harness `ctx.subprocess` 以固定 argv 启动经路径、能力与凭据契约约束的 Grok CLI 候选；该启动层不经过 shell。标准配置下由官方 CLI 完成系统浏览器、OAuth、loopback callback 和凭据写入。
3. 插件只读官方凭据文件并接受绑定 schema；token 不进入 renderer、settings、RPC、本插件日志或 workspace。
4. 模型目录只请求固定 `GET /v1/models`；推理按目录中经过验证的 `api_backend` 选择闭合 endpoint。当前真实模型都走固定 `POST /v1/responses`；拒绝重定向和自定义 endpoint。
5. 模型目录从固定 `/v1/models` 动态发现账号当前可用的全部 Grok Build 模型；本机当前快照为 `grok-4.6` 与 `grok-4.5`。
6. 包内不存在 OAuth client ID、client secret、device flow、插件实现的 refresh/revoke 或 Harness credential grant；浏览器登录、refresh grant 与持久化完全由官方 CLI 负责。

该路径要求本机安装受支持版本的官方 CLI。仓库所有者在 2026-08-26 将“插件自管 OAuth”要求改为“能跳转浏览器登录即可”，详见 ADR-0005。

安全边界需要说清楚：`--oauth` 只选择 loopback 浏览器 transport，不会强制官方 CLI 忽略其有效配置。官方 CLI 可能按用户/企业配置运行外部认证命令（其内部可使用 `sh -c` 或 `cmd /C`）或企业 OIDC。因此“无 shell”只适用于本插件到 CLI 的启动层，不是端到端保证。`0.1.0` 把官方 CLI 及其有效配置视为用户管理的可信组件，并在读取凭据后失败关闭：外部 provider、API key、企业 issuer、旧式或歧义记录都不允许进入固定 xAI Proxy。该本地 metadata 未签名，所以这是严格兼容性筛选，不是密码学来源证明。

还需接受这些共享副作用和残余风险：官方 login 可能先清除已有 credential，取消或失败也可能使旧会话失效；logout 会影响所有共享同一 `GROK_HOME` 的应用。官方 CLI 的 proxy、managed-config sync、更新检查与已启用遥测不受插件固定推理 transport 约束。当前第一方 token 可能具有 conversation/workspace read-write 等较宽 scope，泄漏影响不只一次聊天。Web `loopback` RPC 是浏览器 reachability/trust fence，不是本机进程身份认证；同一 OS 用户下的恶意进程不在本插件可防御边界内。

## 文档顺序

- [产品需求](./01-product-requirements.md)
- [架构候选与推荐路线](./02-architecture-options.md)
- [安全与威胁模型](./03-security-threat-model.md)
- [Harness rc.2 接口契约](./04-harness-contract.md)
- [兼容性与测试计划](./05-test-plan.md)
- [npm 发布计划与维护流程](./06-release-plan.md)
- [开发前决策门](./07-decision-gate.md)
- [Grok CLI 1.0.5 上游证据](./08-upstream-cli-1.0.5-evidence.md)
- [当前实现与发布状态](./09-implementation-status.md)
- [逐版发布检查表](./10-release-checklist.md)
- [能力路线图](./11-capability-roadmap.md)：`0.1.4` 图片输入及后续独立内容切片
- [`0.1.4` 图片输入上游证据](./12-upstream-image-input-evidence.md)
- [`0.1.9` Web/X Search 上游与固定 Proxy 证据](./13-upstream-search-evidence.md)
- [v0.1.1 中英双语发行说明](./releases/v0.1.1.md)
- [v0.1.2 中英双语发行说明](./releases/v0.1.2.md)
- [v0.1.3 中英双语发行说明](./releases/v0.1.3.md)
- [v0.1.4 中英双语发行说明](./releases/v0.1.4.md)
- [v0.1.5 中英双语发行说明](./releases/v0.1.5.md)
- [v0.1.6 中英双语发行说明](./releases/v0.1.6.md)
- [v0.1.7 中英双语发行说明](./releases/v0.1.7.md)
- [v0.1.8 sidebar quota 撤回说明](./releases/v0.1.8.md)
- [v0.1.9 中英双语发行说明](./releases/v0.1.9.md)
- [v0.1.10 中英双语发行说明](./releases/v0.1.10.md)
- [v0.1.11 中英双语发行说明](./releases/v0.1.11.md)
- [v1.0.0 候选中英双语发行说明](./releases/v1.0.0.md)
- [v0.1.2-rc.1 中英双语预发行说明](./releases/v0.1.2-rc.1.md)
- [ADR-0001：认证与传输路线](./adr/0001-auth-and-transport-route.md)
- [ADR-0002：首版能力边界](./adr/0002-v0.1-scope.md)
- [ADR-0003：已被取代的双认证设计](./adr/0003-dual-authentication.md)
- [ADR-0004：动态全模型目录](./adr/0004-dynamic-model-catalog.md)
- [ADR-0005：官方 CLI 单一认证路径](./adr/0005-official-cli-only-authentication.md)
- [ADR-0006：账户额度与模型能力面板](./adr/0006-account-dashboard.md)
- [ADR-0007：以能力与凭据契约判断 CLI 兼容性](./adr/0007-capability-based-cli-compatibility.md)
- [ADR-0008：图片输入使用异步请求编译器](./adr/0008-image-input-request-compiler.md)
- [ADR-0009：运行时版本诊断与闭合登录失败](./adr/0009-runtime-diagnostics-and-login-failures.md)
- [ADR-0010：默认关闭且独立配置的 Web/X Search](./adr/0010-default-off-web-x-search.md)

## 发布与后续开发门禁

`0.1.2-rc.1` 是唯一一次预发行尝试。仓库所有者决定从稳定 `0.1.2` 起不再发行预发行版；正式版缺陷通过新的递增稳定版本修复。`0.1.4` 已发布：仅精确 `grok-4.6` 开启图片，普通 user 与一层 tool-result 的红/蓝合成图共四次脱敏 Proxy 请求均通过；`grok-4.5` 的红图语义结果不可靠，因此失败关闭并与其他模型保持 text-only。`0.1.5` 维护发布供应链、账户面板投影与 Provider Runtime 安装事务。`0.1.6` 已发布图片历史 reasoning 兼容与 Windows CLI 分阶段 deadline 修复，精确制品、Trusted Publisher、Registry signature 与 provenance 均已验证；发布后图片能力已由仓库所有者确认可用。Windows 真机同时确认官方 `grok login --oauth` 可在 xAI OIDC discovery 阶段超时，此时登录 URL 尚未生成，不能据此声称 Provider 已修复或验证浏览器弹出。

`0.1.7` 已发布闭合 CLI 安装/版本诊断、登录失败可解释性，以及采用 MIT 许可的 Harness `IconThinkOutline16` 路径几何；它不接管官方 CLI 的网络、代理或 OAuth 流程。sidebar quota `0.1.8` 曾发布后撤回，且该 npm 号码不能复用；Search 从未作为 `0.1.8` 发布。`0.1.9` 发布精确 `grok-4.6` 的 Search 协议和页面，`0.1.10` 补齐 canonical settings 注册与调用级快照。`0.1.11` 已正式发布，收窄兼容真实 High Effort + Web Search 续跑出现的一次已关闭 reasoning ID 空占位复用，接受空 reasoning，并加入与 summary 严格互斥的官方 raw `reasoning_text` 生命周期。脱敏真实探针只观察到 summary delta，不能作为 raw reasoning 真机证据；浏览器手工对话、OAuth、完整真实会话和网络可达 Windows 真机外部浏览器弹出继续属于独立边界。完整门禁见[逐版发布检查表](./10-release-checklist.md)。

`1.0.0` 候选继续修复真实 Search stream 的剩余两种形状：Search-backed reasoning ID 可多次作为严格空占位重新出现；完成态 Web Search 可返回精确 `open_page` action。“严格空”要求 visible summary/content 与 summary/raw lifecycle 均为空，但允许有界 opaque `encrypted_content`；每次复用都必须有自己的 `response.output_item.done`，`response.incomplete` 不能吞掉 open 复用段，全部闭合后仍允许后续 max-token 终态；跨类型、非空、未知 terminal/accessor 字段继续拒绝。`open_page` 的 streamed/final type 与 URL 必须一致，Provider 校验后丢弃 URL 且从不访问。最终源码的脱敏真实账号验证只保留计数和终态：原始 Web/X 协议各完成 1 次、各 64 events，并观察到对应 Search；生产 adapter 共完成 5 次 Responses，direct Web/X 均为 `stop`，Harness 同名 `x_search` 三轮为 `tool-calls`、`tool-calls`、`stop`。未记录结果、URL、prompt、身份或凭据；这些不是 `1.0.0` 已发布、OAuth 或 Windows 真机验收证据。

## 官方依据

- [xAI Grok Build 官方仓库](https://github.com/xai-org/grok-build)
- [Grok Build 官方 billing extension：额度比例、周期与固定 CLI Proxy 请求](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/extensions/billing.rs)
- [Grok Build 官方 README：认证、auth.json API 调用、Headless 与 ACP](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/README.md)
- [Grok Build 官方认证指南：browser login 与凭据边界](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/02-authentication.md)
- [`dsh-codex`：Web/TUI 登录体验参考，不作为代码来源](https://github.com/Yan-Zero/dsh-codex)
- [RFC 8252：Native Apps OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8252)
- [RFC 9700：OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700)
- DeepSeek Harness `0.1.1-rc.2` 内置公开类型：`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-subprocess`、`@deepseek-ai/dsh-settings`、`@deepseek-ai/dsh-client-connection`

外部基础认证文档最近核对日期：2026-08-26；图片协议、精确模型页与固定 Proxy 图片 wire 最近核对/验证日期：2026-08-28；Search 官方文档、Grok Build sampler contract 与四组固定 Proxy Search wire 最近核对/验证日期：2026-08-30。后续版本正式发布前仍必须重新核对上游接口与服务条款。

# Grok Build Provider 文档索引

- 状态：**`dsh-grok-provider@1.0.2` 已正式发布，制品与供应链回读已关闭**
- 制品范围：完整校验严格空 reasoning lifecycle，但不再投影无内容 `Think`；首个非空 delta 才开始可见 block
- 当前已完成发布回读版本：`1.0.2`
- `1.0.2` 已发布基线：`yukiryou/main@be200f9352afe93b27dd2856d89c01674f0cd637`
- `1.0.2` 发布路径：annotated tag object `b7efd3aabb99c73e1747d2d87890cdf9b284c438` peel 到最终 release commit；final CI run [`33318426571`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33318426571) 双平台全绿，Trusted Publisher run [`33319150964` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33319150964/attempts/1) 已完成
- `1.0.2` 发布状态：仓库所有者明确授权的唯一 74 文件 tarball 为 255,282 bytes，unpacked size 789,962 bytes；SHA-1 `3feddb7048fe4c796037804518999b12ae491802`、SHA-256 `010a21770cb3e4e42b7195984df1f5bf8dc5027066198cf99b7d713ac045f605`、npm SRI `sha512-TcvvPUXBJZEA728pVnUrXSZebGfIoB5ATG5041wA1OFzOE+hFTO98C5Fxl99WuFW2y7V89gkusYIKCpGlLNQIg==`。冻结候选、GitHub Release asset 与 npm Registry tarball 逐字节一致，npm `latest=1.0.2`；Node `24.19.0` / npm `11.5.1` 锁定隔离安装和生产依赖审计通过，本包 1 个 Registry signature / 2 个 package attestations、安装图 11 个 signed packages / 2 个 attested packages，以及精确绑定 `release.yml` / `refs/tags/v1.0.2` / release commit / publish run 的 SLSA provenance 均已验证
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
- [v1.0.0 中英双语发行说明](./releases/v1.0.0.md)
- [v1.0.1 中英双语发行说明](./releases/v1.0.1.md)
- [v1.0.2 中英双语发行说明](./releases/v1.0.2.md)
- [v1.0.3 中英双语发行说明](./releases/v1.0.3.md)
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
- [ADR-0011：有界认证恢复与部分流保留](./adr/0011-bounded-auth-recovery-and-partial-stream-preservation.md)

## 发布与后续开发门禁

`0.1.2-rc.1` 是唯一一次预发行尝试。仓库所有者决定从稳定 `0.1.2` 起不再发行预发行版；正式版缺陷通过新的递增稳定版本修复。`0.1.4` 已发布：仅精确 `grok-4.6` 开启图片，普通 user 与一层 tool-result 的红/蓝合成图共四次脱敏 Proxy 请求均通过；`grok-4.5` 的红图语义结果不可靠，因此失败关闭并与其他模型保持 text-only。`0.1.5` 维护发布供应链、账户面板投影与 Provider Runtime 安装事务。`0.1.6` 已发布图片历史 reasoning 兼容与 Windows CLI 分阶段 deadline 修复，精确制品、Trusted Publisher、Registry signature 与 provenance 均已验证；发布后图片能力已由仓库所有者确认可用。Windows 真机同时确认官方 `grok login --oauth` 可在 xAI OIDC discovery 阶段超时，此时登录 URL 尚未生成，不能据此声称 Provider 已修复或验证浏览器弹出。

`0.1.7` 已发布闭合 CLI 安装/版本诊断、登录失败可解释性，以及采用 MIT 许可的 Harness `IconThinkOutline16` 路径几何；它不接管官方 CLI 的网络、代理或 OAuth 流程。sidebar quota `0.1.8` 曾发布后撤回，且该 npm 号码不能复用；Search 从未作为 `0.1.8` 发布。`0.1.9` 发布精确 `grok-4.6` 的 Search 协议和页面，`0.1.10` 补齐 canonical settings 注册与调用级快照。`0.1.11` 已正式发布，收窄兼容真实 High Effort + Web Search 续跑出现的一次已关闭 reasoning ID 空占位复用，接受空 reasoning，并加入与 summary 严格互斥的官方 raw `reasoning_text` 生命周期。脱敏真实探针只观察到 summary delta，不能作为 raw reasoning 真机证据；浏览器手工对话、OAuth、完整真实会话和网络可达 Windows 真机外部浏览器弹出继续属于独立边界。完整门禁见[逐版发布检查表](./10-release-checklist.md)。

`1.0.0` 已发布真实 Search stream 的剩余两种兼容修复：Search-backed reasoning ID 可多次作为严格空占位重新出现；完成态 Web Search 可返回精确 `open_page` action。脱敏真实账号验证未记录结果、URL、prompt、身份或凭据；发布与供应链回读仍不构成 OAuth 或 Windows 真机浏览器验收证据。

`1.0.1` 已发布 request 侧同名冲突与错误归因修复：固定 Proxy 会拒绝同时存在 Harness `web_search` / `x_search` function definitions 和同名 xAI server Search descriptors 的请求。Provider 先完整验证所有 functions，再只过滤已启用的同名 wire definitions；关闭开关时保留本地工具，历史 calls/results 原样保留，receipt 拒绝交集。SSE source transport error 不再被包装成 parser error，因此 HTTP 400 映射为 `PROVIDER_ERROR` 而非 `INVALID_RESPONSE`；401/403、429 与 abort 的既有映射也由 adapter 回归锁定。一次授权的脱敏原失败 X 会话结构回放以 8 messages、40 source functions、38 wire functions + 2 server tools、2 historical reserved calls、1 models GET、1 Responses POST、314 events 和 `response.completed` 结束；没有保存正文、URL、身份或凭据。精确 Node `24.19.0` 本地全量门禁、代码/main/final 双平台 CI、唯一授权制品、隔离安装、Registry、签名、attestations 与 provenance 回读均已完成；这些证据不替代 Windows 真机浏览器登录验收。

`1.0.2` 已发布，只修复可见 reasoning 投影及其对齐槽：普通空 item 保留既有校验，Search-backed 同 ID 复用保留精确 own-data/accessor 校验；空项产生零个 Harness block chunk，非空 summary/raw reasoning 在首个 delta 才按 output index 开始 block。可见非空 replay 与 Search 后整响应 replay 抑制不变；隐藏普通空项不占 replay 槽，其 encrypted content 校验后不持久化。候选源码真实账号验收中，Web 为 `5 Search / 1 非空 reasoning / 0 空 reasoning / 1 非空 text / 1 finish`，X 为 `3 custom-tool Search / 1 非空 reasoning / 0 空 reasoning / 1 非空 text / 1 finish`；只保留计数。旧会话不回写，认证、模型、图片、endpoint、URL、工具权限和 Windows 登录边界不变；发布、CI、制品与供应链回读也不构成网络可达 Windows 真机外部浏览器弹出验收。

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

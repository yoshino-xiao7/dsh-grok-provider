# 开发前决策门

状态：**已确认（2026-08-25）**

仓库所有者已接受“官方 CLI 及其有效配置为信任边界，并按推荐路线开发”。2026-08-26 进一步确认：`0.1.0` 的 Windows x64 真机验证移到首次发布后；`0.1.1` 及后续版本不再把重复真机验证作为常规发版门禁。发布审计、自动化平台矩阵和制品校验仍不可跳过。

2026-08-26 仓库所有者把认证要求收敛为“能跳转浏览器登录即可”；ADR-0005 取代 ADR-0003 的双认证设计。动态全模型目录仍以 ADR-0004 为准。

## 推荐决策

### 1. 登录体验

采用：Web 设置页按钮和 TUI `/grok login` 从 Harness 发起登录。

Host 通过 Harness `ctx.subprocess` 以固定 argv 启动经路径/版本约束的 `grok login --oauth`；插件这一启动层不经过 shell。官方 CLI 打开浏览器并持久化自己的 token，插件不实现第二套 OAuth client 或凭据库。

必须同时接受：`--oauth` 只固定 loopback transport，官方 CLI 当前没有 builtin-only/no-config 开关。它仍可能按用户、system 或 MDM 的有效配置执行 external auth command（内部可用 `sh -c`/`cmd /C`）、devbox 或企业 OIDC。本项目把“官方 CLI + 它的有效配置”作为用户管理的信任边界，只承诺插件自身不启动 shell。`0.1.0` 只支持标准 xAI 浏览器路径：已知环境型 external/enterprise override 在 spawn 前拒绝；磁盘/MDM 配置不能可靠预判，官方 CLI 仍可能先执行它们；登录后只有与绑定版本生产 OIDC schema 相符的候选可进入插件 transport。本地未签名 metadata 不是密码学来源证明。

### 2. 推理传输

采用：Host 有界只读官方 `~/.grok/auth.json`，选择唯一且与精确 CLI 版本的 xAI 生产 OIDC schema 相符的候选，再请求 xAI 官方文档公开的固定 CLI Chat Proxy。禁止自定义 endpoint、schema 不符凭据和重定向；真实 token 仍由 xAI Proxy 服务端验证。

### 3. 首版范围

采用：动态发现账号可用的全部 Grok Build 模型，并支持文本、reasoning、流式输出、usage 和 Harness 工具调用；能力只能依据真实协议声明/验证。

延期：Web/X Search、图片输入、图片生成、任意下载、API Key、多账号、企业 OIDC、ACP、Headless 和 Linux 发布承诺。仓库所有者已于 2026-08-28 接受这些内容类型的后续分版本序列，见 [能力路线图](./11-capability-roadmap.md)；该接受不改变 `0.1.0` 已发布范围。

### 4. 发布身份

采用并冻结：`dsh-grok-provider@0.1.0`。npm 页面通过发布账户、maintainers 与 provenance 关联维护者；Host、client bundle、patch 与 provenance 必须使用这一精确身份。

### 5. 发布门禁

采用：协议 spike、全部安全测试、macOS arm64 预发布真实 smoke、Windows x64 自动化矩阵、服务条款复核和 npm provenance 发布链配置通过后，才允许发布 `0.1.0`。发布后必须完成 provenance attestation、Registry 回读和 Windows x64 首次生产 inspector/真机验收；完成前对 Windows 明确标注“代码支持、真机未验证”。`0.1.1` 及后续版本以两平台 CI、契约、干净安装和制品校验替代重复真机门禁。

## 需要明确接受的代价

- 用户必须先从 xAI 官方渠道安装 Grok Build CLI。
- 插件会以 Harness Host 当前 OS 用户权限启动一个严格窄化的官方 CLI 子进程；该 CLI 可访问此用户的 Grok 配置与凭据，必须接受并测试这一新信任边界。
- 官方 login 可能先清除旧 credential；取消或失败也可能使共享会话失效。logout 会影响所有共享同一 `GROK_HOME` 的应用，因此 UI 必须提示并对 logout 二次确认。
- 官方 CLI 的 proxy、managed-config sync 与已启用遥测不受插件固定推理 transport 约束，需单独披露。
- Harness rc.2 的 Web `loopback` RPC 只提供浏览器 Origin/Fetch-Metadata reachability fence，不认证本机进程。按钮与 logout 二次确认是防误操作 UX；同一 OS 用户下的本地进程属于信任边界，若不能接受则 `0.1.0` 只能取消 Web login/logout、保留 TUI。
- 官方 CLI 文件本身含 refresh token，Host 原始读取会短暂接触其字节但不得使用、复制或写回。
- 首版浏览器登录面向本机 macOS/Windows 桌面会话；远程 Web/headless 不在承诺内。
- 首版功能刻意少于部分第三方插件，以消除搜索、生图和任意 URL 下载带来的风险。
- CLI Chat Proxy 和凭据文件是可变化的上游契约；未知版本或结构必须失败关闭。
- macOS x64 不在当前官方 CLI 支持矩阵；`0.1.0` 发布承诺为 macOS arm64 与 Windows x64。

## 已接受的残余风险与发布后状态

- 首个开发绑定版本已冻结为 `1.0.5`（build `5115b46bc909`），详见 `08-upstream-cli-1.0.5-evidence.md`。其 macOS 官方下载物无法通过严格代码签名验证；仓库所有者已明确接受这一残余风险并授权 `0.1.0` 首发，这不代表签名问题已经解决。
- npm 身份已确认，`dsh-grok-provider@0.1.0` 已发布；后续版本使用已配置的 npm Trusted Publisher。
- canonical GitHub repository URL：已冻结为 `https://github.com/yoshino-xiao7/dsh-grok-provider`，并用于 `package.json.repository`、provenance workflow 和发布脚手架。
- xAI 服务条款/官方许可没有第三方 adapter 的明确支持依据；仓库所有者已在 `0.1.0` 发布前复核并接受该残余风险。

仓库所有者已明确要求继续公开发布，并接受当前 CLI 契约/服务条款没有第三方 adapter 明确支持依据的残余风险。`0.1.0` 已完成发布；后续版本仍必须通过制品、CI、provenance 和 Registry 回读门禁。

## `0.1.4` 图片能力决定（2026-08-28）

`0.1.4` 只为精确 `grok-4.6` 开启普通 user 与一层 tool-result 的 JPEG/PNG 图片输入，请求固定使用 `detail:"high"`。该模型的红/蓝两种合成图在两个位置共 4 次固定 Proxy 请求均通过 HTTP 200、SSE completed 与规范化整段颜色语义断言。`grok-4.5` 的受控红图响应语义不可靠，因此即使 HTTP/SSE 形状成功也失败关闭为 text-only；所有其他模型同样保持 text-only。此决定不追溯改变 `0.1.0` 的历史范围，且不替代最终 Harness capability 复验、全量测试、审计、打包、CI、制品与精确发布授权。

## 确认语句

如果同意以上五项推荐决策，可回复：

```text
确认接受官方 CLI 及其有效配置为信任边界，并按推荐路线开发
```

确认后按以下顺序动工：

1. 登录与 Chat Proxy 协议 spike。
2. 建立测试脚手架，先写安全与契约测试。
3. 实现 Host 深模块、TUI 命令和 Web 设置页。
4. macOS/Windows 与 Harness rc.2 集成验证。
5. 打包审计。
6. 满足发布门禁后发布精确 npm `0.1.0` 并回读。

在收到确认前，仓库保持 docs-only。

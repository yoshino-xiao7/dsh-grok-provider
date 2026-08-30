# 发布检查表

本文件是每个 npm 版本的强制发布门禁。准备者必须从版本分支逐项完成并保存证据；未全部关闭前不得合并发布基线、创建最终 tag、发布 GitHub Release 或执行 `npm publish`。发布还需要仓库所有者明确授权，检查表全绿本身不构成发布授权。

`0.1.2-rc.1` 是历史上唯一一次预发行尝试。从稳定 `0.1.2` 起不再发行预发行版本；正式版缺陷通过新的递增稳定版本修复。下列稳定版完整合并门禁适用于所有后续发布。

## 每版发布前

- [ ] 冻结精确稳定版本，并同步 `package.json`、CHANGELOG、中英文 README、release notes 和候选文件名。
- [ ] 中英文 README 已互相链接、内容同步，不包含“尚未发布”等与候选状态冲突的文字。
- [ ] `SECURITY.md`、文档首页、实现状态、上游证据和发布计划反映当前事实。
- [ ] GitHub About、Topics、npm repository/homepage/bugs 与 canonical repository 一致。
- [ ] GitHub Private vulnerability reporting 已启用；`yukiryou/main` 禁止强推/删除，并要求 PR 与 macOS/Windows CI。
- [ ] `npm test`、`npm audit --omit=dev`、`npm run pack:check` 和 macOS/Windows CI 全部通过。
- [ ] 从干净 checkout 只生成一个候选 tarball；记录文件数、大小、SHA-256 和 base64 SHA-512。
- [ ] 候选 tarball 内的 name、version、repository、exports、peer、patch、脚本和文件白名单通过审查。
- [ ] 候选 tarball 内的 `LICENSE`、`THIRD_PARTY_NOTICES.md` 与实际内嵌第三方代码逐项一致，发行制品不遗漏归属、版本或许可证说明。
- [ ] 从同一个 tarball 在隔离 Harness profile 完成安装、加载与必要 smoke；普通版本不重复要求跨平台真机，认证、CLI 或平台边界变化时另行指定。
- [ ] GitHub Release 说明中文在前、英文在后，且正文不重复页面已有的版本标题。
- [ ] 版本分支经 PR 合并到 `yukiryou/main`；最终 tag 指向被验收的发布提交。
- [ ] GitHub Release 只附加已验收的唯一 tarball，workflow 输入使用该文件的精确 base64 SHA-512。
- [ ] npm Trusted Publisher 仍绑定 `yoshino-xiao7/dsh-grok-provider`、`release.yml`、Environment `npm`，且只允许 `npm publish`。
- [ ] GitHub Environment 不含 `NPM_TOKEN`，workflow 不含 `NODE_AUTH_TOKEN`、npm write token 或其他持久发布凭据。
- [ ] 仓库所有者明确授权发布当前精确版本。

## 每版发布后

- [ ] 回读 npm name、version、repository、dist-tag、SRI 和 provenance attestation。
- [ ] 从 Registry 重新下载 tarball，确认 SHA-256/SHA-512 与 GitHub Release 候选逐字节一致。
- [ ] 用 Registry 精确版本执行安装检查，不使用浮动 `latest` 代替证据。
- [ ] 更新 README 路线图、实现状态、catalog/marketplace 状态和 CHANGELOG 日期；这些状态更新必须进入下一候选前的文档审计。
- [ ] 创建下一版本的 `yukiryou/v<next-version>` 分支，后续开发不直接进入发布基线。

## `0.1.0` 首发复盘

已完成：npm 发布、Registry 完整性回读、provenance、Trusted Publisher、传统 Token 禁用、临时凭据撤销、GitHub Release 双语说明、`dsh-plugin` Topic 与 YukiRyou catalog 的 macOS arm64 精确版本条目。

流程缺陷：首发 tarball 内的 README、`SECURITY.md` 和部分状态文档仍保留预发布措辞。npm 同一 name/version 不可覆盖，因此 `0.1.0` 页面中的 README 只能由后续递增版本纠正。此后“文档状态与候选版本一致”是发布前硬门禁，不再作为发布后补项。

仍需跟进但不回溯阻断 `0.1.0`：Windows x64 首次 Registry 真机验收。公共 curated 目录的后续事项已由 `awesome-dsh-plugin` PR #3415 完成并进入 `model` 分类；该目录不表达精确 npm 版本或平台验收。

## `0.1.1` 发布记录

- [x] 使用独立版本分支 `yukiryou/v0.1.1`。
- [x] 长期发布 workflow 改为 GitHub OIDC，不读取 npm Secret。
- [x] macOS/Windows CI 已通过 OIDC workflow 改造分支。
- [x] GitHub Private vulnerability reporting 已启用，`yukiryou/main` 已配置 PR、双平台 CI、防强推和防删除保护。
- [x] 完成所有发布事实文档、中英文 README 与 `SECURITY.md` 同步。
- [x] `package.json`、lockfile 与制品契约测试已同步为 `0.1.1`，中英双语 release notes 已完成且不重复页面标题。
- [x] 本地完整测试 57 项通过（55 pass、2 项 Windows-only 按预期跳过），`npm audit --omit=dev` 为 0 vulnerability，GitHub macOS/Windows CI 均通过。
- [x] 从提交 `d35bda3402db5b16edd83d81420f1068006254a8` 生成预审 tarball；48 个文件、93,652 bytes，SHA-256 `bdaf7c32a22afd74e1c526e07c91f441942fedab3e0d34c01134fedda6e323b9`，SRI `sha512-ENpeVSsHDiByG6Cf03pl1j4eRHAsYQkrwU4sVAMct4D2aFXoZoFTivP0ZpwaM1tzD0NdXlPzlLdtlSd0F48wCw==`；同一文件在全新临时目录完成 peer 安装、manifest 回读与 Host 模块加载。
- [x] 仓库所有者于 2026-08-26 明确授权发布精确 `dsh-grok-provider@0.1.1`；README/状态页已切换为最终公开事实，CHANGELOG 日期已冻结。
- [x] 从最终 release commit `a973828bcdd906836b68018f7592e73f769f9c3e` 生成并验收唯一发布 tarball；预审 tarball 未进入 Release。正式制品 48 个文件、93,992 bytes，SHA-256 `9bcd2362af369ace69763cfed11d843d9574a43b134c7e194e589750ba4081c7`，SRI `sha512-O2Rh21NBZkqwXu7iUWKi8OwKzZaOHZ5sB0+Ny0w9VYgxXzVRXWHtsPfqmz4EpY6Cn8kSBsiJ3jVOJT/UQpEFKw==`。
- [x] GitHub Release、Trusted Publisher OIDC npm 发布、Registry 逐字节回读、签名与 provenance 验证全部完成；npm `latest` 指向 `0.1.1`。

English summary: every release must close documentation, security, tests, deterministic artifact, bilingual release notes, OIDC identity, integrity, and post-publish readback gates before publication. A green checklist never replaces explicit owner approval.

## `0.1.2-rc.1` 预发行记录

- [x] 使用版本分支 `yukiryou/v0.1.2`，不提前合并稳定基线。
- [x] Windows `0.2.82` 回归、macOS/Windows CI、生产依赖审计与 dry-run 打包通过。
- [x] 仓库所有者明确授权发布精确 `dsh-grok-provider@0.1.2-rc.1` 到 npm `next`；未授权稳定 `0.1.2`。
- [x] 从提交 `6e6201734cab1d8b7d4aa88535b3a3e7e02376ea` 冻结唯一预发行 tarball并附加到 GitHub prerelease：51 个文件、99,559 bytes，SHA-256 `b47d3de72ddb718159d0ede5d2a3e0e1c91b09900134bb48951d82cb93ac489e`，SRI `sha512-NpmuJYvsqnpaupChDfwumOZ69ikwXc8pg/CZqnbGJwpVFy/Y05/QT9q99pj33ON5u8sp1pm0uAzGmC1Db8Qg6Q==`。
- [x] Trusted Publisher run `32956881639` 从不可变 `v0.1.2-rc.1` 标签发布成功；Registry 回读确认 `next=0.1.2-rc.1`、`latest=0.1.1`，重新下载文件逐字节一致，1 个 Registry 签名与 1 个 provenance attestation 验证通过。
- [ ] Windows x64 从 npm 精确预发行版本完成浏览器登录、凭据复验、模型刷新与最小对话。

仓库所有者随后终止预发行验收路线并授权直接发布稳定 `0.1.2`；上述未完成项保留为历史事实，不转写为已验收。

## `0.1.2` 发布记录

- [x] 仓库所有者明确授权直接发布精确稳定 `dsh-grok-provider@0.1.2`，Windows 独立真机验收不再作为阻断项。
- [x] 仓库所有者决定以后不再发行预发行版；正式版缺陷使用新的递增稳定版本修复。
- [x] 中英文 README、正式 Release 说明、安全状态和发布政策已同步，并公开披露 Windows 独立真机尚未完成。
- [x] 稳定 manifest、稳定版专用 Trusted Publisher workflow、完整测试、审计与双平台 CI 通过；CI run `32980619235` 的 macOS 14 与 Windows 2022 job 均成功。
- [x] 版本分支经 PR #4 合并 `yukiryou/main`；release commit `30ff6bdeb62f7904baf02c4a5f9ebd73e2edf442` 冻结唯一稳定 tarball与不可变 `v0.1.2` tag。制品为 51 个文件、99,894 bytes，SHA-256 `b224db9f52708b355baa914c0fa4a352e9f791c3e51a36c7309a3b89cbc2781a`，SRI `sha512-XhaOjOflDGsNUaAYnIw1aoJ/zHfPbYtubLKvTUu6aro3olaLWek6xdEe83DpAmwJT6xM3s0+y0QOnEh1kQtl9w==`。
- [x] GitHub 正式 Release 与 Trusted Publisher run `32981172053` 完成；npm `latest=0.1.2`，Registry 重新下载文件逐字节一致，1 个 Registry 签名与 1 个 provenance attestation 验证通过。

## `0.1.3` 发布准备

- [x] 使用稳定版本分支 `yukiryou/v0.1.3`，未直接修改发布基线。
- [x] 使用真实脱敏 Ark `toolu_ark1_…|fc_…` 调用 ID 建立先红后绿的确定性回归测试。
- [x] 修复只触及历史工具调用 ID 的请求转换；未改动 OAuth、CLI、凭据、额度、模型目录、endpoint 或平台安全边界。
- [x] `package.json`、lockfile、CHANGELOG、中英文 README、文档状态和中英双语 Release Notes 已同步为精确稳定 `0.1.3` 候选。
- [x] 本地 Node 24 完整测试通过：62 项、60 pass、0 fail、2 项 Windows-only 按预期跳过。
- [x] `npm audit --omit=dev` 为 0 vulnerability；`npm run pack:check` 通过，dry-run 清单为 52 个文件且不包含 `src`、测试或本机证据。
- [x] macOS/Windows CI run `33041492669` 通过；版本分支经 PR #5 合并 `yukiryou/main`。
- [x] 从最终 release commit `cc531e0f02fab962ee704fbfd36f9099d5ecfeb2` 冻结唯一 `dsh-grok-provider-0.1.3.tgz`：52 个文件、103,305 bytes、SHA-256 `08b00745cbe97599818dce9f9c800ad651fdb781b76d00d34022d24b7e017029`、SRI `sha512-EkBhfoFU0PjQePqxTGvTnYE2bpTeFSN71zJGpt+PrkERJCapMpm1A4QkV98e1NmCe9DW6aa8pmkFHOifbSDvYw==`；隔离安装后 manifest、Host 名称与 `apply` 导出加载通过。
- [x] GitHub 正式 Release 使用中英双语正文且不重复页面标题，只附加上述唯一 tarball；`v0.1.3` 精确指向 release commit。
- [x] 仓库所有者于 2026-08-27 明确授权发布精确 `dsh-grok-provider@0.1.3`。
- [x] Trusted Publisher run `33041791394` 发布成功；npm `latest=0.1.3`，Registry 重新下载文件逐字节一致，1 个 Registry 签名与 SLSA provenance attestation 回读通过。
- [x] 发布后补充根目录 `screenshots.json`，将三张仓库托管预览图提供给兼容市场；公共 `awesome-dsh-plugin` 收录 PR #3415 自动门禁通过，随后已由维护者合并并进入 `model` 分类。该目录不记录精确 npm 版本或平台验证字段。

## `0.1.4` 开发与发布门禁

- [x] 使用独立分支 `yukiryou/v0.1.4`；在图片真机协议门禁关闭前未合并发布基线或制作最终制品。
- [x] 以 ADR-0008 冻结异步 request compiler、可选 attachment seam、精确模型 route、jpeg/png data URL、oldest-first 淘汰及资源边界。
- [x] 离线实现和聚焦测试覆盖纯文本兼容、一层 tool-result、attachment 去重、图片数量/总字节/最终 JSON 淘汰、格式与投影元数据、取消、错误分类和真实 `LlmRuntime` modality 投影。
- [x] 固定 CLI Chat Proxy 的精确 `grok-4.6` 普通 user 图片门禁通过：红/蓝两次均为 HTTP 200、`text/event-stream`、completed，规范化整段回复只含正确颜色词与可选句末标点。
- [x] `grok-4.6` 的 `function_call_output.output` text/image/text 门禁通过：红/蓝两次同样满足 HTTP/SSE/completed 与整段颜色语义断言。4 次请求固定 `detail:"high"`，只记录脱敏计数，不保存 token、图片、prompt、回复正文或身份数据。
- [x] `grok-4.5` 的受控红图结果语义不可靠；最终决定仅 `grok-4.6` 声明 image，`grok-4.5` 与其他模型全部 text-only，失败关闭而不依据 HTTP 200/SSE 形状广告能力。
- [x] 按最终模型集合复验 Harness `0.1.1-rc.2` 真实 attachment-local/LlmRuntime：内容寻址与 299-byte PNG projection、普通 user 与一层 tool-result `text/image/text` 有序 wire、仅 `grok-4.6` 保留 `input_image`、`grok-4.5`/`grok-future` text-only、共编译 4 个请求且网络请求为 0。
- [x] 开发树 Node 24 完整测试通过：93 项、91 pass、0 fail、2 项 Windows-only skip；preflight `npm run pack:check` 与加入真机脚本后的聚焦测试通过，未跟踪的重复文档未进入 dry-run 清单。
- [x] 最终版本与发行文档同步后重新运行 Node 24 全量测试（119 项、117 pass、0 fail、2 项 Windows-only skip）、`npm audit --omit=dev`（0 漏洞）和 `npm run pack:check`（58 个文件）。
- [x] 新候选的 macOS/Windows CI run [33149124946](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33149124946) 全绿；两个 job 均完成 `npm ci --ignore-scripts`、全量测试、生产依赖审计与 `pack:check`。
- [x] 同步 `package.json`、lockfile、制品契约测试、中英文 README 安装版本、正式 CHANGELOG 日期和 `docs/releases/v0.1.4.md`；未发布事实使用“当前源码版本/发布后可用”表述，未预写 npm 或 GitHub Release 已存在。
- [x] 版本分支经 [PR #8](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/8) 合并 `yukiryou/main`；代码合并提交为 `39fbaf1ab3f77b3f0af0727e87b8a64534efbb8d`。
- [x] 从最终 release commit `59776af8e954aa6e14463c659a22c6c3d5798bb5` 冻结唯一 `dsh-grok-provider-0.1.4.tgz`，并从同一制品完成隔离安装/加载 smoke：58 个文件、130,958 bytes、SHA-256 `7a1733c1ab391150430d3f302ff5cb3d04f5153c339ecbdbfba128191d02ad3e`、SRI `sha512-IkEFEdBnt/EpE9y8mCAyE6i+023Z2229J6gsR2y1cNZ+md9rwpxiqb5IsDMZO84ewh65wMM/ajCQ6F4UT2bDGg==`。
- [x] GitHub 正式 Release [v0.1.4](https://github.com/yoshino-xiao7/dsh-grok-provider/releases/tag/v0.1.4) 使用中文在前、英文在后且不重复页面标题，只附加唯一已验收 tarball；`v0.1.4` 精确指向 release commit。
- [x] 仓库所有者于 2026-08-28 明确授权发布精确 `dsh-grok-provider@0.1.4`。
- [x] Trusted Publisher run [33151195684](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33151195684) 发布完成；npm `latest=0.1.4`，Registry tarball 与本地/Release 制品逐字节一致，签名与 SLSA provenance attestation 验证通过。

## `0.1.5` 开发与发布门禁

- [x] 从精确 `0.1.4` release commit `59776af8e954aa6e14463c659a22c6c3d5798bb5` 创建独立分支 `yukiryou/v0.1.5`。
- [x] 发布 workflow 强绑定稳定 tag ref、剥离后的 tag commit 与 `github.sha`，并要求非草稿、非预发行且仅含唯一精确 tarball 的 GitHub Release；发布 Node 固定为 `24.19.0`。
- [x] 账户面板从严格模型 `inputModalities` 投影 text/image capability，客户端只为图片模型显示中英文图片输入标签；畸形目录失败关闭。
- [x] Provider Runtime 部分安装失败时按相反顺序回滚已注册资源；成功卸载保持幂等并尽力执行全部清理。
- [x] 同步 `package.json`、lockfile、CHANGELOG、中英文 README、`SECURITY.md`、状态文档和 `docs/releases/v0.1.5.md`；不把维护候选写成已发布事实。
- [x] 本地精确 Node `24.19.0` 全量测试通过：133 项、131 pass、0 fail、2 项 Windows-only skip；`npm audit --omit=dev` 为 0 漏洞，`npm run pack:check` 为 59 个文件，`git diff --check` 通过。
- [x] PR [#10](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/10) 合并到 `yukiryou/main`，merge commit 为 `a0bb3864b474f3129050a211bf44d0bf73a9474e`；PR CI run [33160850486](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33160850486) 的 macOS 14 与 Windows 2022 job 均通过。
- [x] 发布证据 PR [#11](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/11) 合并后，最终 release commit 为 `4f0bcd84f96c1cd5d95dda2a01ce63ff6403b828`；其 [CI run 33161259276](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33161259276) 的 macOS 14 与 Windows 2022 job 均通过。
- [x] 从最终 release commit `4f0bcd84f96c1cd5d95dda2a01ce63ff6403b828` 冻结唯一 `dsh-grok-provider-0.1.5.tgz` 并完成隔离安装、manifest/export、digest 与清单核验：59 个文件、135,800 bytes、SHA-256 `4b1690408703ae9818015e335845e9a4b5fe352ca4c98d34400f4bad4d8d7c14`、SRI `sha512-rVryka0x63QsjBiKnMPK09A5yArB9nmDyYWTOpxFWzs6ged7YzEua2h7CkHgGl/i7Al+Csebzg+30/+Q/8HHKg==`。
- [x] 仓库所有者于 2026-08-28 在最终制品证据后明确授权发布精确 `dsh-grok-provider@0.1.5`。
- [x] 不可变 `v0.1.5` tag 精确指向 release commit；GitHub Release [v0.1.5](https://github.com/yoshino-xiao7/dsh-grok-provider/releases/tag/v0.1.5) 只附加唯一已验收 tarball，Trusted Publisher run [33162280108](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33162280108) 发布完成。npm `latest=0.1.5`，Registry tarball 与本地/Release 制品逐字节一致，签名、npm publish attestation 与 SLSA provenance 验证通过。

## `0.1.6` 维护版开发与发布门禁

- [x] 从 `origin/yukiryou/main@9dbd655e01188892db650dcbfb1b9c6d7a67099c` 创建独立分支 `yukiryou/v0.1.6`；用户未跟踪文档 `docs/10-release-checklist 2.md` 未修改、未暂存且由 `docs/.npmignore` 排除。
- [x] 未完成的 Web/X Search 方案移出 `0.1.6` runtime、测试脚本与 npm 制品，并保存在本地 `yukiryou/v0.1.7-search-planning@71cab9c`；本版不新增 Search、生成、API Key 或 endpoint 能力。
- [x] 图片历史兼容回归覆盖 `subagent-settled` 后续图片及普通 user 同消息 `text/reasoning/image/reasoning/text`；普通 user/system 私有 reasoning 省略且可见 text/image 顺序保持，assistant replay 与 tool-result 边界不放宽。非字符串/超限 reasoning 仍在 attachment I/O 前按通用非法 request 失败。
- [x] Windows 冷启动 fake 先红后绿：executable 解析、文件验证、`--version`、`login --help` 与最终动作使用独立 deadline；各准备阶段均低于预算但累计超过旧总预算时仍到达 `login --oauth`。direct `done`/tree wait、cleanup 失败、driver quarantine/replacement 和 caller late-abort 回归已关闭；login starting、confirmed logout 与 credential refresh 都受 controller-owned single-flight、shutdown fence 和 registration-token 门禁，不会永久悬挂、漏等旧树、误报 stale success 或自动启动第二棵进程树。
- [x] 仓库所有者于 2026-08-28 明确决定先发布 Registry 精确 `0.1.6`，再自行验证图片和 Windows 外部浏览器弹出；发布前不得把代码、slow-fake 或 Windows CI 表述为 Windows 真机已确认，失败时发布新的递增稳定修复版。
- [x] `package.json`/lockfile、CHANGELOG、中英文 README、`SECURITY.md`、状态文档、路线图与 `docs/releases/v0.1.6.md` 已同步为候选事实；npm `latest` 在正式回读前继续如实记为 `0.1.5`。
- [x] 精确 Node `24.19.0` 全量测试通过：161 项、159 pass、0 fail、2 项 Windows-only skip；`npm audit --omit=dev` 为 0 漏洞，最终 dry-run pack 为 60 个文件，`git diff --check` 与秘密模式扫描通过。Search 规划文件和用户未跟踪的重复 checklist 均未进入清单。
- [x] 代码 PR [#13](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/13) 已合入受保护 `yukiryou/main`，merge commit 为 `712d0212f137850af4fc063cc30a7ff2f1e53ea3`；最终 head `40796e1feba0fe36f45f63ebdf89ce34d365033f` 的 CI runs [33176392234](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33176392234) 与 [33176396649](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33176396649) 均完成 macOS 14、Windows 2022 全绿。发布证据合并后的最终 release commit 为 `93519f77adc4ce2edfc1bbd27bce9e44d4805da6`。
- [x] 从最终 release commit 只冻结并发布同一份 `dsh-grok-provider-0.1.6.tgz`：60 个文件、145,620 bytes、SHA-256 `fd660d91216086496a4d189cb7e60b3445079913c97da41fccf805e3086c0347`、npm SRI `sha512-Vsmzm+8tgmHCuS8WKfzicjgauupY9FZ5B/V+55KbCTggBrThDDArjeS2bwHUVpjd92CvO47ya3SHELdWtTijAQ==`。
- [x] 仓库所有者在完整提交与制品证据后明确授权发布精确 `dsh-grok-provider@0.1.6`。
- [x] 不可变 tag、唯一 GitHub Release asset 与 Trusted Publisher run [33177647530](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33177647530) 发布完成；npm `latest=0.1.6`，Registry 字节、签名与 provenance 已回读验证。

## `0.1.7` Windows 运行时诊断与设置图标维护版门禁

- [x] 当前候选分支 `yukiryou/windows-auth-runtime-status` 基于 `origin/yukiryou/main@3b2a1c3b40e852be4974cd46a8b921e485900857`；范围冻结为 Windows 运行时诊断、登录失败可解释性与 `IconThinkOutline16` 设置导航图标维护，当时 Web/X Search 计划顺延到 `0.1.8`，本版不新增模型、Responses wire、认证 origin 或 Search runtime。`0.1.8` 后来由 sidebar quota 维护发布占用并在发布后撤回，Search 实际迁移到 `0.1.9`。
- [x] 发布后事实已如实记录：精确 `0.1.6` 的图片输入可用；Windows 直接运行官方 CLI 时在生成登录 URL 前发生 xAI OIDC discovery timeout。该事实不是 Windows 外部浏览器弹出已修复或已验证的证据。
- [x] 候选代码已加入独立只读 diagnostics RPC、插件/CLI 版本安全投影、`ready|missing|invalid|unavailable` 闭合状态、并发 single-flight、调用方取消与 capability teardown；公开 DTO 不包含路径、环境、stdout/stderr 或授权 URL。
- [x] 候选代码已把登录失败限制为白名单 reason，并只在固定 OIDC discovery endpoint 与 timeout 特征同时出现时投影 `auth-network-timeout`；错误退出会闭合 spinner，插件不修复代理或接管官方 OAuth。
- [x] 候选代码已内嵌 MIT `IconThinkOutline16` 几何并实现设置导航内的精确标签唯一匹配、歧义失败关闭、重复挂载引用计数与完整卸载清理；`THIRD_PARTY_NOTICES.md` 和发行物测试已记录来源与包内许可要求。
- [x] ADR-0009、产品需求、威胁模型、测试计划、发布计划、实现状态、路线图与上游图片证据已同步为 `0.1.7` 候选事实，并保持 Windows 浏览器验证边界。
- [x] `package.json`/lockfile、CHANGELOG、中英文 README、`SECURITY.md`、制品契约与双语 `docs/releases/v0.1.7.md` 已同步为精确 `0.1.7` 候选事实和候选文件名。
- [x] 精确 Node `24.19.0` 本地全量测试通过：190 项、188 pass、0 fail、2 项 Windows-only skip；`npm audit --omit=dev` 为 0 漏洞，dry-run pack 为 64 个文件，`git diff --check`、生成 client bundle 一致性与秘密模式扫描通过。用户未跟踪的重复 checklist 和 Search runtime 均未进入清单。
- [x] 代码 PR [#16](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/16) 已合入受保护 `yukiryou/main`，merge commit 为 `b1d8bdf3f063d0a8f61ec28cde83c5cefd5352ff`；候选 head `da66a2305184aa187de6fc657b08d1ab58dc0672` 的 CI runs [33225068169](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33225068169) 与 [33225065967](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33225065967)，以及 merge commit run [33225274039](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33225274039)，均完成 macOS 14、Windows 2022 全绿。当前证据分支经受保护 PR 合入后得到最终 release commit。
- [ ] 完成 Windows 真机三态证据：CLI 缺失提示；OIDC discovery timeout 及时闭合并显示安全提示；discovery 可访问时由官方 CLI 实际弹出外部浏览器。完成前不得声明 Windows 浏览器登录已修复或已验证。
- [x] 发布证据 PR #17 合并后的最终 release commit 为 `68f6b474bd860b829f03e7712ec79e8afe2b9b8d`；其 CI run `33225655567` 的 macOS 14 / Windows 2022 全绿。
- [x] 从最终 release commit 唯一生成并复用同一 `dsh-grok-provider-0.1.7.tgz`：64 个文件、167,970 bytes、SHA-256 `fd4d2a77b70335cb71f950f299e3c6e0b57d3720de424d99343bd58921a40aaf`、SRI `sha512-QhCvp/Y0vq1XHY7XQ+anUnv4sxHH4xxhDRPCzDvqCpXHRgc+IrzJS62bqf5ALGx6fRoKWchy/dbJ0n+LjmkS2w==`；隔离 manifest、Host/client export 与文件清单验收通过。
- [x] 仓库所有者在完整提交与最终制品证据后明确授权发布精确 `dsh-grok-provider@0.1.7`。
- [x] 不可变 `v0.1.7`、唯一 GitHub Release asset 与 Trusted Publisher run `33226665968` 已完成；npm `latest=0.1.7`，Registry、Release 与本地 tarball 逐字节一致，10 个 Registry signatures、2 个 attestations 与 SLSA provenance 已回读验证。

## `0.1.8` sidebar quota 撤回记录

- [x] `0.1.8` 曾作为 sidebar quota 维护版发布，随后撤回；该发布不包含 Web/X Search。
- [x] npm Registry 已消耗 `0.1.8`，禁止复用该号码发布内容不同的 Search 制品；Search 版本整体递增为 `0.1.9`。

## `0.1.9` 默认关闭 Web/X Search 开发与发布门禁

- [x] Search 开发最初从已发布 `0.1.7` 树独立开始；`0.1.8` 号码被撤回的 sidebar quota 发布消耗后，候选整体迁移到 `yukiryou/v0.1.9-search`。用户未跟踪文档 `docs/10-release-checklist 2.md` 保持未修改、未暂存。
- [x] ADR-0010 冻结两个默认关闭开关、精确模型 route、request/receipt 同编译、共享工具/JSON 预算、后台 purpose 关闭、零 URL 跟随、citation 与 prompt-injection 风险边界。
- [x] 固定 CLI Chat Proxy 的 Web、X、Web+X 与生产 function → `web_search` 顺序 Web+function 四组脱敏观察完成；X 按四项闭合 custom-tool 名称实现，不把公开候选 `x_search_call` 形状外推到当前 Proxy。
- [x] request/compiler、codec、Adapter、真实 Host Config → LlmRuntime、settingsScope UI 聚焦测试全部通过；默认关闭 wire、未支持 route 零 POST、function membership、Web/X/mixed lifecycle、citation、唯一 ID/连续序列与 replay 抑制均有覆盖。
- [x] `package.json`/lockfile、CHANGELOG、中英文 README、`SECURITY.md`、产品/威胁/测试/发布/状态文档、ADR/证据与折叠英文的双语 `docs/releases/v0.1.9.md` 已同步为精确能力、边界与发布前事实；`docs/releases/v0.1.8.md` 只记录撤回事实，不描述 Search。
- [x] 精确 Node `24.19.0` 全量测试通过：221 项、219 pass、0 fail、2 项 Windows-only skip；`npm audit --omit=dev` 为 0 漏洞，干净提交的 `npm run pack:check` 为 69 个文件，`git diff --check`、生成 bundle 一致性与秘密模式扫描通过。
- [x] 候选 head `402920fa0f5eb0b543a09a597ada0b2dd9661020` 的 push CI run [33294837923](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33294837923) 与 PR CI run [33294887140](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33294887140)，以及代码 PR [#20](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/20) 合并提交 `89297ad5c30e1edd94936b52fbe89d0331aaddf5` 的 main CI run [33295176360](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33295176360)，均完成 macOS 14 / Windows 2022 全绿。
- [x] 基于同一候选代码的 macOS 隔离 Web Harness profile 验收通过：默认关闭请求无 `tools`；Web-only 为 `web_search`；X-only 为 `x_search`；Mixed 保持 function → `web_search` 且只向 Harness 交付一个 fixture function call。每组均只有受控的 models GET 与 Responses POST，fetch 无 passthrough，且没有外部 xAI、npm 或 login 请求；这不替代浏览器手工对话、Agent/session loop、OAuth、真实账号、真实 xAI 请求或 Windows 真机验收。
- [x] 代码 PR #20 已合入受保护 `yukiryou/main`，merge commit 为 `89297ad5c30e1edd94936b52fbe89d0331aaddf5`。
- [x] 发布证据 PR [#21](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/21) 合并后的最终 release commit 为 `a0af7b74882546dc3d9477b8f6c1494935e6bfb4`，其 CI run [33295408650](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33295408650) 全绿。从该 commit 唯一生成的 `dsh-grok-provider-0.1.9.tgz` 含 69 个文件、190,049 bytes，unpacked size 为 603,475 bytes，SHA-256 为 `78c73c95ea71d66cad6e6146fed41c281f1c8b29f60353e3f20247ec23833210`，SRI 为 `sha512-GeXQg3qedCGZz9D5MMaHd8Afe5Bn0nxjG+PQmKOB2AxB3m6IiGA07PMD77dEAOJVbAzKk0SnxAOKTZMTQFtuYg==`；预验收 tarball 未冒充或替代最终制品。
- [x] 仓库所有者在完整提交与唯一制品证据后明确授权发布精确 `dsh-grok-provider@0.1.9`；任何既有 `0.1.8` 授权均未复用。
- [x] 不可变 `v0.1.9`、唯一 GitHub Release asset 与 Trusted Publisher run [33295761336](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33295761336) 已完成；npm `latest=0.1.9`，Registry、Release 与本地 tarball 逐字节一致。精确 Registry 安装的 Host/client import/export smoke 通过；精确安装审计图汇总 71 个已验证签名与 3 个 attestations，本包 attestations endpoint 返回 2 项，SLSA provenance 精确绑定 tag、workflow、release commit 与 release run。
- [x] 发布后真实页面验证发现功能验收缺口：Host 未注册 `llm-grok`，两个 Search 开关失败关闭为 `unavailable`。该缺陷不覆盖或重发 `0.1.9`，使用递增稳定版 `0.1.10` 修复。

## `0.1.10` Search settings 集成修复门禁

- [x] 从 `origin/yukiryou/main@a0af7b74882546dc3d9477b8f6c1494935e6bfb4` 创建隔离分支 `yukiryou/v0.1.10-search-settings-fix`；原工作树两个未跟踪文件保持未修改。
- [x] 建立快速红测：真实 Host namespace 缺失、设置更新未进入请求、Adapter 两次调用都无 Search tools；当前实现修复后三项转绿。
- [x] 使用 canonical `@deepseek-ai/dsh-settings@0.1.1-rc.2` 注册 `llm-grok`，并在 Adapter 调用开始、首次 await 前冻结策略；compiler/receipt 静态不变量不变。
- [x] 真实 SettingsProvider + LLM Runtime 覆盖安全默认值、`applies:"live"`、组合回退、用户更新、prepared-call 隔离和 namespace 生命周期；client ready/write 与 unavailable fail-closed 测试同时保留。
- [x] 精确 Node `24.19.0` 全量测试通过：224 项、222 pass、0 fail、2 项 Windows-only skip；生产依赖审计为 0 漏洞。收尾后的 dry-run pack 为 70 个文件；生成 bundle 一致、`git diff --check` 通过，秘密模式扫描仅命中显式测试 canary `Bearer fixture-access-token`。最终字节数与摘要等待合并后的 release commit 冻结。
- [x] 从预验收候选 tarball 完成隔离 profile 安装：实际 `settings.describe` 包含可写、`applies:"live"` 的唯一 `llm-grok`；浏览器页面两个开关 enabled 且 unavailable 提示消失。浏览器写入由服务端 revision 递增确认并恢复默认关闭；延迟目录与 Host/Adapter fixture 回归分别证明旧调用保持快照、后续请求工具随设置变化。该验收未访问真实 xAI。
- [ ] macOS 14 / Windows 2022 CI、代码 PR 与 main CI 全绿。
- [ ] 版本分支合并后，从最终 release commit 唯一生成 `dsh-grok-provider-0.1.10.tgz`，记录文件数、大小、SHA-256 与 SRI；预验收 tarball 不得进入 Release。
- [ ] 完整提交和唯一制品证据形成后，另行取得精确 `dsh-grok-provider@0.1.10` 发布授权。
- [ ] 不可变 tag、唯一 GitHub Release asset、Trusted Publisher、npm `latest`、Registry 字节、签名与 provenance 回读全部关闭。

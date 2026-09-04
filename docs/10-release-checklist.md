# 发布检查表

本文件是每个 npm 版本的强制发布门禁。准备者必须从版本分支逐项完成并保存证据；未全部关闭前不得合并发布基线、创建最终 tag、发布 GitHub Release 或执行 `npm publish`。发布还需要仓库所有者明确授权，检查表全绿本身不构成发布授权。

`0.1.2-rc.1` 是历史上唯一一次预发行尝试。从稳定 `0.1.2` 起不再发行预发行版本；正式版缺陷通过新的递增稳定版本修复。下列稳定版完整合并门禁适用于所有后续发布。

## 每版发布前

- [ ] 冻结精确稳定版本，并同步 `package.json`、CHANGELOG、中英文 README、release notes 和候选文件名。
- [ ] 中英文 README 已互相链接、内容同步；前言与 Quick Start 使用发布前后均成立的制品措辞，不含旧版安装引导或“尚未发布/源码候选/继续安装旧版”及英文等价文字。
- [ ] `SECURITY.md`、文档首页、实现状态、上游证据和发布计划反映当前事实。
- [ ] GitHub About、Topics、npm repository/homepage/bugs 与 canonical repository 一致。
- [ ] GitHub Private vulnerability reporting 已启用；`yukiryou/main` 禁止强推/删除，并要求 PR 与 macOS/Windows CI。
- [ ] `npm test`、`npm audit --omit=dev`、`npm run pack:check` 和 macOS/Windows CI 全部通过。
- [ ] 从干净 checkout 只生成一个候选 tarball；记录文件数、大小、SHA-256 和 base64 SHA-512。
- [ ] 候选 tarball 内的 name、version、repository、exports、peer、patch、脚本和文件白名单通过审查；直接提取的双语 README 前言/Quick Start 只引导安装该精确版本。
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
- [x] 最终候选 head `1e5e875c6e55616f8d589ed56d4aa5fab643387a` 的 push CI run [33298844135](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33298844135) 与 PR [#23](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/23) CI run [33298846201](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33298846201) 均完成 macOS 14 / Windows 2022 全绿。
- [x] 代码 PR #23 已合入受保护 `yukiryou/main`，merge commit 为 `6c3c5bfff8de4e8bc46074434aad7682b3509db3`；main CI run [33298895342](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33298895342) 的 macOS 14 / Windows 2022 全绿。
- [x] 发布证据 PR #24 合并后的最终 release commit 为 `fe1e5a7d82defb17ab5bcbb0d9979c43cb48c028`；final main CI run `33299116564` 全绿。从该 commit 唯一生成的 `dsh-grok-provider-0.1.10.tgz` 含 70 个文件、197,620 bytes，unpacked size 为 628,836 bytes，SHA-256 为 `f9fe1dea743e86e2799a1073a93a8af91ad5bd389e14f4d2f0528428ada93c62`，SRI 为 `sha512-OnfG4diVqJdzYSwJKERNnaplYFbOvFICZP58E0f2Cdh+t7orlTL1DWokvzEHdJrw6HA+UMoKDZgJ6AMEVv4aUg==`。
- [x] 仓库所有者在完整提交和唯一制品证据形成后明确授权发布精确 `dsh-grok-provider@0.1.10`。
- [x] 不可变 `v0.1.10`、唯一 GitHub Release asset 与 Trusted Publisher run `33299599113` 已完成；npm `latest=0.1.10`，Registry、Release 与本地 tarball 逐字节一致，Registry signature 与 SLSA provenance 已回读。

## `0.1.11` reasoning stream 兼容修复门禁

- [x] 从已发布 `origin/yukiryou/main@fe1e5a7d82defb17ab5bcbb0d9979c43cb48c028` 创建隔离分支 `yukiryou/v0.1.11-reasoning-stream`；范围限制为 Responses reasoning 生命周期兼容，不改变认证、设置、模型 route、Search descriptor、citation、图片或平台边界。
- [x] 113/113 聚焦协议回归覆盖一次已完成 server Search 后的 reasoning ID 空占位复用、普通空 reasoning 项、官方 raw `reasoning_text` 标准生命周期和 raw encrypted replay；无 Search 间隔、未闭合、跨类型、非空、第二次复用、raw/summary 混用、乱序、重复和截断继续失败关闭。
- [x] replay 元数据不保存 raw 明文；后续请求只回传 `encrypted_content` 与 `summary: []`，不会回传或把 raw 明文伪装为 summary，当前流中的 raw delta 仍作为 Harness 可见 reasoning 输出。
- [x] 脱敏真实 `grok-4.6` Web Search probe 经生产 decoder 完成 1 次 POST：68 个事件、34 个 summary delta、0 个 raw delta、decoder accepted、1 个 finish。该结果只验证 summary/Search 续跑路径，不能描述为 raw reasoning 真机证据。
- [x] 发布前 `package.json`、lockfile、CHANGELOG、中英文 README、`SECURITY.md`、产品/威胁/测试/发布/状态文档、ADR/证据与折叠英文的双语 `docs/releases/v0.1.11.md` 均已同步为当时准确的发布前状态；发布后 P0 入口已继续同步为正式发布事实。
- [x] 精确 Node `24.19.0` 全量测试通过：238 项、236 pass、0 fail、2 项 Windows-only skip；`npm audit --omit=dev` 为 0 漏洞，dry-run pack 为 71 个文件；生成 bundle 一致、`git diff --check` 通过，秘密模式扫描只命中既有测试 canary `Bearer fixture-access-token` 及记录该 canary 的历史检查表文本。
- [x] 代码 PR #25 已合入受保护 `yukiryou/main`，merge commit 为 `307ae3ac83526f388c6b4a0d1e1346353bd5f4aa`；main CI run `33302830043` 的 macOS 14 / Windows 2022 均通过。
- [x] 发布证据 PR #26 合入后形成最终 release commit `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`；该提交的 final CI run [`33303080849`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33303080849) 在 macOS 14 / Windows 2022 全绿。
- [x] 从最终 release commit 只生成唯一 `dsh-grok-provider-0.1.11.tgz`：71 个文件、207,022 bytes，unpacked size 656,139 bytes；SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`。Registry 精确版本的隔离安装及 Host/client import/export smoke 通过。
- [x] 完整提交与唯一制品证据形成后，仓库所有者明确授权发布上述精确 `dsh-grok-provider@0.1.11` 制品。
- [x] Annotated tag object `353bcd3717d4440ab20a2b05a5e9d51eef22fa7f` peel 到 release commit；不可变 `v0.1.11`、唯一 GitHub Release asset 与 Trusted Publisher run [`33303631312`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33303631312) 已完成。npm `latest=0.1.11`，Registry、Release 与本地 tarball 逐字节一致；`npm audit signatures` 确认隔离安装图中 9 个包具有已验证 Registry 签名、3 个包具有已验证 attestations，本包公开 npm metadata 包含 1 个 Registry signature、2 个 attestations，SLSA provenance 精确绑定 `release.yml`、`v0.1.11`、release commit 与该 run。
- [ ] 网络可达 Windows 真机的官方 CLI 外部浏览器弹出仍未完成验收；该独立边界不是 `0.1.11` 发布门禁，完成前不得声称已修复或已验证。

## `1.0.3` 认证与长流中断修复门禁

- [x] 从最新 `origin/yukiryou/main` 创建隔离分支 `yukiryou/v1.0.3-auth-recovery`；原工作树的用户文件保持未修改。
- [x] 真实会话故障分为两类：流前 HTTP 401 与已收到内容后的约 318 秒 transport stall；不再把两者都归因于 API Key。
- [x] ADR-0011 冻结边界：流前 401/403 最多一次官方 CLI refresh + 同请求重试；同 revision 并发 single-flight；流开始后永不重放。
- [x] 安全部分保留只接受有界 text/reasoning；工具调用、unknown/status-bearing chunk、畸形协议、abort 与无可见内容继续失败关闭。
- [x] fixture 红绿回归覆盖一次恢复、持续拒绝、并发刷新、流后不重试、transport/clean EOF 保留与工具/status-bearing 失败关闭。
- [x] 连续两分钟没有任何响应字节会中止当前连接；每个字节 chunk 刷新 idle deadline，且不会重放请求。
- [x] 精确 Node `24.19.0` 全量回归：274 tests、272 pass、0 fail、2 platform skips。
- [x] 当前已登录账号的脱敏 `grok-4.6` Low Effort 生产 Adapter 最小请求完成：2 block-start、14 reasoning-delta、2 block-end、1 text-delta、1 usage、1 finish；未保留正文、URL、身份、凭据或原始事件。
- [x] 生产依赖审计为 0 漏洞；当前 dry-run pack 为 77 文件。`git diff --check` 通过，秘密模式扫描只命中显式 fixture token 与记录这些 canary 的历史检查表文本；全量测试内含确定性 build。
- [x] 代码 PR #37 合并为 `9958f487abf8ebd062eecb4368689e4d049b1d35`；main CI run `33377849906` 的 macOS 14 / Windows 2022 均通过。
- [x] 发布证据 PR #38 形成最终 release commit `07ebd35c56348a1b3296bd46d1a69f5b0f430241`；final CI run [`33378215345`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33378215345) 的 macOS 14 / Windows 2022 均通过。从该提交冻结的唯一 tarball 含 77 个文件，为 267,403 bytes packed、829,862 bytes unpacked；SHA-1 `6197c3d30ec1ef5f559371911d612f6236eee2f9`、SHA-256 `7f740c7258ab7eee0c96e1ddae3398b41a25e718cf267e244f8693c3c99aeb0d`、SRI `sha512-kJgN0NKKV7Te3oAgbPnEua/EQCLnj5S0KWAWrhP0ixudJBepplRFARYHCxwxOwbG87bnX07Mz/dxCoBiphWhqQ==`。
- [x] 仓库所有者在看到完整精确 commit、制品、摘要与验证证据后明确授权发布 `dsh-grok-provider@1.0.3`；授权后没有重建或替换制品。
- [x] Annotated tag object `7ec8a8a1086749e7ac1dfb0ef2bd50c821838363` peel 到 release commit；不可变 `v1.0.3`、唯一 GitHub Release asset 与 Trusted Publisher run [`33379149158` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33379149158/attempts/1) 已完成。npm `latest=1.0.3`，冻结制品、Release 与 Registry tarball 逐字节一致；Node `24.19.0` / npm `11.5.1` 锁定 Registry 安装及 0 漏洞生产审计通过，本包 1 个 Registry signature、2 个 attestations，安装图 11 个 signed packages / 2 个 attested packages，以及精确绑定 `release.yml` / `refs/tags/v1.0.3` / release commit / publish run 的 SLSA provenance 均已回读。

## `1.0.4` Harness `0.1.2-rc.1` settings 注册修复门禁

- [x] 从 `origin/yukiryou/main` 创建隔离分支 `cursor/fix-settings-install-section-afa4`；范围限制为 settings 注册 API、Harness `0.1.2-rc.1` peer 与 Web inject 替换。
- [x] 移除 `installSettingsSection` / `settingsNamespace` named import；改用 `ctx.settings.installSection(...)` 与字符串常量 `llm-grok`。
- [x] required/optional peer 对齐 `0.1.2-rc.1`（Cordis `4.0.2`、Schemastery `3.18.2`）；Web inject 用 `@deepseek-ai/dsh-client-ui-renderer` 取代已删除的 `dsh-client-runtime`。
- [x] 新增 Host import 回归：真实 `@deepseek-ai/dsh-settings@0.1.2-rc.1` 不再导出已删除 helper，且 `llm-grok` 仍可注册/卸载。
- [x] 发行契约扫描全部 `dist/**`，禁止打包产物再引用已删除 helper。
- [x] 精确 Node `24.19.0` 全量测试、生产依赖审计与 `pack:check`。
- [x] 代码 PR #41 合并为 `61c80fff0841e44c16dabb2cc803a80c1bdf5456`；main CI run [`33870741679`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33870741679) 的 macOS 14 / Windows 2022 均通过。
- [x] 原发布证据 PR #42 的源分支按全局规范从 `cursor/v1.0.4-release-evidence-afa4` 重命名为 `yukiryou/v1.0.4-release-evidence`；GitHub 自动关闭原 PR 后，同一 head `26cc9a17ace288736ae5ab65386358376bef6b1c` 由替代 PR #43 合入，形成最终 release commit `62df21df08053d293ebb59c6e67597402c2305af`。main CI run [`33873037630`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33873037630) 的 macOS 14 / Windows 2022 均通过。
- [x] 从最终提交冻结唯一 `dsh-grok-provider-1.0.4.tgz`：78 files、274,332 bytes packed、850,183 bytes unpacked；SHA-1 `000380a4699d4e61d96942bcae5f6a0ce7c76477`、SHA-256 `464045290b06ce71b78285571c6968e6268fa403fa2350834d2dc479e88fd001`、SRI `sha512-axCBVXQ9BI9boYrlIsa+TWURMo8tQ5GdHpcQVfXUz2OLg+5rbg3XUZSv3ZRQVYQNmyXSQ+frIBDMsbZUGaXJ6w==`。Node `24.19.0` / npm `11.5.1` 测试为 275 tests、273 pass、0 fail、2 platform skips，生产审计 0 漏洞，隔离安装及 Host export smoke 通过。
- [x] 仓库所有者看到最终提交、文件数、字节数与摘要后明确授权唯一 `dsh-grok-provider@1.0.4` 制品。授权后发现 Cursor Agent 曾在 npm 发布前预建指向代码提交的同名 tag/Release；Registry 仍为 `notarget` 且没有发布 run。经所有者批准，旧 asset 备份并核对后替换；授权制品未重建。
- [x] Annotated tag object `dfb269fa9ebb3df3282a151d163043f983bc0619` peel 到最终 release commit；唯一 GitHub Release asset 与 Trusted Publisher run [`33873873314` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33873873314/attempts/1) 已完成。npm `latest=1.0.4`，冻结制品、Release 与 Registry tarball 逐字节一致；本包 1 个 Registry signature、2 个 attestations，`npm audit signatures` 验证安装图 15 个 signed packages / 2 个 attested packages，SLSA provenance 精确绑定 `release.yml` / `refs/tags/v1.0.4` / final release commit / publish run。
- [ ] 网络可达 Windows 真机的官方 CLI 外部浏览器弹出仍未完成验收；该独立边界不是本 settings 注册修复的发布门禁，完成前不得声称已验证。

## `1.0.0` Search 响应协议修复发布门禁

- [x] 新稳定版 `1.0.0` 已发布；不得覆盖或重发已发布 `0.1.11`，npm Registry 回读为 `latest=1.0.0`。
- [x] 根因范围冻结：一个完成的 Web/X server Search 后，同一 reasoning ID 可能继续出现为多个空占位 lifecycle；完成态 Web Search 可能返回精确 `open_page` action。范围不包含新认证方式、endpoint、模型、内容类型、图片生成或本地 URL 访问。
- [x] 安全契约冻结：首次复用前原 reasoning 必须闭合并有完成 Search；之后每次复用都必须 visible summary/content 与 summary/raw lifecycle 为空，并有独立 `response.output_item.done`。有界 opaque `encrypted_content` 允许存在；`response.incomplete` 不能吞掉 open 复用段，但复用段全部闭合后的 max-token 终态有效；非空、跨类型、未知 terminal 或 accessor-backed Search item/response container 字段继续失败关闭。
- [x] `open_page` 契约冻结：只接受完成态精确 `type + url`，streamed/final action type 与 URL 必须一致；校验后丢弃 URL，不访问、不预览、不下载、不 replay，也不投影为 Harness 本地工具。
- [x] 最终源码的脱敏真实账号验证完成且只保留计数/终态：原始 Web/X 协议各完成 1 次、各 64 events，并观察到对应 Search；生产 adapter 共完成 5 次 Responses，direct Web/X 均为 `stop`，Harness 形状的本地 `x_search` call/result 续跑三轮依次为 `tool-calls`、`tool-calls`、`stop`，前两轮各 1 次本地调用。该续跑没有在同一 wire request 中共置 Harness `x_search` function definition 与 xAI `{ type: "x_search" }` server descriptor；此冲突由 `1.0.1` 后续 A/B 确认。未记录结果、URL、prompt、身份或凭据。
- [x] `package.json` 与 lockfile 已更新到精确 `1.0.0`；发行物契约、中英文 README、CHANGELOG、安全策略、设计/状态/测试/发布文档和 `docs/releases/v1.0.0.md` 对同一发布事实保持一致。
- [x] 聚焦 codec 40/40 与完整 Node `24.19.0` 测试通过：共 245 项、243 pass、0 fail、2 项平台跳过；覆盖多次严格空复用、Web/X Search-backed 首次复用、opaque encrypted content、每次 `output_item.done`、open reuse + incomplete 拒绝、closed reuse + max-token 接受、非空/跨类型/terminal/accessor 拒绝，以及 `open_page` streamed/final 一致与边界错误。
- [x] `npm audit --omit=dev` 为 0 漏洞；确定性 build 与生成 bundle 一致，`npm run pack:check` 为 72 项，秘密模式扫描和 `git diff --check` 通过。
- [x] 代码 PR #28 已合入受保护 `yukiryou/main`，merge commit 为 `7a6364dd58f3c7e9e1ad68a3d0197a14254bcb8c`；main CI run [`33308371009`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33308371009) 的 macOS 14 / Windows 2022 均通过。该 CI 不代表网络可达真机浏览器弹出验收。
- [x] 发布证据 PR #29 合入形成最终 release commit `c6548199582b122f1d285422eabea0205eaf602f`；final CI run [`33308603394`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33308603394) 的 macOS 14 / Windows 2022 均通过。
- [x] 从最终 release commit 冻结唯一 `dsh-grok-provider-1.0.0.tgz`：72 files、226,704 bytes packed、715,014 bytes unpacked；SHA-1 `50e5d898dba241d1e19def7705db216e3060b892`、SHA-256 `30cd83dad77f7d2611126b3c4737c8fabffeae79f385fa623e61dcecfe39f5e2`、npm SRI `sha512-WL2f6Kfg5yT5nNf1p4//mLSajCnZttL/pDR3BISrFgSGtZd9DEJlnibq08ETz503n1wHIdCBcU/ICMPG9K4vOw==`；Node 24 隔离安装的 Host `name`/`apply` 与 client `id` smoke 通过。
- [x] 仓库所有者已明确授权上述精确 `dsh-grok-provider@1.0.0` 制品。
- [x] Annotated tag object `192561cda1ac58cbc4077f0de8fa614dff9a5557` peel 到 release commit；不可变 `v1.0.0`、唯一 GitHub Release asset 与 Trusted Publisher run [`33309083806` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33309083806/attempts/1) 已完成。npm `latest=1.0.0`，冻结候选、Release 与 Registry tarball 逐字节一致；本包 1 个 Registry signature、2 个 attestations，安装图 11 个 signed packages、2 个 attested packages，以及精确绑定 tag/workflow/commit/run 的 SLSA provenance 均已回读。
- [ ] 网络可达 Windows 真机的官方 CLI 外部浏览器弹出仍需独立验收；它不是此 Search codec 修复的发布门禁，但完成前不得声称 Windows 登录已修复或验证。

## `1.0.1` 同名 Search 工具冲突修复发布门禁

- [x] 从当时的 `origin/yukiryou/main@6611eec5e16d879da8caecc2bdb7df048b4abf58` 创建隔离分支 `yukiryou/v1.0.1-search-tool-collision`；已发布 `1.0.0` 的 release commit 仍为 `c6548199582b122f1d285422eabea0205eaf602f`，原工作树保持未修改。
- [x] 真实根因通过单变量 A/B 闭合：40 个 Harness functions 含 `web_search` / `x_search`，与同名 server Search descriptors 共存时 fixed Proxy 返回 HTTP 400；只过滤两个同名 wire definitions、保留其余 38 functions + 2 server tools 后请求完成。
- [x] request compiler 先完整验证全部 source functions，再只过滤与已启用 server Search 精确同名的 wire definitions；关闭对应开关或后台 `purpose` 时保留本地 function，历史 `function_call` / `function_call_output` 不删除、不改名。
- [x] request/decoder receipt 双侧拒绝 function/server-tool 名称交集；最终 128 项工具预算按过滤后的 wire functions 与 server tools 共同计算。
- [x] SSE source transport error 原样上抛；adapter 表驱动回归锁定 HTTP 400 → `PROVIDER_ERROR`、401/403 → `AUTH`、429 → `RATE_LIMIT`、`AbortError` → `ABORTED`。framing、JSON 和协议错误仍归类为 `INVALID_RESPONSE`，失败后不自动降级或重放 POST。
- [x] 精确 Node `24.19.0` 本地全量门禁通过：253 tests、251 pass、0 fail、2 platform skips；包含确定性 build、三项 smoke syntax 与全部协议/集成/发行契约测试。
- [x] `npm audit --omit=dev` 为 0 漏洞；使用隔离 npm cache 完成 73 文件 dry-run pack。秘密模式扫描只命中显式测试 canary `Bearer fixture-access-token` 及记录该 canary 的本检查表文本。dry-run 清单不是冻结制品，其大小与摘要不得作为发布值。
- [x] 一次经明确授权的真实账号最终验证只执行 1 次 models GET 与 1 次 Responses POST：8 messages、40 source functions 编译为 38 wire functions + 2 server tools，保留 2 个历史 reserved-name calls，314 events 后 `response.completed`；未保存正文、URL、身份、凭据或原始响应。
- [x] 发布前 manifest/lock、发行契约、中英文 README、CHANGELOG、SECURITY、ADR、测试/状态/证据/路线图与候选 Release Notes 已同步为未发布 `1.0.1` 源码候选；发布后文档与发行契约已另行同步为正式发布状态。
- [x] 代码分支 head `125c3630908bddd625104949c0c887c9d8d265c9` 已推送；push run [`33312524048`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33312524048) 与 PR run [`33312541746`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33312541746) 双平台全绿。代码 PR [#31](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/31) 已合入受保护 `yukiryou/main`，merge commit `0c60200e12c3b8455331f31a317ece9b1945c458` 的 main CI run [`33312621786`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33312621786) 也在 macOS 14 / Windows 2022 全绿。
- [x] 发布证据 PR #32 形成最终 release commit `3c25a53571531e35ac888df16df4fe6c01849e85`；final CI run [`33312946205`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33312946205) 双平台全绿。唯一候选 tarball 含 73 个文件，为 240,904 bytes packed、748,888 bytes unpacked；SHA-1 `9e6449160947104e8dbb71b7201c53e81b073f83`、SHA-256 `e3e15646d38de23c32c71ed759f9c10be9b2d790d4b10b4b8dfe59a44fbfef9f`、SRI `sha512-Bm1qjJQ9i7CWT0oWah7QKDVBP8dR2YQtvEEZGE/BOSwZCo8sZbrW2v2QSfUfLsOLHcQXFZZ0jlDCAztr1m/q+A==`，Node 24 隔离安装已通过。
- [x] 仓库所有者在看到完整 commit、制品、摘要与验证证据后，明确授权发布精确 `dsh-grok-provider@1.0.1`；没有重建或替换授权制品。
- [x] Annotated tag object `ab79b1bb1e408a0112166cadc26761a327819c3f` peel 到 release commit；不可变 `v1.0.1`、唯一 GitHub Release asset 与 Trusted Publisher run [`33313699790` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33313699790/attempts/1) 已完成。npm `latest=1.0.1`，冻结候选、Release 与 Registry tarball 逐字节一致；本包 1 个 Registry signature、2 个 attestations，安装图 11 个 signed packages、2 个 attested packages，以及精确绑定 `release.yml` / `refs/tags/v1.0.1` / release commit / publish run 的 SLSA provenance 均已回读。
- [x] 发布后发现精确 `1.0.1` tarball 内 README 仍为候选态文案；npm 已发布版本不可覆盖。`1.0.2` 的 publish workflow 已对实际 tarball 内双语 README 与精确安装命令完成断言，Registry 回读确认 npm 页面已由新制品纠正。
- [ ] 网络可达 Windows 真机的官方 CLI 外部浏览器弹出仍需独立验收；不得从本修复、CI 或发布推断 Windows 登录已验证。

## `1.0.2` 空 reasoning 投影修复发布门禁

- [x] 修复范围冻结为可见投影及对齐槽：普通空 reasoning 保留既有校验，Search-backed 同 ID 复用保留精确 own-data/accessor 校验；严格空项产生零 block，首个非空 summary/raw delta 才按 output index 开始 block；隐藏普通空项不占 replay 槽，旧会话不回写。
- [x] 冻结 tarball 内的中英文 README 使用耐久 `1.0.2` 制品措辞和精确 `dsh-grok-provider@1.0.2` 安装命令；其中的 Release Notes 在授权发布前未预写 CI、摘要、Registry 或供应链事实。
- [x] 真实账号 Web/X 各 1 次 `grok-4.6` High Effort 验收通过：实际 Search lifecycle 分别为 5/3，每次均为 1 个非空 reasoning、0 个空 reasoning、1 个非空 text 和 1 个 finish；只输出计数，不保存正文、URL、身份、凭据或原始响应。
- [x] manifest/lock 与发行契约同步为精确 `1.0.2`；Node `24.19.0` build 后源码与生成 bundle 由完整测试共同加载验证。
- [x] codec 聚焦回归 52/52、release artifact 聚焦回归 1/1 通过；覆盖普通空项、多段 Search-backed 空复用、opaque encrypted content、summary/raw 首 delta、十空一非空、多个非空块、多未决项保序、后块先完成、延迟 text/tool-call 顺序、pending 条目数与 UTF-8 总预算分别超限、incomplete 先释放屏障、incomplete 交错及全部失败关闭负例。
- [x] release workflow 契约从下载的唯一 tarball 直接读取双语 README 前言与 Quick Start，确认精确版本和唯一安装命令并拒绝旧版/候选态引导；聚焦测试锁定该契约，Trusted Publisher run `33319150964` attempt 1 已对精确发布 asset 执行该门禁。
- [x] 精确 Node `24.19.0` 全量测试共 265 项、263 pass、0 fail、2 项平台跳过；`npm audit --omit=dev` 为 0 漏洞，隔离 npm cache 的 dry-run pack 为 74 文件，`git diff --check` 通过。dry-run 大小与摘要不是冻结制品值。
- [x] 对 dry-run pack 白名单执行私钥、GitHub/npm token、AWS key 与长 Bearer 模式扫描，零命中。
- [x] 代码分支 head `52359e691dfd1bbdb849362c9d1a461e4e693b83` 已推送；push run [`33318180580`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33318180580) 与 PR run [`33318197083`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33318197083) 双平台全绿。代码 PR [#34](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/34) 已合入受保护 `yukiryou/main`，merge commit `47d688cc47bc9643f3477ee9333cfdf7788045cd` 的 main CI run [`33318245251`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33318245251) 也在 macOS 14 / Windows 2022 全绿。
- [x] 发布证据 PR #35 形成 final release commit `be200f9352afe93b27dd2856d89c01674f0cd637`；其 macOS 14 / Windows 2022 final CI run [`33318426571`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33318426571) 双平台全绿。
- [x] 从 final release commit 冻结唯一 74 文件 tarball：255,282 bytes packed、789,962 bytes unpacked；SHA-1 `3feddb7048fe4c796037804518999b12ae491802`、SHA-256 `010a21770cb3e4e42b7195984df1f5bf8dc5027066198cf99b7d713ac045f605`、SRI `sha512-TcvvPUXBJZEA728pVnUrXSZebGfIoB5ATG5041wA1OFzOE+hFTO98C5Fxl99WuFW2y7V89gkusYIKCpGlLNQIg==`；Node `24.19.0` 隔离安装的 Host `name`/`apply` 与 client `id`/factory smoke 通过。
- [x] 仓库所有者看到完整精确 commit、制品、摘要与验证证据后明确授权发布 `dsh-grok-provider@1.0.2`；授权后没有重建或替换制品。
- [x] Annotated tag object `b7efd3aabb99c73e1747d2d87890cdf9b284c438` peel 到 release commit；不可变 `v1.0.2`、唯一 GitHub Release asset 与 Trusted Publisher run [`33319150964` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33319150964/attempts/1) 已完成。npm `latest=1.0.2`，冻结候选、Release 与 Registry tarball 逐字节一致；Node `24.19.0` / npm `11.5.1` 锁定 Registry 安装及 0 漏洞生产审计通过，本包 1 个 Registry signature、2 个 attestations，安装图 11 个 signed packages / 2 个 attested packages，以及精确绑定 `release.yml` / `refs/tags/v1.0.2` / release commit / publish run 的 SLSA provenance 均已回读。
- [ ] 网络可达 Windows 真机浏览器弹出仍是独立未验收边界，不阻断本显示修复，但不得写成已验证。

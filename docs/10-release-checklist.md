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

仍需跟进但不回溯阻断 `0.1.0`：Windows x64 首次 Registry 真机验收；公共 curated 目录的仓库年龄门槛满足后提交收录。

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

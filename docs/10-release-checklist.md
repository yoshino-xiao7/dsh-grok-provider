# 发布检查表

本文件是每个 npm 版本的强制发布门禁。准备者必须从版本分支逐项完成并保存证据；未全部关闭前不得合并发布基线、创建最终 tag、发布 GitHub Release 或执行 `npm publish`。发布还需要仓库所有者明确授权，检查表全绿本身不构成发布授权。

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

## `0.1.1` 当前候选

- [x] 使用独立版本分支 `yukiryou/v0.1.1`。
- [x] 长期发布 workflow 改为 GitHub OIDC，不读取 npm Secret。
- [x] macOS/Windows CI 已通过 OIDC workflow 改造分支。
- [x] GitHub Private vulnerability reporting 已启用，`yukiryou/main` 已配置 PR、双平台 CI、防强推和防删除保护。
- [x] 完成所有发布事实文档、中英文 README 与 `SECURITY.md` 同步。
- [x] `package.json`、lockfile 与制品契约测试已同步为 `0.1.1`，中英双语 release notes 已完成且不重复页面标题。
- [x] 本地完整测试 57 项通过（55 pass、2 项 Windows-only 按预期跳过），`npm audit --omit=dev` 为 0 vulnerability，GitHub macOS/Windows CI 均通过。
- [x] 从提交 `d35bda3402db5b16edd83d81420f1068006254a8` 生成预审 tarball；48 个文件、93,652 bytes，SHA-256 `bdaf7c32a22afd74e1c526e07c91f441942fedab3e0d34c01134fedda6e323b9`，SRI `sha512-ENpeVSsHDiByG6Cf03pl1j4eRHAsYQkrwU4sVAMct4D2aFXoZoFTivP0ZpwaM1tzD0NdXlPzlLdtlSd0F48wCw==`；同一文件在全新临时目录完成 peer 安装、manifest 回读与 Host 模块加载。
- [ ] 获得发布授权后，把 README/状态页切换为最终公开 `0.1.1` 事实、写入 CHANGELOG 日期并生成最终唯一候选；预审 tarball 不进入 Release。
- [ ] 完成发布前全套门禁并取得仓库所有者明确发布授权。

English summary: every release must close documentation, security, tests, deterministic artifact, bilingual release notes, OIDC identity, integrity, and post-publish readback gates before publication. A green checklist never replaces explicit owner approval.

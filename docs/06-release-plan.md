# npm `0.1.0` 发布计划

## 1. 精确发布身份

已冻结：

```text
dsh-grok-provider@0.1.0
```

不采用 `dsh-llm-grok-yukiryou`，避免被理解为第三方包的修补或衍生版本。

2026-08-25 的只读 Registry 查询显示该名称未公开发布；本机 `npm whoami` 返回 `ENEEDAUTH`。真正发布前必须重新检查名称和登录身份，任何 token 都不能出现在聊天或日志中。

## 2. 为什么是 `0.1.0`

- 这是原创实现的首版，不继承第三方版本历史。
- Harness 基线仍是 `0.1.1-rc.2`，上游接口和 Grok Proxy 契约都可能变化。
- YukiRyou 受管市场要求根包为纯 `x.y.z`；`0.1.0` 合法，prerelease 不合法。
- npm 的同一 name/version 一旦发布不可覆盖；所有门禁必须在发布前完成。

## 3. 包结构

预计 tarball 白名单：

```text
dist/host/*
dist/client/*
docs/**/*
types/*
grok-provider.patch.yml
package.json
README.md
LICENSE
CHANGELOG.md
```

不打包：

- `src/`、`tests/`、coverage、fixtures、日志和本机配置。
- `node_modules`。
- auth.json、token、真实 prompt/响应和用户路径。
- symlink、hardlink、socket 或设备文件。

`docs/` 与根 `README.md` 一起进入 tarball，使安装后的架构、安全边界和发布门禁链接保持可读。发布前的证据文档只记录脱敏事实、hash 与固定公开地址，不得包含 token、真实 prompt/响应或用户身份数据。

目标为零普通 runtime dependencies。DSH peer 精确使用 `0.1.1-rc.2`；Cordis `4.0.1`、Schemastery `3.18.1` 由目标桌面 Runtime snapshot 满足。`@deepseek-ai/dsh-subprocess`、settings、commands、connection 和 client UI/locale 等 profile-specific peer 通过 `peerDependenciesMeta.optional: true` 标注，并有 Web/TUI/headless 缺失-peer 测试。插件不打包本地 subprocess 实现。

`package.json` 同时固定公开 Registry：

```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

纯 JavaScript 包不设置 npm `os`/`cpu` 字段：npm 这两个列表形成笛卡尔式允许集，不能精确表达“仅 darwin-arm64 与 win32-x64”两个 tuple。实际发布支持矩阵由 Harness/Marketplace 的平台验证字段和运行时 capability check 约束。

## 4. DSH bundle 元数据

`package.json` 必须包含实际存在的 patch：

```json
{
  "dsh": {
    "bundle": {
      "patch": "grok-provider.patch.yml"
    }
  }
}
```

patch 路径必须为不含 `..`、绝对路径、反斜线或 NUL 的相对 `.yml`/`.yaml` 路径，长度不超过 240 字节。

`package.json.repository.url` 必须与执行 provenance 发布 workflow 的公开 GitHub repository 精确匹配（包括 owner/repo 大小写），再与市场 catalog 的 canonical repository 精确匹配。创建 GitHub 仓库及确定 URL 是发布前独立门禁，不能先填占位值。

## 5. 受管市场约束

- 根包为精确稳定版本 `0.1.0`，name/version 与目录一致。
- 不得 deprecated。
- root 与完整 `dependencies`/`optionalDependencies` 图无 `preinstall`、`install`、`postinstall`。
- 每个依赖节点来自 `https://registry.npmjs.org` 并有 SHA-512 integrity。
- 图预算：256 nodes、深度 16、1024 edges。
- 单 tarball ≤32 MiB；全图压缩≤128 MiB；解压≤512 MiB；文件≤20,000。
- 禁止越界路径、大小写冲突、`node_modules`、symlink 和 hardlink。
- peer 必须由内置 Runtime 或冻结图唯一满足。

零 runtime dependencies 会显著降低这些供应链和平台风险。

## 6. 构建门禁

从干净 checkout：

1. 安装锁定的开发依赖。
2. lint、typecheck、unit、integration 和平台测试。
3. 构建 Host ESM/CJS 产物、类型声明和 lazy-CJS client。
4. `npm pack --dry-run --json` 审查清单。
5. 生成唯一候选 tarball并记录 SHA-512。
6. 解包审查 identity、exports、peer、scripts、patch 和文件类型。
7. 从该 tarball 在临时 Harness profile 安装并执行 Web/TUI smoke。
8. 同一个 tarball 在 macOS 与 Windows 运行本地、同字节的 verifier-equivalent 检查与安装 smoke；生产受管 inspector 依赖已发布的 npm manifest/tarball，只能在发布后得到 `artifact-verified`。

候选 tarball 只构建一次，并记录 npm SRI `sha512-<base64>`。macOS、Windows 和 publish job 都必须先验证同一 digest；测试 job 和 publish job不得重新构建或重新 `npm pack`。

禁止为不同平台重新打两个内容不同但版本相同的 tarball。

## 7. Git 与版本

- 开发分支：`yukiryou/v0.1.0`。
- `package.json`、CHANGELOG、release notes、Git tag 和 tarball 必须都是 `0.1.0`。
- 发布提交必须干净且可复现。
- tag：`v0.1.0`，只在发布提交确定后创建。
- 受当前全局分支命名策略约束，发布基线使用 `yukiryou/main`；不创建无前缀 `main`，也不直接在发布基线开发或发布未验收内容。
- 首次仓库当前没有发布基线；验收完成后才创建/保护 `yukiryou/main`。该分支必须 fast-forward 到生成并测试候选 tarball 的同一 release commit，不得在 pack 后再 merge、squash、rebase 或修改文件；`yukiryou/main`、`v0.1.0` 和候选 manifest 记录的 source commit 必须是同一 Git OID。publish job 核对 `GITHUB_SHA` 与候选 SHA-512 后直接发布，禁止重新构建或重新 pack。

## 8. 发布方式

优先从公开 GitHub 仓库的 GitHub-hosted runner 使用 npm provenance 发布。

首次包无法预先配置 staged publishing；需要一次最小权限的首次发布凭据，发布完成后立刻配置 npm Trusted Publisher 并撤销首次凭据。按 2026-08-25 的 npm 官方要求，Trusted Publishing 需要 npm ≥`11.5.1`、Node ≥`22.14.0`、GitHub-hosted runner 和 workflow `id-token: write`；正式发布前再次核对。本机 npm `10.9.7` 不作为发布环境。

发布经过测试的同一个 tarball：

```sh
npm publish ./<exact-0.1.0-tarball>.tgz \
  --access public \
  --tag latest \
  --provenance \
  --registry=https://registry.npmjs.org/
```

scoped 包首次公开发布必须保留 `--access public`。

## 9. 发布后回读

回读 `<name>@0.1.0` 并核对：

- name、version、repository。
- `dist.tarball`、`dist.integrity`、unpacked size、file count。
- scripts、dependencies、optionalDependencies、peerDependencies。
- peerDependenciesMeta 与 publishConfig 的 Registry 回读表现。
- engines、os、cpu 和 `dsh.bundle.patch`。
- `dist-tags.latest === "0.1.0"`。

从 Registry 重新下载，计算 SRI 并与 `dist.integrity` 及候选 digest 比较；在临时项目安装精确版本、生成 lockfile 后执行 `npm audit signatures`；核对 provenance attestation 的 GitHub repository 与 release commit，不使用 `latest` 安装。

## 10. Marketplace

npm 发布不会自动成为受管可安装项。发布后还需要：

- DSHFind verified repository backlink；或
- 加入 YukiRyou curated catalog 的精确 `0.1.0`。

优先先通过公开 GitHub repository backlink 形成 DSHFind candidate，避免“尚无 candidate 因而无法受管安装、尚未受管安装因而不能进 curated”的循环。Registry 回读完成后，再在 macOS 与 Windows 的生产 inspector 上验证 `artifact-verified`、安装、重启、浏览器登录、聊天、工具调用和重新认证。

curated 条目只在上述验证通过后添加。当前 catalog schema 只记录：

- UTC `testedAt`。
- Harness `0.1.1-rc.2`。
- `darwin-arm64` 和 `win32-x64`。

macOS x64 不在当前官方 Grok CLI 支持矩阵，不进入 `0.1.0` catalog 或发布承诺。npm SHA-512 作为 release evidence 保存；它不是当前 curated schema 字段，市场会从 Registry `dist.integrity` 自行验证 SHA-512。

发布证据还必须固定精确 Grok CLI 版本、官方 tag/commit、可用的 `SOURCE_REV`，以及同版本 auth flow、auth schema、支持平台和 Proxy 文档永久链接；不得只引用 mutable `main`。

## 11. 失败与回滚

- 发布前失败：修复后重建新 tarball，旧候选不发布。
- 发布后发现问题：不能覆盖 `0.1.0`；从 catalog 撤下并发布递增版本，例如 `0.1.1`。
- 对已知有问题的版本执行 `npm deprecate` 并在公告中说明；撤下 catalog 不会删除用户已安装或缓存的 `0.1.0`。
- 不依赖 unpublish 复用版本号。
- 凭据或 token 泄漏时立即停止分发、撤销相关凭据、发布安全公告并轮换发布权限。

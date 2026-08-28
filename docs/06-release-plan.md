# npm 发布计划与维护流程

## 0. 当前状态

当前 npm `latest` 为 `dsh-grok-provider@0.1.5`；其 release commit 为 `4f0bcd84f96c1cd5d95dda2a01ce63ff6403b828`，不可变 tag 为 `v0.1.5`。唯一 tarball、GitHub Release asset 与 Registry 下载文件逐字节一致，Registry 签名、npm publish attestation 与 SLSA provenance 已回读；Trusted Publisher run `33162280108` 的 provenance 精确绑定上述 tag、仓库、workflow 与 commit。`0.1.5` 只补强发布身份绑定、账户面板能力标签和 Provider Runtime 安装事务，不新增搜索、生图、认证或 endpoint 能力。

首个 `dsh-grok-provider@0.1.0` 于 2026-08-26 从 GitHub Release 中唯一的候选 tarball 发布到 npm；Registry 回读的 SHA-512、重新下载文件的 SHA-256 和 GitHub Release 产物完全一致，并生成 npm provenance attestation。后续稳定版沿用由该流程建立的不可变制品与回读原则。

首次发布使用的临时 GitHub Environment secret 已删除。npm 包现已绑定以下 Trusted Publisher：

```text
Provider: GitHub Actions
Repository: yoshino-xiao7/dsh-grok-provider
Workflow filename: release.yml
Environment: npm
Allowed action: npm publish
```

包的 publishing access 使用“Require two-factor authentication and disallow bypass 2fa tokens”。后续发布不得恢复 write token、`NPM_TOKEN`、仓库级 `.npmrc` 凭据或 `NODE_AUTH_TOKEN`；`release.yml` 必须通过 GitHub OIDC 获取单次、短时发布身份。

## 1. 精确发布身份

已冻结：

```text
dsh-grok-provider@0.1.0
```

不采用 `dsh-llm-grok-yukiryou`，避免被理解为第三方包的修补或衍生版本。

`0.1.0` 已由 npm 账户 `yukiryou` 发布，canonical source repository 为 `yoshino-xiao7/dsh-grok-provider`。发布账户与 GitHub owner 不要求同名；Registry repository 回链、GitHub provenance 和 Trusted Publisher claims 必须保持一致。任何 token 都不能出现在仓库、聊天或日志中。

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
README.en.md
CONTRIBUTING.md
SECURITY.md
LICENSE
CHANGELOG.md
```

不打包：

- `src/`、`tests/`、coverage、fixtures、日志和本机配置。
- `node_modules`。
- auth.json、token、真实 prompt/响应和用户路径。
- symlink、hardlink、socket 或设备文件。

`docs/` 与根目录中相互链接的中文默认页 `README.md`、英文版 `README.en.md`、`CONTRIBUTING.md` 和 `SECURITY.md` 一起进入 tarball，使安装后的架构、安全边界、社区维护方式和发布门禁链接保持可读。发布前的证据文档只记录脱敏事实、hash 与固定公开地址，不得包含 token、真实 prompt/响应或用户身份数据。

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

- 根包必须是与候选 tag 一致的精确稳定版本，name/version 与目录一致。
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
2. 运行仓库实际声明的确定性构建、脚本语法、unit、integration、平台与发行制品契约测试；当前原生 ESM JavaScript 仓库不虚构独立 lint/typecheck 命令，未来新增后必须同步接入 CI。
3. 构建 Host ESM/CJS 产物、类型声明和 lazy-CJS client。
4. `npm pack --dry-run --json` 审查清单。
5. 生成唯一候选 tarball并记录 SHA-512。
6. 解包审查 identity、exports、peer、scripts、patch 和文件类型。
7. 从该 tarball 在临时 Harness profile 安装并执行 Web/TUI smoke。
8. 同一个 tarball 在 macOS arm64 运行 verifier-equivalent 检查与安装 smoke；Windows x64 由 CI 完成自动化检查。首次 Windows 真机安装和 production inspector 在 `0.1.0` 发布后针对 Registry 精确版本执行。

候选 tarball 只构建一次，并记录 npm SRI `sha512-<base64>`。预发布 macOS 验收、Windows CI 和 publish job 都必须先验证同一 digest；测试 job 和 publish job 不得重新构建或重新 `npm pack`。发布后的 Windows 首次真机验证必须下载 Registry 的精确 `0.1.0` 并核对同一 SRI。

禁止为不同平台重新打两个内容不同但版本相同的 tarball。

## 7. Git 与版本

- `0.1.0` 历史开发分支：`yukiryou/v0.1.0`；当前版本分支：`yukiryou/v0.1.5`。
- `package.json`、CHANGELOG、release notes、Git tag 和 tarball 必须使用同一个精确候选版本。
- 发布提交必须干净且可复现。
- tag 使用 `v<major>.<minor>.<patch>`，只在发布提交确定后创建。
- 受当前全局分支命名策略约束，发布基线使用 `yukiryou/main`；不创建无前缀 `main`，也不直接在发布基线开发或发布未验收内容。
- `0.1.0` 首发时，发布基线 `yukiryou/main`、tag `v0.1.0` 和候选 manifest 记录的 source commit 均为 `dfa39d98d12fac929669f4961b0a511bf70cfeac`。发布后的 workflow 或文档修正不会改变这一不可变 tag、候选 tarball 或其 provenance。后续版本仍须让发布基线、tag、候选 manifest 和已验证 tarball 对应同一 release commit；publish job 只发布已核对 SHA-512 的唯一候选，禁止重新构建或重新 pack。

`0.1.0` 发布后，后续版本从已发布基线 `yukiryou/main` 创建 `yukiryou/v<next-version>`。普通开发、文档、测试和发布准备都停留在版本分支；只有仓库所有者明确开始该版本发布时才合并回发布基线并创建不可变 tag。内容类型按 [能力路线图](./11-capability-roadmap.md) 绑定到指定稳定版本；插入缺陷修复版时不得混入未完成的内容切片。

### 7.1 预发行版本政策

`0.1.2-rc.1` 是一次历史预发行尝试。仓库所有者决定从稳定 `0.1.2` 起不再发行新的预发行版本；已发布 RC 保留为不可变历史记录，不覆盖、不删除，也不作为后续开发基线。正式版发现缺陷时直接创建下一递增稳定版本分支并按完整发布门禁修复。

## 8. 发布方式

优先从公开 GitHub 仓库的 GitHub-hosted runner 使用 npm provenance 发布。

首次包无法预先配置 Trusted Publisher，因此 `0.1.0` 使用了一次最小权限的首次发布凭据。发布完成后已配置 npm Trusted Publisher、删除 GitHub Environment secret，并把传统 token 发布设置为最严格模式。按 2026-08-26 的 npm 官方要求，Trusted Publishing 需要 npm ≥`11.5.1`、Node ≥`22.14.0`、GitHub-hosted runner 和 workflow `id-token: write`；每次调整发布工具链前必须重新核对。

CI 使用的官方 GitHub Actions 必须固定到已核对的完整 commit SHA；不得依赖可移动 major tag 作为发布门禁实现。

长期发布工作流只接受严格稳定 tag `v<major>.<minor>.<patch>` 和对应 GitHub Release tarball 的 base64 SHA-512。工作流必须：

1. 从 tag 派生版本和唯一产物名；不接受 prerelease、build metadata、路径字符、自由格式文件名或调用者指定 dist-tag。
2. 强制 workflow 从输入 tag 的 ref 运行，并递归剥离 annotated/lightweight tag，确认最终 commit 精确等于 `github.sha`。
3. 要求对应 GitHub Release 的 tag 精确一致且非草稿、非预发行，只允许唯一 `dsh-grok-provider-<version>.tgz` 附件；下载后再次确认本地只有该文件。
4. 在发布前核对输入 SHA-512，以及 tarball 内的 name、version 和 canonical repository。
5. 使用精确 Node `24.19.0`、固定 npm CLI 版本、GitHub-hosted Ubuntu runner、`environment: npm` 和 `id-token: write`。
6. 把 tarball 作为带 `./` 前缀的本地文件路径交给 `npm publish`，避免 npm package-spec 将其解释为 GitHub shorthand。
7. 不设置 `NODE_AUTH_TOKEN`，不读取任何 npm secret；身份完全来自 Trusted Publisher OIDC。
8. 保留 `--access public`、`--tag latest` 和 `--provenance`，即使 Trusted Publishing 会自动生成 provenance，也明确表达发布策略。

发布经过测试的同一个 tarball：

```sh
npm publish ./<exact-version-tarball>.tgz \
  --access public \
  --tag latest \
  --provenance \
  --registry=https://registry.npmjs.org/
```

scoped 包首次公开发布必须保留 `--access public`。

## 9. 发布后回读

回读 `<name>@<exact-version>` 并核对：

- name、version、repository。
- `dist.tarball`、`dist.integrity`、unpacked size、file count。
- scripts、dependencies、optionalDependencies、peerDependencies。
- peerDependenciesMeta 与 publishConfig 的 Registry 回读表现。
- engines、os、cpu 和 `dsh.bundle.patch`。
- `dist-tags.latest` 等于刚发布的精确版本。

从 Registry 重新下载，计算 SRI 并与 `dist.integrity` 及候选 digest 比较；在临时项目安装精确版本、生成 lockfile 后执行 `npm audit signatures`；核对 provenance attestation 的 GitHub repository 与 release commit，不使用 `latest` 安装代替证据。

## 10. Marketplace

npm 发布不会自动成为受管可安装项。当前发现状态：

- GitHub 仓库已添加 DeepSeek Harness 官方推荐的 `dsh-plugin` 与 `dsh` Topics，可被 Topic 驱动来源发现。
- YukiRyou curated catalog 当前仍是精确 `dsh-grok-provider@0.1.0`、verification `installed`、仅 `darwin-arm64`。`0.1.5` 已发布及其完整性/provenance 回读不等于从 catalog 安装该精确版本，因此不得据此升级条目或增加平台。
- 公共 `awesome-dsh-plugin` 的收录 PR #3415 已合并，项目已进入 `model` 分类。该列表不记录精确 npm 版本或平台验证字段，因此收录只代表发现入口，不证明任一后续制品的受管安装或平台验收。
- Windows x64 仍需对 Registry 精确 `0.1.0` 完成首次 production inspector、安装、重启、浏览器登录、聊天、工具调用和重新认证；完成前保持“代码支持、真机未验证”。

catalog 条目只能记录实际验证完成的精确版本和平台。当前条目记录：

- UTC `testedAt`。
- Harness `0.1.1-rc.2`。
- verification `installed`。
- 仅 `darwin-arm64`。

从 `0.1.1` 起，常规发版不再要求重复 macOS/Windows 真机 smoke。每次仍须通过两平台 CI、协议与安全测试、干净 profile 安装、确定性 tarball 和 Registry integrity/provenance 回读。涉及认证、官方 CLI、Harness subprocess seam、内容输入或平台安全策略的变更应安排定向真机复核；`0.1.4` 因新增图片输入，已完成精确 `grok-4.6` 的 Proxy 红蓝语义门禁和收窄后的 Harness modality 复验，但不能替代最终制品安装与双平台 CI。

macOS x64 不在当前官方 Grok CLI 支持矩阵，不进入 `0.1.0` catalog 或发布承诺。npm SHA-512 作为 release evidence 保存；它不是当前 curated schema 字段，市场会从 Registry `dist.integrity` 自行验证 SHA-512。

发布证据还必须固定精确 Grok CLI 版本、官方 tag/commit、可用的 `SOURCE_REV`，以及同版本 auth flow、auth schema、支持平台和 Proxy 文档永久链接；不得只引用 mutable `main`。

## 11. 失败与回滚

- 发布前失败：修复后重建新 tarball，旧候选不发布。
- 发布后发现问题：不能覆盖 `0.1.0`；从 catalog 撤下并发布递增版本，例如 `0.1.1`。
- 对已知有问题的版本执行 `npm deprecate` 并在公告中说明；撤下 catalog 不会删除用户已安装或缓存的 `0.1.0`。
- 不依赖 unpublish 复用版本号。
- 凭据或 token 泄漏时立即停止分发、撤销相关凭据、发布安全公告并轮换发布权限。

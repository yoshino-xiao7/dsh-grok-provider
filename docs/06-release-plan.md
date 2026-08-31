# npm 发布计划与维护流程

## 0. 当前状态

`dsh-grok-provider@1.0.3` 已正式发布并完成供应链回读：最终 release commit `07ebd35c56348a1b3296bd46d1a69f5b0f430241` 的 macOS 14 / Windows 2022 final CI run [`33378215345`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33378215345) 全绿，annotated tag object `7ec8a8a1086749e7ac1dfb0ef2bd50c821838363` peel 到该提交。仓库所有者明确授权的唯一 77 文件制品为 267,403 bytes packed、829,862 bytes unpacked；SHA-1 `6197c3d30ec1ef5f559371911d612f6236eee2f9`、SHA-256 `7f740c7258ab7eee0c96e1ddae3398b41a25e718cf267e244f8693c3c99aeb0d`、SRI `sha512-kJgN0NKKV7Te3oAgbPnEua/EQCLnj5S0KWAWrhP0ixudJBepplRFARYHCxwxOwbG87bnX07Mz/dxCoBiphWhqQ==`。Trusted Publisher run [`33379149158` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33379149158/attempts/1) 已完成；npm `latest=1.0.3`，冻结制品、唯一 GitHub Release asset 与 Registry tarball 逐字节一致。Node `24.19.0` / npm `11.5.1` 锁定 Registry 安装通过 Host/client smoke，生产依赖审计为 0 漏洞；1 个 Registry signature、2 个 attestations、安装图 11 个 signed packages / 2 个 attested packages，以及精确绑定 `release.yml` / `refs/tags/v1.0.3` / release commit / publish run 的 SLSA provenance 均已验证。

`1.0.3` 修复流前 401/403 的一次官方 CLI 会话刷新与同请求重试，并在流开始后坚持不重放；无工具副作用的有界 text/reasoning 可在 transport interruption、干净过早 EOF 或连续两分钟无 wire bytes 时保留并提示用户发送“继续”。持续认证拒绝、工具调用、未知或畸形协议继续失败关闭。该发布不改变 Windows 浏览器登录边界。

上一稳定版 `1.0.2` 已正式发布并完成供应链回读：最终 release commit `be200f9352afe93b27dd2856d89c01674f0cd637` 的 macOS 14 / Windows 2022 final CI run [`33318426571`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33318426571) 全绿，annotated tag object `b7efd3aabb99c73e1747d2d87890cdf9b284c438` peel 到该提交。仓库所有者明确授权的唯一 74 文件制品为 255,282 bytes packed、789,962 bytes unpacked；SHA-1 `3feddb7048fe4c796037804518999b12ae491802`、SHA-256 `010a21770cb3e4e42b7195984df1f5bf8dc5027066198cf99b7d713ac045f605`、SRI `sha512-TcvvPUXBJZEA728pVnUrXSZebGfIoB5ATG5041wA1OFzOE+hFTO98C5Fxl99WuFW2y7V89gkusYIKCpGlLNQIg==`。Trusted Publisher run [`33319150964` attempt 1](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33319150964/attempts/1) 已完成；冻结候选、唯一 GitHub Release asset 与 Registry tarball 逐字节一致。Node `24.19.0` / npm `11.5.1` 锁定 Registry 安装通过 Host 注册/`apply`/注入与 client 注册/factory/`apply`/注入 smoke，生产依赖审计为 0 漏洞；1 个 Registry signature、2 个 attestations、安装图 11 个 signed packages / 2 个 attested packages，以及精确绑定 `release.yml` / `refs/tags/v1.0.2` / release commit / publish run 的 SLSA provenance 均已验证。

`1.0.2` 只修复严格空 reasoning 被投影为空 `Think` 的显示问题：空 reasoning 仍完整进入 decoder FSM，但仅在首个非空 summary/raw delta 到来时创建 Harness block；严格空生命周期产生零可见 chunk。request、Search、认证、图片、模型、endpoint、工具权限与 Windows 浏览器边界不变。

发布后只读回查发现，精确授权并发布的 `1.0.1` tarball 内 README 仍保留发布前候选态文字，因此 npm 包页面显示历史的 `latest=1.0.0` 与 `@1.0.0` 安装示例。已发布字节不可覆盖。`1.0.2` 已通过两层门禁完成纠正：双语 README 使用发布前后均成立的制品措辞和精确 `@1.0.2` 命令；publish workflow 直接读取并断言唯一 tarball 内的两个 README。Registry 回读确认 npm 页面现由精确 `1.0.2` 制品承载正确引导，而不是依赖不进入 tarball 的 post-release commit。

`1.0.0` 只修复剩余 Search response 形状：已完成 server Search 支撑的 reasoning ID 可以继续出现为多个严格空、逐次闭合的占位 lifecycle；完成态 Web Search 可以返回精确有界的 `open_page` type/URL，且 streamed/final action 必须一致。严格空要求 visible summary/content 与 summary/raw lifecycle 为空，允许有界 opaque `encrypted_content`；每次复用必须到达自己的 `response.output_item.done`，仅当 `response.incomplete` 到来时仍有复用段未闭合才失败关闭，所有复用段闭合后的 `max_output_tokens` 终态仍有效。Provider 校验 `open_page` 后立即丢弃 URL，不访问、不预览、不下载、不 replay；非空、跨类型、未知 terminal 或 accessor-backed 字段继续拒绝。

`1.0.0` 最终源码的真实账号复验已脱敏完成：原始 Web/X 协议各完成 1 次、各 64 events，并观察到对应 Search；生产 adapter 共完成 5 次 Responses，direct Web/X 均为 `stop`，Harness 形状的本地 `x_search` 三轮依次为 `tool-calls`、`tool-calls`、`stop`，前两轮各 1 次本地调用。该三轮证据验证了本地 function call/result 生命周期，但没有隔离或证明最终同一 wire request 中同名 function definition 与 server descriptor 可以共存。`1.0.1` 的精确桌面回放与单变量 A/B 才确认：40 functions + 2 个同名 server tools 被拒绝；只过滤两个同名 wire definitions、保留 38 functions + 2 server tools 后完成。探针不保存结果、URL、prompt、身份或凭据。`1.0.0` 的发布、自动化与供应链证据均已关闭，但不替代 OAuth、完整桌面会话或网络可达 Windows 真机浏览器弹出验收。

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
THIRD_PARTY_NOTICES.md
CHANGELOG.md
```

不打包：

- `src/`、`tests/`、coverage、fixtures、日志和本机配置。
- `node_modules`。
- auth.json、token、真实 prompt/响应和用户路径。
- symlink、hardlink、socket 或设备文件。

`docs/` 与根目录中相互链接的中文默认页 `README.md`、英文版 `README.en.md`、`CONTRIBUTING.md`、`SECURITY.md` 和 `THIRD_PARTY_NOTICES.md` 一起进入 tarball，使安装后的架构、安全边界、第三方许可、社区维护方式和发布门禁链接保持可读。发布前的证据文档只记录脱敏事实、hash 与固定公开地址，不得包含 token、真实 prompt/响应或用户身份数据。

目标为零普通 runtime dependencies。DSH peer 精确使用 `0.1.1-rc.2`；Cordis `4.0.1`、Schemastery `3.18.1` 由目标桌面 Runtime snapshot 满足。`@deepseek-ai/dsh-settings` 是 Host Search 设置链路的直接、非 optional peer；`@deepseek-ai/dsh-subprocess`、commands、connection 和 client UI/locale 等 profile-specific peer 保持 optional，并有 Web/TUI/headless 缺失-peer测试。插件不打包 settings provider 或本地 subprocess 实现。

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
6. 解包审查 identity、exports、peer、scripts、patch、文件类型及双语 README；前言/Quick Start 必须对应精确制品版本，且只能引导安装该版本。
7. 从该 tarball 在临时 Harness profile 安装并执行 Web/TUI smoke。
8. 同一个 tarball 在 macOS arm64 运行 verifier-equivalent 检查与安装 smoke；Windows x64 由 CI 完成自动化检查。首次 Windows 真机安装和 production inspector 在 `0.1.0` 发布后针对 Registry 精确版本执行。

候选 tarball 只构建一次，并记录 npm SRI `sha512-<base64>`。预发布 macOS 验收、Windows CI 和 publish job 都必须先验证同一 digest；测试 job 和 publish job 不得重新构建或重新 `npm pack`。发布后的 Windows 首次真机验证必须下载 Registry 的精确 `0.1.0` 并核对同一 SRI。

publish job 在校验 digest 与 manifest 的同一步直接从唯一 tarball 提取 `package/README.md` 和 `package/README.en.md`。只检查前言与 Quick Start：要求精确版本说明、唯一 `dsh plugin --profile web add dsh-grok-provider@<release-version>` 命令，并拒绝“尚未发布/源码候选/继续安装旧版”及英文等价措辞。检查范围不得覆盖后文历史说明，以免误伤合法的历史 candidate 记录。

禁止为不同平台重新打两个内容不同但版本相同的 tarball。

## 7. Git 与版本

- `0.1.0` 历史开发分支为 `yukiryou/v0.1.0`；`0.1.10` 代码分支 `yukiryou/v0.1.10-search-settings-fix` 与发布证据分支 `yukiryou/v0.1.10-release-evidence` 已分别经 PR #23、#24 合入受保护 `yukiryou/main`，最终 release commit 为 `fe1e5a7d82defb17ab5bcbb0d9979c43cb48c028`。`0.1.8` 已由撤回的 sidebar quota 发布消耗，不得复用。`0.1.11` 代码分支 `yukiryou/v0.1.11-reasoning-stream` 与发布证据分支 `yukiryou/v0.1.11-release-evidence` 已分别经 PR #25、#26 合入，最终 release commit 为 `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`；已发布版本不可覆盖或重发。`1.0.2` 代码分支 `yukiryou/v1.0.2-empty-reasoning` 与发布证据分支 `yukiryou/v1.0.2-release-evidence` 已分别经 PR #34、#35 合入，最终 release commit 为 `be200f9352afe93b27dd2856d89c01674f0cd637`；实际发布回读记录在 `yukiryou/v1.0.2-post-release-evidence`，该分支不会改变不可变 tag 或制品字节。
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
- 实际 tarball 中存在项目 `LICENSE`；复制第三方 geometry/asset 时还必须存在完整 `THIRD_PARTY_NOTICES.md`，其组件、package version、来源与许可和 bundle 内实现一致。

从 Registry 重新下载，计算 SRI 并与 `dist.integrity` 及候选 digest 比较；在临时项目安装精确版本、生成 lockfile 后执行 `npm audit signatures`；核对 provenance attestation 的 GitHub repository 与 release commit，不使用 `latest` 安装代替证据。

## 10. Marketplace

npm 发布不会自动成为受管可安装项。当前发现状态：

- GitHub 仓库已添加 DeepSeek Harness 官方推荐的 `dsh-plugin` 与 `dsh` Topics，可被 Topic 驱动来源发现。
- YukiRyou curated catalog 当前仍是精确 `dsh-grok-provider@0.1.0`、verification `installed`、仅 `darwin-arm64`。`1.0.3` 已发布及其完整性/provenance 回读不等于从 catalog 安装该精确版本，因此不得据此升级条目或增加平台。
- 公共 `awesome-dsh-plugin` 的收录 PR #3415 已合并，项目已进入 `model` 分类。该列表不记录精确 npm 版本或平台验证字段，因此收录只代表发现入口，不证明任一后续制品的受管安装或平台验收。
- Windows x64 仍未完成一条闭合的 Registry 精确版本 production inspector、安装、重启、浏览器登录、聊天、工具调用和重新认证链路。`0.1.6` 发布后已确认图片可用，并确认官方 CLI 可在生成登录 URL 前因 OIDC discovery timeout 退出；`0.1.7` 只增加闭合诊断，不是浏览器弹出已修复或已验证的证据。`1.0.3` 的 Registry/制品回读也未覆盖上述真实链路、OAuth、完整真实账号会话或 Windows 浏览器弹出。

catalog 条目只能记录实际验证完成的精确版本和平台。当前条目记录：

- UTC `testedAt`。
- Harness `0.1.1-rc.2`。
- verification `installed`。
- 仅 `darwin-arm64`。

从 `0.1.1` 起，常规发版不再要求重复 macOS/Windows 真机 smoke。每次仍须通过两平台 CI、协议与安全测试、干净 profile 安装、确定性 tarball 和 Registry integrity/provenance 回读。涉及认证、官方 CLI、Harness subprocess seam、内容输入或平台安全策略的变更应安排定向真机复核；`0.1.4` 因新增图片输入，已完成精确 `grok-4.6` 的 Proxy 红蓝语义门禁和收窄后的 Harness modality 复验。`0.1.9` 因新增 Search，保留四组固定 Proxy 脱敏协议证据、默认关闭、独立开关、混合 function、citation/replay、双平台 CI 与隔离 Harness 验收；`0.1.11` 的 reasoning 响应兼容覆盖空项、一次性 ID 复用、raw/summary 互斥、encrypted replay 与截断失败关闭。`1.0.2` 已覆盖空项零 block、非空项延迟启动、混合多项顺序、严格失败关闭和实际 tarball README。Windows discovery 可访问时由官方 CLI 弹出浏览器仍是独立未验证边界。

macOS x64 不在当前官方 Grok CLI 支持矩阵，不进入 `0.1.0` catalog 或发布承诺。npm SHA-512 作为 release evidence 保存；它不是当前 curated schema 字段，市场会从 Registry `dist.integrity` 自行验证 SHA-512。

发布证据还必须固定精确 Grok CLI 版本、官方 tag/commit、可用的 `SOURCE_REV`，以及同版本 auth flow、auth schema、支持平台和 Proxy 文档永久链接；不得只引用 mutable `main`。

## 11. 失败与回滚

- 发布前失败：修复后重建新 tarball，旧候选不发布。
- 发布后发现问题：不能覆盖 `0.1.0`；从 catalog 撤下并发布递增版本，例如 `0.1.1`。
- 对已知有问题的版本执行 `npm deprecate` 并在公告中说明；撤下 catalog 不会删除用户已安装或缓存的 `0.1.0`。
- 不依赖 unpublish 复用版本号。
- 凭据或 token 泄漏时立即停止分发、撤销相关凭据、发布安全公告并轮换发布权限。

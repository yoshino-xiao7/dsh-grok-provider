# 当前实现与发布状态

稳定 `0.1.5` 已发布。它沿用 `0.1.4` 只为精确 `grok-4.6` 开启有界图片输入、让 `grok-4.5` 与所有其他模型保持 text-only 的边界，只补强发布绑定、账户面板能力展示和 Provider Runtime 安装事务。

状态日期：2026-08-28
当前 npm 发布线：`dsh-grok-provider@0.1.5`
当前稳定版：`dsh-grok-provider@0.1.5`
版本分支：`yukiryou/v0.1.5`
内容类型路线：已冻结于 [能力路线图](./11-capability-roadmap.md)；`0.1.4` 只做图片输入，`prompt_cache_key` 已拆出。

## 已实现

- 原创 Host provider、固定 Grok Build transport、动态账号模型目录和严格 Responses SSE codec。
- 文本、reasoning、usage、`stop|tool-calls|max-tokens`、函数调用/结果、多轮历史和加密 reasoning replay；不兼容 Grok 字符集但有界的第三方历史调用 ID 会确定性映射，并保持调用/结果关联。
- 官方 CLI 单路径：固定默认路径、版本仅作有界诊断、登录能力探测、受控 cwd/环境、固定 argv、无 shell spawn、10 秒准备期限、5 分钟登录期限、2 分钟退出期限、整棵进程树取消与异步卸载等待；`grok login --oauth` 负责打开浏览器和持久化 token，CLI 退出 0 后插件再次校验生产 OIDC credential schema。
- 包中不存在独立 OAuth client identity、device flow、插件实现的 refresh/revoke、Harness credential grant 或模式选择接口；过期 access token 只通过 single-flight、30 秒有界的官方 CLI `models` 命令续期，插件不提取 refresh token、不执行 refresh grant、不写凭据文件。ADR-0003 已由 ADR-0005 取代。
- Web：Harness settings section、中文/英文、loopback-only RPC、登录状态轮询、陈旧 session 防护、取消和二次退出确认；新增参考 Harness 信息层级的账户卡、真实 billing 周期/重置时间和动态模型 capability 卡。完整类型化周期可恢复 proto3 省略的零使用率，其他缺失百分比仍显示未知；renderer 不接触 token 或 identity。
- TUI：闭合 `/grok status|login|cancel|logout` grammar，`recordInput:false`，不输出 CLI 原文或 token。
- 发布构建：`src`、测试和 spike 不进入 tarball；`dist`、类型、bundle patch 与发行文档由确定性脚本生成。`prepack` 强制重建 `dist`，避免直接 `npm pack`/`npm publish` 带入陈旧产物。零普通 runtime dependencies。
- `0.1.4` 图片输入：异步 request compiler 惰性读取 Harness attachment，只为精确 `grok-4.6` 生成有序 jpeg/png data URL，并固定 `detail:"high"`；普通 user 与一层 tool-result 图片受格式、尺寸、像素、张数、总字节、content block 和最终 JSON 上限约束，`grok-4.5` 与未知模型继续 text-only。

## 已验证

- `0.1.3` 发布基线的 Node 24 完整构建/测试通过：62 项，60 pass、0 fail、2 项 Windows-only 在 macOS 按预期跳过并由 CI matrix 承接。
- 使用真实脱敏 Ark `toolu_ark1_…|fc_…` ID 形状的回归测试先稳定复现旧版本失败，再验证 `0.1.3` 同时生成匹配的 `function_call` 与 `function_call_output` 安全 ID。
- `npm audit --omit=dev`：0 vulnerability。
- 新认证接口的本地候选已安装到隔离的 Harness `0.1.1-rc.2` TUI/Web profile。真实 TUI 的缺失凭据 `unavailable`、`/grok login` 浏览器跳转、官方 CLI 登录成功和有效凭据 `ready` 均通过。真实 Web 的 client bundle 发现、Grok 设置页、登录启动/取消、Host 重启和临时 profile 卸载均通过；rc.2 scanner 所需的 `./package.json` 导出已加入回归测试。
- Web/TUI 的 `available` 现在实际验证官方 credential contract，不再把 credential source 已注册误报为 ready；缺失凭据的真机 Web/TUI 双向验证通过。
- macOS arm64 使用当前 clean-room 代码和本机官方 credential，动态发现 `grok-4.6`、`grok-4.5`；两个模型的首轮流、加密 reasoning 第二轮续接、usage、finish 和 fixture function call 均通过。
- `max_output_tokens` 真机返回 `response.incomplete/max_output_tokens`，已映射为 Harness `max-tokens`。
- macOS 隔离 Harness Web profile 已从当前 `dsh-grok-provider@0.1.0` tarball 安装并验证：设置页真实显示登录状态、`grok-4.6`/`grok-4.5` 上下文与推理档位、流式/tool capability、每周周期和重置时间；手动刷新通过。当前真实账号的 CLI Proxy JSON 省略百分比，而同周期官方移动端显示 `0% 已使用`；解析器现按完整类型化周期恢复为 `0% 已使用 / 100% 剩余`。
- `0.1.4` 固定 CLI Chat Proxy 的 `grok-4.6` 图片门禁已完成：普通 user 与一层 tool-result 分别使用红/蓝合成图，共 4 次 `POST /v1/responses`；全部返回 HTTP 200、`text/event-stream`、正常 completed，且规范化整段回复只含正确颜色词和可选句末标点。脚本只输出脱敏计数和闭合枚举，不保存图片、prompt、模型正文、凭据或身份数据。
- `grok-4.5` 的受控红图 Proxy 结果语义不可靠，因此从图片 capability 集合移除并保持 text-only；HTTP/SSE 形状不能替代模型实际观察图片的语义断言。
- Harness `0.1.1-rc.2` 的真实 `attachment-local`/`LlmRuntime` 最终集合 smoke 已通过：内容寻址与 299-byte PNG projection 有效，普通 user 与一层 tool-result 的有序 `text/image/text` 均保留精确图片 wire；仅 `grok-4.6` 保留 image，`grok-4.5`/`grok-future` 均为 text-only，共编译 4 个请求且本地受控 transport 的网络请求为 0。

## `0.1.0` 发布结果

- GitHub Release 与 npm `0.1.0` 已发布；Registry 重新下载文件与候选 tarball 的 SHA-256/SHA-512 完全一致。
- npm provenance attestation 已生成并回读；canonical repository、name、version 与 SRI 一致。
- npm Trusted Publisher 已绑定 GitHub Actions `release.yml` 与 Environment `npm`，只允许 `npm publish`。
- GitHub `NPM_TOKEN` secret 与 npm 首发 Token 已撤销；包已设置为要求 2FA 并禁止 bypass 2FA token。
- GitHub Release 说明为中文在前、英文在后，且已移除正文重复版本标题。
- 仓库已添加 `dsh-plugin` 与 `dsh` Topics；YukiRyou catalog 当前收录精确 `0.1.0`、verification `installed`、仅 `darwin-arm64`，不代表 `0.1.5` 已完成受管安装。

## 已知首发流程缺陷

`0.1.0` tarball 内的中英文 README、`SECURITY.md` 与部分状态文档仍保留预发布措辞。npm 同一版本不可覆盖，因此 npm 页面只能通过后续递增版本纠正。该问题已进入[逐版发布检查表](./10-release-checklist.md)，以后属于发布前阻断项。

## `0.1.1` 发布门禁

`0.1.1` 按以下门禁冻结；最终制品与回读证据以 GitHub Release 和 npm provenance 为准：

1. 中英文 README、`SECURITY.md`、文档首页、实现状态、发布计划和 CHANGELOG 同步完成。
2. `package.json`、CHANGELOG、双语 release notes、tag 与唯一候选 tarball 全部冻结为 `0.1.1`。
3. 完整测试、两平台 CI、打包清单、隔离安装与候选 SHA-512 门禁通过。
4. OIDC Trusted Publisher 配置保持有效，workflow 不读取任何 npm Secret。
5. 仓库所有者在看到最终候选摘要与全部证据后明确授权发布。

Windows x64 真机不再是 `0.1.0` 预发布阻断项。首次发布后必须从 Registry 安装精确 `0.1.0`，完成官方安装物 Authenticode/hash、浏览器登录、取消/超时/卸载、动态全部模型、聊天、reasoning replay、工具调用和 production inspector；完成前对 Windows 保持“代码支持、真机未验证”标识。`0.1.1` 及后续版本不要求重复真机验证，以两平台 CI、契约测试、干净安装和制品校验作为常规门禁。

仓库所有者已于 2026-08-26 明确授权发布精确 `dsh-grok-provider@0.1.1`。该版本只修正发布事实与长期发布流程，不改变运行时协议或能力边界。

## `0.1.1` 发布结果

- 受保护 PR #3 合并后的 release commit 为 `a973828bcdd906836b68018f7592e73f769f9c3e`，`v0.1.1` 精确指向该 commit。
- GitHub Release 采用中文在前、英文在后且正文不重复版本标题，只附加唯一 `dsh-grok-provider-0.1.1.tgz`。
- 正式 tarball 为 48 个文件、93,992 bytes；SHA-256 为 `9bcd2362af369ace69763cfed11d843d9574a43b134c7e194e589750ba4081c7`，npm SRI 为 `sha512-O2Rh21NBZkqwXu7iUWKi8OwKzZaOHZ5sB0+Ny0w9VYgxXzVRXWHtsPfqmz4EpY6Cn8kSBsiJ3jVOJT/UQpEFKw==`。
- Trusted Publisher OIDC workflow run `32936282879` 发布成功；npm `latest` 指向 `0.1.1`，provenance 绑定 canonical repository、`release.yml`、`yukiryou/main` 与上述 release commit。
- Registry 重新下载文件与本地/GitHub Release 候选逐字节一致；9 个 Registry 签名与 1 个 provenance attestation 验证通过；npm 页面 README 已回读为 `0.1.1` 最终公开状态。
- YukiRyou catalog 仍精确保留已完成受管 Harness 真机安装的 `0.1.0`。其 schema 不允许把仅完成完整性、provenance、Node 24 干净安装和模块加载的 `0.1.1` 标成 `installed`；遵循“不重复真机验证”决定，因此不做虚假升级。

## `0.1.2` 发布结果

- 受保护 PR #4 合并后的 release commit 为 `30ff6bdeb62f7904baf02c4a5f9ebd73e2edf442`，不可变 `v0.1.2` tag 精确指向该提交。
- 正式 tarball 为 51 个文件、99,894 bytes；SHA-256 为 `b224db9f52708b355baa914c0fa4a352e9f791c3e51a36c7309a3b89cbc2781a`，npm SRI 为 `sha512-XhaOjOflDGsNUaAYnIw1aoJ/zHfPbYtubLKvTUu6aro3olaLWek6xdEe83DpAmwJT6xM3s0+y0QOnEh1kQtl9w==`。
- Trusted Publisher OIDC workflow run `32981172053` 从正式 GitHub Release 下载并复验同一 tarball 后发布成功；workflow 只接受稳定 tag 并固定发布到 npm `latest`。
- Registry 重新下载文件与 GitHub Release 制品逐字节一致；1 个 Registry 签名与 1 个 SLSA provenance attestation 验证通过。
- npm `latest` 指向 `0.1.2`；`next` 仍指向不可变历史版本 `0.1.2-rc.1`，但长期 workflow 已无法创建或发布新的预发行版本。
- 发布后已从 released `yukiryou/main` 创建下一稳定开发分支 `yukiryou/v0.1.3`。

## `0.1.3` 发布状态

- 根因已经从真实会话持久化事件中定位：旧 Ark 工具调用 ID 的 `|` 被 Grok 请求转换器当作整个响应无效处理，且失败发生在网络请求前。
- 最小差分复现确认只把 `|` 改为兼容字符即可通过，排除 OAuth、额度、模型目录和 xAI 上游响应。
- 请求转换器现在保留兼容 ID，对最长 1024 bytes 的不兼容历史 ID 使用 SHA-256/base64url 确定性映射；空值和超限输入继续失败关闭。
- 本地 Node 24 完整测试、0 vulnerability 生产依赖审计与 52 文件 dry-run 打包清单通过；macOS/Windows CI run `33041492669` 全绿，PR #5 合并后的 release commit 为 `cc531e0f02fab962ee704fbfd36f9099d5ecfeb2`。
- 唯一正式 tarball 为 52 个文件、103,305 bytes，SHA-256 `08b00745cbe97599818dce9f9c800ad651fdb781b76d00d34022d24b7e017029`，SRI `sha512-EkBhfoFU0PjQePqxTGvTnYE2bpTeFSN71zJGpt+PrkERJCapMpm1A4QkV98e1NmCe9DW6aa8pmkFHOifbSDvYw==`；隔离安装与 Host 加载通过。
- GitHub Release `v0.1.3` 与 Trusted Publisher run `33041791394` 发布完成；npm `latest=0.1.3`，Registry tarball 与 Release 制品逐字节一致，签名与 SLSA provenance attestation 均已回读。
- 三张社区市场预览图保存在 `.github/assets/plugin-preview/` 并由中英文 README 引用；npm tarball 明确排除这些展示资源。
- 根目录 `screenshots.json` 固定三张预览图顺序；公共 `awesome-dsh-plugin` 收录 PR #3415 的 README 生成、locale parity、awesome-lint 与 build 自动门禁通过，随后已由独立维护者合并并进入 `model` 分类。该列表不记录精确 npm 版本或平台验证字段。

## `0.1.4` 发布结果

- 仓库所有者已于 2026-08-28 接受按独立切片推进内容类型；`0.1.4` 只做图片输入，搜索与生图顺延。
- 任意 URL 下载与 API Key 模式保持永久非目标。
- [ADR-0008](./adr/0008-image-input-request-compiler.md)、异步 request compiler、可选 attachment seam、精确模型 route 与离线自动化测试已完成开发。
- 最终源码与发行文档同步后已用 Node 24 完成 119 项全量测试（117 pass、0 fail、2 项 Windows-only skip）；`npm audit --omit=dev` 为 0 漏洞，dry-run 包含 58 个文件。
- 公开 xAI 图片协议与精确 `grok-4.6` 的 user/tool-result 红蓝语义 Proxy 门禁已经验证；`grok-4.5` 因语义不可靠失败关闭。最终 Harness attachment modality 复验见[证据页](./12-upstream-image-input-evidence.md)。
- 本轮未引入 `prompt_cache_key`、搜索、生图、新 SSE 事件、URL 下载、认证或 endpoint 变化。
- 代码 PR [#8](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/8) 与发布证据 PR #9 已合并；CI run [33149124946](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33149124946) 的 macOS/Windows job 均通过。
- 最终 release commit 为 `59776af8e954aa6e14463c659a22c6c3d5798bb5`；不可变 `v0.1.4` tag 精确指向该提交。唯一正式 tarball 为 58 个文件、130,958 bytes，SHA-256 `7a1733c1ab391150430d3f302ff5cb3d04f5153c339ecbdbfba128191d02ad3e`，npm SRI `sha512-IkEFEdBnt/EpE9y8mCAyE6i+023Z2229J6gsR2y1cNZ+md9rwpxiqb5IsDMZO84ewh65wMM/ajCQ6F4UT2bDGg==`。
- GitHub Release [v0.1.4](https://github.com/yoshino-xiao7/dsh-grok-provider/releases/tag/v0.1.4) 与 Trusted Publisher run [33151195684](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33151195684) 完成；npm `latest=0.1.4`，Registry tarball、Release asset 与本地制品逐字节一致，Registry 签名与 SLSA provenance attestation 验证通过。

## `0.1.5` 发布状态

- 从上述精确 `0.1.4` release commit 创建独立分支 `yukiryou/v0.1.5`，不直接修改发布基线。
- 维护范围冻结为：发布 workflow 的 tag/ref/commit 与唯一 Release asset 绑定、Node `24.19.0` 固定；账户面板从模型 `inputModalities` 展示图片能力；Provider Runtime 部分安装失败时逆序回滚。
- 不改变认证、凭据、CLI subprocess、endpoint、Responses wire、图片编译资源策略或平台支持矩阵；Web/X Search 与图片生成继续顺延。
- `package.json`、lockfile、CHANGELOG、中英文 README、安全策略和双语 Release Notes 已冻结为 `0.1.5`；精确 Node `24.19.0` 全量测试通过（133 项、131 pass、0 fail、2 项 Windows-only skip），生产依赖审计为 0 漏洞，dry-run 打包为 59 个文件。
- 代码 PR [#10](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/10) 与发布证据 PR [#11](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/11) 已合并；最终 release commit 为 `4f0bcd84f96c1cd5d95dda2a01ce63ff6403b828`，其 [CI run 33161259276](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33161259276) 的 macOS 14 与 Windows 2022 job 均通过。
- 从该 commit 冻结的唯一 `dsh-grok-provider-0.1.5.tgz` 为 59 个文件、135,800 bytes，SHA-256 `4b1690408703ae9818015e335845e9a4b5fe352ca4c98d34400f4bad4d8d7c14`，npm SRI `sha512-rVryka0x63QsjBiKnMPK09A5yArB9nmDyYWTOpxFWzs6ged7YzEua2h7CkHgGl/i7Al+Csebzg+30/+Q/8HHKg==`；同一制品的隔离安装、manifest、Host 与 client export 加载通过。
- 不可变 `v0.1.5` tag 精确指向 release commit；GitHub Release [v0.1.5](https://github.com/yoshino-xiao7/dsh-grok-provider/releases/tag/v0.1.5) 与 Trusted Publisher run [33162280108](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33162280108) 完成。npm `latest=0.1.5`，Registry tarball、Release asset 与本地制品逐字节一致，Registry 签名、npm publish attestation 与 SLSA provenance 验证通过。

# 当前实现与发布状态

`1.0.0` Search 响应协议修复候选已完成版本更新、本地自动化、脱敏真实协议验证、代码 PR #28 与 main 双平台 CI；当前可安装、受支持的稳定版和 npm `latest` 仍是 `0.1.11`。候选尚未完成发布证据 final CI、最终 release commit、唯一制品冻结、精确制品授权或发布回读。

状态日期：2026-08-30
当前 npm 发布线：`dsh-grok-provider@0.1.11`
当前源码发布版：`dsh-grok-provider@0.1.11`
当前候选目标：`dsh-grok-provider@1.0.0`（未发布）
发布基线：`yukiryou/main@2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`
内容类型路线：已冻结于 [能力路线图](./11-capability-roadmap.md)；`1.0.0` 继续修复 Search stream 兼容，不新增内容类型、模型、认证方式、endpoint 或本地工具。

## 已实现

- 原创 Host provider、固定 Grok Build transport、动态账号模型目录和严格 Responses SSE codec。
- 文本、reasoning、usage、`stop|tool-calls|max-tokens`、函数调用/结果、多轮历史和加密 reasoning replay；不兼容 Grok 字符集但有界的第三方历史调用 ID 会确定性映射，并保持调用/结果关联。
- 官方 CLI 单路径：固定默认路径、版本仅作有界诊断、登录能力探测、受控 cwd/环境、固定 argv、无 shell spawn、各准备阶段独立 10 秒期限、5 分钟登录期限、2 分钟退出期限、整棵进程树取消与异步卸载等待；`grok login --oauth` 负责打开浏览器和持久化 token，CLI 退出 0 后插件再次校验生产 OIDC credential schema。
- 包中不存在独立 OAuth client identity、device flow、插件实现的 refresh/revoke、Harness credential grant 或模式选择接口；过期 access token 只通过 single-flight、30 秒有界的官方 CLI `models` 命令续期，插件不提取 refresh token、不执行 refresh grant、不写凭据文件。ADR-0003 已由 ADR-0005 取代。
- Web：Harness settings section、中文/英文、loopback-only RPC、登录状态轮询、陈旧 session 防护、取消和二次退出确认；新增参考 Harness 信息层级的账户卡、真实 billing 周期/重置时间和动态模型 capability 卡。完整类型化周期可恢复 proto3 省略的零使用率，其他缺失百分比仍显示未知；renderer 不接触 token 或 identity。
- TUI：闭合 `/grok status|login|cancel|logout` grammar，`recordInput:false`，不输出 CLI 原文或 token。
- 发布构建：`src`、测试和 spike 不进入 tarball；`dist`、类型、bundle patch 与发行文档由确定性脚本生成。`prepack` 强制重建 `dist`，避免直接 `npm pack`/`npm publish` 带入陈旧产物。零普通 runtime dependencies。
- `0.1.4` 图片输入：异步 request compiler 惰性读取 Harness attachment，只为精确 `grok-4.6` 生成有序 jpeg/png data URL，并固定 `detail:"high"`；普通 user 与一层 tool-result 图片受格式、尺寸、像素、张数、总字节、content block 和最终 JSON 上限约束，`grok-4.5` 与未知模型继续 text-only。
- `0.1.6` 历史兼容：普通 user/system 历史中的私有 reasoning 被省略并保留相邻可见 text/image；只有有效的同 Provider assistant 历史可以进入加密 reasoning replay，一层 tool-result 仍只接受公开 text/image。
- `0.1.7` 维护：独立只读 diagnostics RPC 投影插件版本与官方 CLI 的 `ready|missing|invalid|unavailable` 闭合集合；登录失败只投影白名单 reason 并及时结束 spinner。设置导航在 Harness 当前无原生 icon slot 时，以精确标签匹配、冲突失败关闭和可回收 lifecycle 应用 MIT 许可的 `IconThinkOutline16` 几何。
- 已发布 `0.1.10` Search 能力与可写设置链路：Web/X 默认关闭且可独立编译；request/receipt 同编译、调用级设置快照、精确 route、共享工具/字节预算、后台 purpose 关闭、Web 标准 lifecycle、四项 X custom-tool、function membership、citation 有界丢弃与 replay 抑制均失败关闭。
- 已发布的 `0.1.11` reasoning 兼容：允许已闭合 reasoning ID 以严格空项再出现一次，接受闭合空 reasoning，支持官方 raw `reasoning_text` 标准生命周期；raw 与 summary 互斥，raw replay 只携带 encrypted content 与空 summary。
- `1.0.0` 候选：首次复用前仍要求一个完成的 Web/X server Search；一旦该 ID 已被 Search-backed，允许后续多个严格空占位 lifecycle，每个都必须独立 `output_item.done`。visible summary/content 与 summary/raw lifecycle 必须为空，但允许有界 opaque `encrypted_content`。完成态 Web Search `open_page` 只接受精确有界 type/URL，并要求 streamed/final action 一致；URL 校验后丢弃，不产生本地工具调用或网络访问。

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

## `0.1.6` 发布状态

- 已修复普通 user/system 历史携带私有 reasoning 时后续图片请求在 POST 前被误判为 `INVALID_RESPONSE` 的缺陷，并为官方 CLI 的 executable 解析、只读验证、`--version`、`login --help` 与最终动作拆分 deadline；本版不启用 Search。
- 精确 Node `24.19.0` 本地全量测试通过：161 项、159 pass、0 fail、2 项 Windows-only skip；`npm audit --omit=dev` 为 0 漏洞，最终 dry-run pack 为 60 个文件，macOS 14 与 Windows 2022 CI 全绿。
- 最终 release commit 为 `93519f77adc4ce2edfc1bbd27bce9e44d4805da6`。唯一 `dsh-grok-provider-0.1.6.tgz` 为 60 个文件、145,620 bytes，SHA-256 `fd660d91216086496a4d189cb7e60b3445079913c97da41fccf805e3086c0347`，npm SRI `sha512-Vsmzm+8tgmHCuS8WKfzicjgauupY9FZ5B/V+55KbCTggBrThDDArjeS2bwHUVpjd92CvO47ya3SHELdWtTijAQ==`。
- Trusted Publisher run [33177647530](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33177647530) 已完成；Registry 签名与 provenance 验证通过，npm `latest` 指向 `0.1.6`。
- 发布后仓库所有者确认图片输入可用。Windows 直接运行官方 CLI 时在生成登录 URL 前发生 xAI OIDC discovery timeout；因此没有外部浏览器弹出证据，不得表述为 Provider 已修复或已验证 Windows 浏览器登录。

## `0.1.7` 发布状态

- 代码候选范围冻结为 Windows 运行时诊断、登录失败可解释性与 `IconThinkOutline16` 设置导航图标维护；当时 Web/X Search 计划顺延到 `0.1.8`。该号码后来被 sidebar quota 维护发布占用并在发布后撤回，Search 最终整体迁移到 `0.1.9`。
- 代码与文档已定义独立只读 diagnostics RPC、插件/CLI 版本安全投影、`ready|missing|invalid|unavailable` 闭合状态、安装入口与重新检测，以及 `auth-network-timeout` 等白名单登录失败 reason；原始 stderr、路径、环境与授权 URL 不进入 renderer。
- 诊断 single-flight、调用方取消、capability teardown、driver replacement 与陈旧轮询响应均有闭合 lifecycle；网络错误提前退出时结束 spinner，但插件不修复系统代理、OIDC 网络或自行构造 OAuth URL。
- Harness `settings.section` 当前没有 icon slot；候选包内嵌 `@deepseek-ai/dsh-client-ui-primitives@0.1.0-rc.7` 的 MIT `IconThinkOutline16` 几何，通过设置导航内的精确本地化标签唯一匹配应用，歧义时保持桌面端原图标，并在卸载时移除 marker、style 与 observer。
- 精确 Node `24.19.0` 本地全量测试已通过：190 项、188 pass、0 fail、2 项 Windows-only skip；生产依赖审计为 0 漏洞，dry-run pack 为 64 个文件，diff、生成 bundle 一致性与秘密模式扫描通过。
- 代码 PR [#16](https://github.com/yoshino-xiao7/dsh-grok-provider/pull/16) 已合并到受保护 `yukiryou/main`，merge commit 为 `b1d8bdf3f063d0a8f61ec28cde83c5cefd5352ff`；候选 head `da66a2305184aa187de6fc657b08d1ab58dc0672` 的 CI runs [33225068169](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33225068169) 与 [33225065967](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33225065967)，以及 merge commit run [33225274039](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33225274039)，均完成 macOS 14、Windows 2022 全绿。
- 发布证据 PR #17 合并后，最终 release commit 为 `68f6b474bd860b829f03e7712ec79e8afe2b9b8d`；CI run `33225655567` 的 macOS 14 与 Windows 2022 均全绿。
- 唯一 64 文件、167,970-byte tarball 的 SHA-256 为 `fd4d2a77b70335cb71f950f299e3c6e0b57d3720de424d99343bd58921a40aaf`，SRI 为 `sha512-QhCvp/Y0vq1XHY7XQ+anUnv4sxHH4xxhDRPCzDvqCpXHRgc+IrzJS62bqf5ALGx6fRoKWchy/dbJ0n+LjmkS2w==`。
- 不可变 `v0.1.7`、正式 GitHub Release 与 Trusted Publisher run `33226665968` 已完成；npm `latest=0.1.7`，Registry、Release 与本地制品逐字节一致，10 个 Registry signatures、2 个 attestations 与 SLSA provenance 已验证。
- Windows 网络可达时的外部浏览器弹出仍未完成真实设备验收，发布不改变该边界。

## `0.1.8` 撤回状态

- `0.1.8` 曾作为 sidebar quota 维护版发布，随后撤回；该发布不包含 Web/X Search。
- npm Registry 已消耗 `0.1.8`，即使撤回也不能以同一版本号重新发布不同 Search 制品。
- 原先标注为 `0.1.8` 的 Search 开发证据与未完成门禁整体迁移到 `0.1.9`，不得把 Search 描述为 `0.1.8` 能力。

## `0.1.9` 发布状态与已确认缺陷

- Web Search、X Search 的协议、页面与 `settingsScope` 绑定均已进入发布制品；但 Host 未注册同名 `llm-grok` namespace，真实页面因此派生为 `unavailable` 并禁用两个开关。
- 两项全关时不读取 `purpose` 并保持 `0.1.7` request wire；启用时，非空后台/派生 purpose 强制关闭 Search，accessor/空值/错误类型本地失败。
- 只有精确 `grok-4.6` route 支持 Search。Harness functions 后依次追加 `web_search`、`x_search`，共同受 128 项和 16 MiB 上限约束；不支持模型在 Responses POST 前返回 `UNSUPPORTED_CONTENT`。
- 固定 Proxy 的 Web、X、双开与生产 function → `web_search` 顺序 Web+function 四组脱敏观察已完成。Web 使用标准 search lifecycle；X 使用四项闭合的 `custom_tool_call` 名称。Search 事件产生零 Harness tool-call chunk，结构化 citation 有界校验后丢弃，观察到 Search 后不保存 encrypted reasoning replay。
- 精确 Node `24.19.0` 本地全量测试已通过：221 项、219 pass、0 fail、2 项 Windows-only skip；生产依赖审计为 0 漏洞，干净提交的 dry-run pack 为 69 个文件，生成 bundle 一致性、diff 与秘密模式扫描通过。
- 候选 head `402920fa0f5eb0b543a09a597ada0b2dd9661020` 的 push/PR CI、代码 PR #20 合并提交 `89297ad5c30e1edd94936b52fbe89d0331aaddf5` 的 main CI，以及隔离 Web Harness 默认关闭、Web-only、X-only、function → `web_search` Mixed 四场景验收均已通过。隔离 fetch 无 passthrough；浏览器手工对话、Agent/session loop、OAuth、真实账号/真实 xAI 请求和 Windows 真机不由此覆盖。
- 发布证据 PR #21 合并后的最终 release commit 为 `a0af7b74882546dc3d9477b8f6c1494935e6bfb4`；CI run `33295408650` 全绿。唯一 `dsh-grok-provider-0.1.9.tgz` 含 69 个文件、190,049 bytes，unpacked size 为 603,475 bytes，SHA-256 为 `78c73c95ea71d66cad6e6146fed41c281f1c8b29f60353e3f20247ec23833210`，SRI 为 `sha512-GeXQg3qedCGZz9D5MMaHd8Afe5Bn0nxjG+PQmKOB2AxB3m6IiGA07PMD77dEAOJVbAzKk0SnxAOKTZMTQFtuYg==`。
- 不可变 `v0.1.9`、GitHub Release 与 Trusted Publisher run `33295761336` 已完成；Registry、Release 与本地制品逐字节一致，npm `latest=0.1.9`。精确 Registry 安装的 Host/client import/export smoke 通过；精确安装审计图汇总 71 个已验证签名与 3 个 attestations，本包 attestations endpoint 返回 2 项，SLSA provenance 精确绑定 tag、workflow、commit 与 release run。
- 上述候选与隔离协议测试向客户端注入了合成的 ready settings scope，只证明 startup Config → request，并未证明真实 Host namespace 存在。发布后真实页面确认功能集成缺口；它不代表制品损坏，也不会通过覆盖或重发 `0.1.9` 修复。

## `0.1.10` 发布状态

- 通过 `@deepseek-ai/dsh-settings@0.1.1-rc.2` 的 canonical `installSettingsSection` 注册 `llm-grok`，解析 schema 默认值、组合配置和持久化用户层；settings service 缺失或重载时回退组合配置。
- Adapter 在每次调用开始且首次模型目录 await 前捕获一次 Search policy；后续设置提交影响下一调用，已准备或在途调用保持原策略。request compiler 与 receipt 继续只处理冻结调用，不承担动态状态。
- 真实 SettingsProvider + LLM Runtime 回归覆盖唯一 namespace、安全默认值、`applies:"live"`、持久化更新、组合回退和插件生命周期清理；延迟目录回归证明快照早于首个 await。
- 聚焦 Host/Adapter/client 38 项回归通过；精确 Node `24.19.0` 全量为 224 项、222 pass、0 fail、2 项 Windows-only skip，生产依赖审计为 0 漏洞。
- 最终 release commit `fe1e5a7d82defb17ab5bcbb0d9979c43cb48c028` 的唯一 70 文件、197,620-byte tarball，unpacked size 为 628,836 bytes，SHA-256 为 `f9fe1dea743e86e2799a1073a93a8af91ad5bd389e14f4d2f0528428ada93c62`，SRI 为 `sha512-OnfG4diVqJdzYSwJKERNnaplYFbOvFICZP58E0f2Cdh+t7orlTL1DWokvzEHdJrw6HA+UMoKDZgJ6AMEVv4aUg==`。
- 隔离 Web Harness 的真实 `settings.describe` 已返回可写、`applies:"live"` 的唯一 `llm-grok` namespace。页面两个开关均 enabled，“暂时不可用”提示消失；浏览器写入把 revision 从 1 推进到 4，最终已恢复 `{webSearch:false,xSearch:false}`。
- 最终候选 head `1e5e875c6e55616f8d589ed56d4aa5fab643387a` 的 push/PR CI、代码 PR #23、发布证据 PR #24 与 final main CI run [33299116564](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33299116564) 均完成 macOS 14 / Windows 2022 全绿。不可变 `v0.1.10`、唯一 GitHub Release asset 与 Trusted Publisher run [33299599113](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33299599113) 已完成；Registry、Release 与本地制品逐字节一致，npm `latest=0.1.10`，Registry signature 与 SLSA provenance 已回读。

## `0.1.11` 发布状态

- 真实失败边界为精确 `grok-4.6`、High Effort、Web Search 续跑：上游可在一个已闭合 reasoning lifecycle 后，以新 output index 把同一 reasoning ID 再使用一次作为严格空占位；旧 codec 的全局 ID 唯一约束把整段响应映射为 `INVALID_RESPONSE`。
- 新状态机只在一个已完成 server Search 位于两段 reasoning 之间时，允许已闭合 reasoning ID 一次性复用为空项；无 Search 间隔、未闭合、跨类型、非空或第二次复用继续失败关闭。普通空 reasoning 同样必须完成 added/done 闭环。
- 新增官方 Responses raw reasoning lifecycle：`reasoning_text` content part、`response.reasoning_text.delta` / `done` 与最终 item content 必须一致；raw 与 summary 模式严格互斥，乱序、混用、重复与截断均拒绝。
- raw reasoning replay 元数据只记录 encrypted content 与 `reasoning_text` 类型标记，不保存 raw 明文；下一请求只发送 `encrypted_content` 与 `summary: []`，不会回传或把 raw 明文伪装为 summary。当前流中的 raw delta 仍作为 Harness 可见 reasoning 输出。
- 113/113 聚焦协议回归已覆盖成功与失败形状。脱敏真实 probe 只发出 1 次 POST，得到 68 个事件、34 个 summary delta、0 个 raw delta、decoder accepted 与 1 个 finish；因此它验证当前 summary/Search 续跑路径，但不能作为 raw reasoning 真机证据。
- Node `24.19.0` 本地全量测试已通过：238 项、236 pass、0 fail、2 项 Windows-only skip；生产依赖审计为 0 漏洞，dry-run pack 为 71 个文件，生成 bundle、diff 与秘密模式门禁均通过。代码 PR #25 已合入受保护 `yukiryou/main`，merge commit 为 `307ae3ac83526f388c6b4a0d1e1346353bd5f4aa`；main CI run `33302830043` 的 macOS 14 / Windows 2022 均通过。
- 发布证据 PR #26 合入后的最终 release commit 为 `2e5c6dbc8bb83377a4db4d8e31452b3ce96500c5`；其 final CI run [`33303080849`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33303080849) 在 macOS 14 / Windows 2022 全绿。Annotated tag object `353bcd3717d4440ab20a2b05a5e9d51eef22fa7f` peel 到该 release commit。
- 仓库所有者明确授权的唯一 `dsh-grok-provider-0.1.11.tgz` 含 71 个文件、207,022 bytes，unpacked size 为 656,139 bytes；SHA-256 为 `8fca0eca86769ee9febd35606cc8c944a0ae968cec2937a30ccaf68d36d42b2d`，SRI 为 `sha512-2qInRIq5Dkf7CqXq8z1mVvMelStg3nZ1wuWEqsExgfm7iXF0Jn5f7d11IAtHRxdKdJm/j0s8tYT1Dx6IdtGNqg==`。
- GitHub Release 与 Trusted Publisher run [`33303631312`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33303631312) 已完成；npm `latest=0.1.11`，Registry、Release 与本地 tarball 逐字节一致。Registry 精确版本的隔离安装及 Host/client import/export smoke 通过。
- `npm audit signatures` 确认隔离安装图中 9 个包具有已验证 Registry 签名、3 个包具有已验证 attestations；本包公开 npm metadata 包含 1 个 Registry signature、2 个 attestations。SLSA provenance 精确绑定 `release.yml`、`v0.1.11`、release commit 与 Trusted Publisher run。网络可达 Windows 真机外部浏览器弹出仍未完成验收，发布不改变该边界。

## `1.0.0` 候选状态

- 根因已扩展为两个真实上游形状：一个完成的 Search 之后，同一 reasoning ID 不只可能复用一次，而可能继续出现为多个空占位；完成的 `web_search_call` 也可能以 `open_page` 而非 `search` 结束。`0.1.11` 对这两种形状都会把流映射为 `INVALID_RESPONSE`。
- 候选继续失败关闭：原始 reasoning 必须先闭合，首次复用前必须有完成的 server Search；每次复用都必须严格空并收到独立 `response.output_item.done`。`response.incomplete` 不能吞掉尚未闭合的复用段；全部复用段闭合后，后续 max-token 终态仍有效。非空 summary/raw、跨类型、未知 terminal 字段以及 Search item/response container 的 accessor-backed 字段均拒绝。有界 opaque `encrypted_content` 被允许但不会暴露为可见 reasoning。
- 完成态 `open_page` 只允许精确 `{ type: "open_page", url }` 及既有边界内的 URL；streamed 与 final action 的 type/URL 必须相同。Provider 校验后丢弃该 URL，不打开、不预览、不下载、不 replay。
- 最终源码的脱敏真实账号复验已完成：原始 Web/X 协议各完成 1 次、各 64 events，并观察到对应 Search；生产 adapter 共完成 5 次 Responses，direct Web/X 均为 `stop`，Harness 同名 `x_search` 三轮依次为 `tool-calls`、`tool-calls`、`stop`，前两轮各 1 次本地调用。验证记录没有结果、URL、prompt、身份或凭据。
- 上述只证明候选协议方向能完成三类真实流程，不证明 `1.0.0` 已发布，也不替代双平台 CI、OAuth 或 Windows 真机外部浏览器验收。
- 已完成：manifest/lock 精确 `1.0.0`；聚焦 codec 40/40；Node 24 全量 245 项、243 pass、0 fail、2 项平台跳过；生产依赖审计 0 漏洞；确定性 build/bundle、72 项 dry-run pack、秘密模式扫描与 `git diff --check`。
- 代码 PR #28 已合入受保护 `yukiryou/main`，merge commit 为 `7a6364dd58f3c7e9e1ad68a3d0197a14254bcb8c`；main CI run [`33308371009`](https://github.com/yoshino-xiao7/dsh-grok-provider/actions/runs/33308371009) 的 macOS 14 / Windows 2022 均通过。
- 待完成：发布证据 PR 与其 final CI、最终 release commit、唯一 tarball 与摘要/SRI、隔离安装/exports smoke、仓库所有者对该精确制品的明确授权、tag/GitHub Release/Trusted Publisher，以及 Registry 字节/signature/attestation/provenance 回读。

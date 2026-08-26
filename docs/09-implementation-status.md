# 当前实现与发布状态

`0.1.2-rc.1` 已通过 npm `next` 公开分发，用于 Windows x64 登录真机验收；稳定 `latest` 仍为 `0.1.1`。预发行制品、GitHub Release、Registry 回读、签名和 provenance 已验证一致，稳定 `0.1.2` 尚未获得发布授权。

状态日期：2026-08-26
当前发布线：`dsh-grok-provider@0.1.1`
下一版本分支：`yukiryou/v0.1.2`

## 已实现

- 原创 Host provider、固定 Grok Build transport、动态账号模型目录和严格 Responses SSE codec。
- 文本、reasoning、usage、`stop|tool-calls|max-tokens`、函数调用/结果、多轮历史和加密 reasoning replay。
- 官方 CLI 单路径：固定默认路径、版本仅作有界诊断、登录能力探测、受控 cwd/环境、固定 argv、无 shell spawn、10 秒准备期限、5 分钟登录期限、2 分钟退出期限、整棵进程树取消与异步卸载等待；`grok login --oauth` 负责打开浏览器和持久化 token，CLI 退出 0 后插件再次校验生产 OIDC credential schema。`0.1.2` 候选须通过 Windows `0.2.82` 真机验证后才可发布。
- 包中不存在独立 OAuth client identity、device flow、插件实现的 refresh/revoke、Harness credential grant 或模式选择接口；过期 access token 只通过 single-flight、30 秒有界的官方 CLI `models` 命令续期，插件不提取 refresh token、不执行 refresh grant、不写凭据文件。ADR-0003 已由 ADR-0005 取代。
- Web：Harness settings section、中文/英文、loopback-only RPC、登录状态轮询、陈旧 session 防护、取消和二次退出确认；新增参考 Harness 信息层级的账户卡、真实 billing 周期/重置时间和动态模型 capability 卡。完整类型化周期可恢复 proto3 省略的零使用率，其他缺失百分比仍显示未知；renderer 不接触 token 或 identity。
- TUI：闭合 `/grok status|login|cancel|logout` grammar，`recordInput:false`，不输出 CLI 原文或 token。
- 发布构建：`src`、测试和 spike 不进入 tarball；`dist`、类型、bundle patch 与发行文档由确定性脚本生成。`prepack` 强制重建 `dist`，避免直接 `npm pack`/`npm publish` 带入陈旧产物。零普通 runtime dependencies。

## 已验证

- Node 完整构建/测试通过：57 项，55 pass、0 fail、2 项 Windows-only 在 macOS 按预期跳过并由 CI matrix 承接。
- `npm audit --omit=dev`：0 vulnerability。
- 新认证接口的本地候选已安装到隔离的 Harness `0.1.1-rc.2` TUI/Web profile。真实 TUI 的缺失凭据 `unavailable`、`/grok login` 浏览器跳转、官方 CLI 登录成功和有效凭据 `ready` 均通过。真实 Web 的 client bundle 发现、Grok 设置页、登录启动/取消、Host 重启和临时 profile 卸载均通过；rc.2 scanner 所需的 `./package.json` 导出已加入回归测试。
- Web/TUI 的 `available` 现在实际验证官方 credential contract，不再把 credential source 已注册误报为 ready；缺失凭据的真机 Web/TUI 双向验证通过。
- macOS arm64 使用当前 clean-room 代码和本机官方 credential，动态发现 `grok-4.6`、`grok-4.5`；两个模型的首轮流、加密 reasoning 第二轮续接、usage、finish 和 fixture function call 均通过。
- `max_output_tokens` 真机返回 `response.incomplete/max_output_tokens`，已映射为 Harness `max-tokens`。
- macOS 隔离 Harness Web profile 已从当前 `dsh-grok-provider@0.1.0` tarball 安装并验证：设置页真实显示登录状态、`grok-4.6`/`grok-4.5` 上下文与推理档位、流式/tool capability、每周周期和重置时间；手动刷新通过。当前真实账号的 CLI Proxy JSON 省略百分比，而同周期官方移动端显示 `0% 已使用`；解析器现按完整类型化周期恢复为 `0% 已使用 / 100% 剩余`。

## `0.1.0` 发布结果

- GitHub Release 与 npm `0.1.0` 已发布；Registry 重新下载文件与候选 tarball 的 SHA-256/SHA-512 完全一致。
- npm provenance attestation 已生成并回读；canonical repository、name、version 与 SRI 一致。
- npm Trusted Publisher 已绑定 GitHub Actions `release.yml` 与 Environment `npm`，只允许 `npm publish`。
- GitHub `NPM_TOKEN` secret 与 npm 首发 Token 已撤销；包已设置为要求 2FA 并禁止 bypass 2FA token。
- GitHub Release 说明为中文在前、英文在后，且已移除正文重复版本标题。
- 仓库已添加 `dsh-plugin` 与 `dsh` Topics；YukiRyou catalog 已收录精确 `0.1.0` 的 macOS arm64 验证条目。

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

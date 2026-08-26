# 当前实现与发布阻断项

状态日期：2026-08-26
目标包：`dsh-grok-provider@0.1.0`
开发分支：`yukiryou/v0.1.0`

## 已实现

- 原创 Host provider、固定 Grok Build transport、动态账号模型目录和严格 Responses SSE codec。
- 文本、reasoning、usage、`stop|tool-calls|max-tokens`、函数调用/结果、多轮历史和加密 reasoning replay。
- 官方 CLI 单路径：固定默认路径、精确 `1.0.5 (5115b46bc909)`、受控 cwd/环境、固定 argv、无 shell spawn、10 秒准备期限、5 分钟登录期限、2 分钟退出期限、整棵进程树取消与异步卸载等待；`grok login --oauth` 负责打开浏览器和持久化 token，CLI 退出 0 后插件再次校验生产 OIDC credential schema。
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

## 发布阻断项

以下任何一项未关闭都不得执行 `npm publish`：

1. **官方 CLI 完整性**：官方 macOS `1.0.5` 下载物当前无法通过严格代码签名验证，也没有可验证 sidecar signature/checksum；需要 xAI 修复或提供可验证发布机制，或由仓库所有者明确接受该残余供应链风险。
2. **许可/支持依据**：需要 xAI 对第三方本地 adapter 使用 Grok Build session credential 与 CLI Chat Proxy 的书面或公开支持依据，或由仓库所有者明确承担公开发布风险。
3. **发布身份**：需要创建并冻结公开 GitHub canonical repository、配置 provenance workflow/Trusted Publisher、确认 npm 名称仍可用并登录发布身份。
4. **精确候选与回读**：发布前由 macOS 验收、Windows CI 和 publish job 核验同一个 tarball SHA-512；发布后回读 Registry integrity、attestation 和精确版本安装。

Windows x64 真机不再是 `0.1.0` 预发布阻断项。首次发布后必须从 Registry 安装精确 `0.1.0`，完成官方安装物 Authenticode/hash、浏览器登录、取消/超时/卸载、动态全部模型、聊天、reasoning replay、工具调用和 production inspector；完成前对 Windows 保持“代码支持、真机未验证”标识。`0.1.1` 及后续版本不要求重复真机验证，以两平台 CI、契约测试、干净安装和制品校验作为常规门禁。

当前结论是“核心实现可继续审计与集成”，不是“已具备发布条件”。

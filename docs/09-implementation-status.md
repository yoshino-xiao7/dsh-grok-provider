# 当前实现与发布阻断项

状态日期：2026-08-26
目标包：`dsh-grok-provider-yukiryou@0.1.0`
开发分支：`yukiryou/v0.1.0`

## 已实现

- 原创 Host provider、固定 Grok Build transport、动态账号模型目录和严格 Responses SSE codec。
- 文本、reasoning、usage、`stop|tool-calls|max-tokens`、函数调用/结果、多轮历史和加密 reasoning replay。
- `official-cli`：固定默认路径、精确 `1.0.5 (5115b46bc909)`、受控 cwd/环境、固定 argv、无 shell spawn、10 秒准备期限、5 分钟登录期限、2 分钟退出期限、整棵进程树取消与异步卸载等待；CLI 退出 0 后再次校验生产 OIDC credential schema。
- `managed-device`：RFC 8628 polling、固定 xAI endpoints、公开 DTO/私有 device code 分离、Harness credential grant、五分钟提前刷新、refresh-token rotation、原子 refresh、revocation marker、revoke/delete 与失败恢复。
- Web：Harness settings section、中文/英文、loopback-only RPC、模式选择、登录、轮询、陈旧 session 防护、取消和二次退出确认；renderer 不接触 token。
- TUI：闭合 `/grok status|use|login|cancel|logout` grammar，`recordInput:false`，不输出 CLI 原文或 token。
- 发布构建：`src`、测试和 spike 不进入 tarball；`dist`、类型、bundle patch 与发行文档由确定性脚本生成。`prepack` 强制重建 `dist`，避免直接 `npm pack`/`npm publish` 带入陈旧产物。零普通 runtime dependencies。

## 已验证

- Node `24.19.0` 完整构建/测试通过：52 项，50 pass、0 fail、2 项 Windows-only 在 macOS 按预期跳过并由 CI matrix 承接。
- `npm audit --omit=dev`：0 vulnerability。
- 真实 tarball 已由 `prepack` 现场重建，0 bundled dependencies；在空临时目录以 `--ignore-scripts` 安装成功，Host 导出与 Web module-loader registration 均可加载。最终候选 SHA-512 只能记录在包外的 release evidence，不能嵌入 tarball 形成自引用。该证据尚不等于完整 Harness profile 集成验收。
- 该 tarball 已由隔离 `DSH_HOME` 下的官方 `@deepseek-ai/dsh@0.1.1-rc.2` CLI 安装到 TUI profile；插件被识别为 bundle，配置组合精确插入 `llm-grok` 与 `authMode: official-cli`。npm 默认 peer 求解在约 2 GiB 堆上 OOM，Harness 自用的 pnpm `10.34.5` 可完成安装。应用级 TUI `--help` 进入交互生命周期且无输出后被取消，因此尚不能据此宣称完整 TUI 启停验收通过。
- macOS arm64 使用当前 clean-room 代码和本机官方 credential，动态发现 `grok-4.6`、`grok-4.5`；两个模型的首轮流、加密 reasoning 第二轮续接、usage、finish 和 fixture function call 均通过。
- `max_output_tokens` 真机返回 `response.incomplete/max_output_tokens`，已映射为 Harness `max-tokens`。

## 发布阻断项

以下任何一项未关闭都不得执行 `npm publish`：

1. **managed OAuth 授权**：xAI discovery 没有动态 client registration，官方 docs sitemap 未发现第三方 public client 注册入口；需要 xAI 明确授权给本包的独立 client ID/device contract。
2. **官方 CLI 完整性**：官方 macOS `1.0.5` 下载物当前无法通过严格代码签名验证，也没有可验证 sidecar signature/checksum；需要 xAI 修复或提供可验证发布机制。
3. **许可/支持依据**：需要 xAI 对第三方本地 adapter 使用 Grok Build session credential 与 CLI Chat Proxy 的书面或公开支持依据。
4. **Windows x64 真机**：需要同一候选 tarball 上完成官方安装物 Authenticode/hash、浏览器登录、取消/超时/卸载、动态全部模型、聊天、reasoning replay 和工具调用。
5. **完整 Harness 安装**：需要从候选 tarball 在干净 rc.2 profile 验证 Host、TUI、Web settings、bundle patch、重启与卸载。
6. **发布身份**：需要创建并冻结公开 GitHub canonical repository、配置 provenance workflow/Trusted Publisher、确认 npm 名称仍可用并登录发布身份。
7. **双平台同字节候选**：macOS arm64 与 Windows x64 必须核验同一个 tarball SHA-512；发布后回读 Registry integrity、attestation、精确版本安装和生产 inspector。

当前结论是“核心实现可继续审计与集成”，不是“已具备发布条件”。

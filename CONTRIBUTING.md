# 贡献指南 / Contributing Guide

感谢你帮助改进 `dsh-grok-provider`。项目优先保证凭据安全、协议准确和跨平台可维护性；小而可验证的变更比同时扩展多个边界的大改动更容易合并。

## 提交问题

提交 Bug 前请先确认问题在受支持版本中可复现，并提供：

- 操作系统与架构；
- `dsh`、Node.js、Grok CLI 和本插件的精确版本；
- 最小复现步骤、预期行为与实际行为；
- 已脱敏的错误码或必要日志片段；
- 问题发生在 Web、TUI 还是 headless profile。

不要提交 `auth.json`、access/refresh token、`user_id`、邮箱、姓名、完整提示词、工具参数、私人路径或未经检查的诊断包。安全问题遵循 [`SECURITY.md`](SECURITY.md)，不要开公开 Issue。

## 变更流程

1. 阅读 [`docs/README.md`](docs/README.md)、[能力路线图](docs/11-capability-roadmap.md) 和与改动相关的 ADR。
2. 先写或更新测试，保持变更范围单一。内容类型必须落在当前版本切片内，不得把搜索或生图并进图片输入版本。
3. 认证、凭据、固定 endpoint、模型协议或发布边界变化时，先更新 ADR、威胁模型和测试计划。公开协议可以驱动隔离原型，但新内容类型在对外声明、合并发布基线或制作候选包前必须完成固定 CLI Chat Proxy 的脱敏 spike。
4. 同步维护 `README.md` 与 `README.en.md` 的用户可见信息。
5. 运行验证：

```sh
npm ci --ignore-scripts
npm test
npm run pack:check
```

发布维护者还必须逐项完成 [`docs/10-release-checklist.md`](docs/10-release-checklist.md)。检查表全绿不代表可以自行发布；合并发布基线、创建 tag、GitHub Release 或 npm 版本前仍需仓库所有者明确授权。

## Pull Request 检查表

- [ ] 变更解决一个清晰的问题，没有无关重构或格式化噪音；
- [ ] 新行为有针对性测试，错误路径失败关闭；
- [ ] 没有新增 token、账号数据、真实响应、机器路径或日志 fixture；
- [ ] 没有增加普通 runtime dependency；如确有必要，PR 解释原因、体积与供应链影响；
- [ ] 中英文 README、CHANGELOG 和相关 `docs/` 已同步；
- [ ] `npm test` 与 `npm run pack:check` 通过；
- [ ] Windows 专用行为有自动化覆盖，并清楚标注是否完成真机验证。

## 设计原则

- 内容类型按 [`docs/11-capability-roadmap.md`](docs/11-capability-roadmap.md) 分版本引入，不把未排期能力混进当前切片。
- 模型能力来自动态目录，不通过隐藏未知模型制造“全部支持”的假象。
- Renderer、RPC 与错误信息不接触凭据或身份数据。
- 只允许固定官方网络目标，拒绝用户配置任意 base URL 和认证重定向。
- 使用官方 CLI 的登录与持久化，不复制 refresh token 或实现第二套 OAuth 存储。
- 未知协议和不完整数据保持未知或失败关闭，不猜测安全关键值。

---

English summary: include exact versions, a minimal reproduction, and redacted diagnostics in bug reports. Never post credentials or personal data. Keep PRs focused, add tests first, follow the capability roadmap so content-type slices stay on their assigned versions, update design/security documents for boundary changes, keep both READMEs synchronized, and run `npm test` plus `npm run pack:check` before submission.

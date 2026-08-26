# ADR-0007：以能力与凭据契约判断 Grok CLI 兼容性

- 状态：Accepted
- 日期：2026-08-26
- 修订：ADR-0005 中“精确版本约束”的部分；官方 CLI 单一路线保持不变

## 背景

`0.1.1` 在每次认证动作前把 `grok --version` 的完整输出与
`grok 1.0.5 (5115b46bc909)` 做逐字匹配。Windows 真机安装的官方 Grok Build CLI
`0.2.82` 能正常执行 `grok login --oauth`，但插件在版本检查阶段提前失败，浏览器因此不会打开。

完整版本字符串只能说明一个构建标识，不能证明命令能力、凭据来源或服务端协议兼容性。把它作为唯一门禁还会让官方 CLI 的兼容更新无条件破坏登录。

## 决定

从 `0.1.2` 起，不再维护 Grok CLI 完整版本 allowlist。认证模块保留小接口
`login`、`logout`、`refresh`，并在内部完成以下检查：

1. 只解析官方默认 `~/.grok/bin/grok` 或 `%USERPROFILE%\.grok\bin\grok.exe`；继续校验绝对路径、realpath、普通文件、所有者/目录包含关系和 Windows reparse point。
2. `grok --version` 必须在期限与输出上限内成功，并返回单行、可安全显示为诊断信息的 `grok ...` 文本；版本值不再决定兼容性。
3. 登录前执行固定的 `grok login --help` 能力探测；只有成功返回独立的 `--oauth` 选项后，才允许执行固定 argv `grok login --oauth`。
4. 所有命令继续通过 Harness subprocess seam、绝对 argv、固定 cwd、过滤环境、无插件显式 shell、输出上限、deadline 与进程树等待执行。插件不解析或转发 OAuth URL。
5. CLI 退出成功不等于登录成功。认证 driver 必须重新读取官方凭据，并只接受 xAI 生产 issuer、官方 public client、`oidc` 模式、有效 access token/expiry 和无歧义候选。API key、external provider、企业 OIDC、自定义 endpoint 与不完整记录继续失败关闭。
6. 模型、额度与推理仍由固定 HTTPS origin/path 及严格响应 codec 校验。未知 CLI 版本不能放宽这些网络约束。

`logout` 与 `models` 保持固定命令；未知版本若不支持它们，会以非零退出安全失败，不回退到其他命令或 shell。未来若命令语义发生变化，新增相应能力探测和契约测试，而不是恢复完整版本硬锁。

## 安全含义

- “不固定版本”不等于信任 PATH 中任意 `grok`，也不等于接受任意 OAuth 凭据；可执行文件、命令能力、凭据契约和固定服务端校验缺一不可。
- `login --help` 是兼容性探测，不是发布者或签名证明。用户仍须从 xAI 官方渠道安装 CLI。
- 官方 `grok login` 会重新认证并替换共享缓存会话，`grok logout` 会清除该会话；这会影响共用同一 Grok home 的其他应用。UI 必须在登录和退出前披露该副作用。
- 新字段可在不改变已验证语义时被忽略；认证模式、issuer、client、候选唯一性、token 与 expiry 等安全关键字段必须继续闭合校验。

## 发布门禁

- 自动化测试必须覆盖 macOS `1.0.5` 与 Windows `0.2.82` 的真实版本输出形状。
- 必须覆盖：能力存在时进入 `login --oauth`；能力缺失、版本输出畸形、命令超时/超限/非零退出时不进入登录动作。
- `0.1.2` 改动 Windows 登录安全路径，因此发布前需要 Windows x64 真机从候选包完成浏览器登录、凭据复验、模型刷新与一次最小对话。未经仓库所有者验收和明确发布授权，不得发布 npm 版本。


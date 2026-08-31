# ADR-0011：有界认证恢复与部分流保留

- 状态：Accepted
- 日期：2026-08-31
- 适用版本：`1.0.3`

## 背景

真实 Harness 会话出现了两个不同故障。一次请求在发送约两分钟后返回 401；当时本地官方 OIDC 凭据仍满足结构和期限校验，同一凭据随后访问模型目录成功。另一次请求已经收到首批 SSE 内容，之后约 318 秒没有新事件并以无 HTTP 状态的 transport failure 结束。Harness 分别把它们显示为通用的 “API key is invalid” 和 “The Grok Build request failed”，不足以指导恢复。

Provider 不拥有 refresh token，也不能把可能已经执行工具或产生远端副作用的 POST 任意重放。

## 决定

### 流开始前的认证拒绝

- 固定 Grok Build 请求若在读取响应体前得到 401/403，可调用一次 credential source 的恢复能力。
- 恢复只运行官方 CLI 的固定、有界 `grok models` 路径；插件不读取 refresh token、不实现 refresh grant，也不修改凭据文件。
- 恢复后重新读取并校验官方凭据，再重试原请求一次。第二次 401/403 仍映射为 `AUTH`。
- 同一 credential revision 的并发拒绝共享一个 single-flight refresh；已观察到新 revision 的调用不得重复刷新。
- 只有原始 HTTP 响应尚未进入 200/SSE 消费边界时才允许这次重试。

### 流开始后的连接中断

- 一旦 200 响应开始产生 SSE chunk，Provider 永不自动重放请求。
- Responses transport 使用两分钟连续无 wire byte 的空闲 deadline；每个原始字节 chunk 都会刷新计时。超时只中止当前连接，不触发重放。
- 若 transport failure 或干净的过早 EOF 发生前只出现有界的 text/reasoning chunk，且没有工具调用、unknown chunk 或 finish，则关闭已打开的可见 block，保留收到的内容，追加不含上游正文的双语中断提示，并以本地 stop 完成。提示要求用户明确发送“继续”。
- 任一工具调用、未知 chunk、畸形事件、协议状态错误、用户取消、没有安全可见内容或部分内容超限时，继续按既有规则失败关闭。
- `decoder.finish()` 发现的干净过早 EOF 使用专用错误类型；`decoder.push()` 发现的畸形或不支持事件仍为 `INVALID_RESPONSE`，不得被部分保留逻辑吞掉。

## 安全与隐私

恢复逻辑不记录 token、OIDC claim、身份、URL、prompt、工具参数、响应正文或原始事件。部分保留只处理已经准备投影给 Harness 的 text/reasoning chunk，并设置 8 MiB 的单块上限。它不生成 replay metadata，不把远端 Search 伪装成本地工具，也不改变固定 origin、模型、图片、Search 或权限边界。

## 验证边界

fixture 回归证明一次恢复、持续拒绝、并发 single-flight、流开始后不重试、空闲 deadline、安全文本/reasoning 中断保留、干净 EOF 和部分工具调用失败关闭。真实账户正常请求只能证明当前网络与账号的成功路径；无法证明未来的 401、长时间断流或 Windows 外部浏览器行为。

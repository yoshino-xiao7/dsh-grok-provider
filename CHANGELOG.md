# Changelog

## 0.1.0 - Unreleased

- Clean-room Grok Build provider for DeepSeek Harness `0.1.1-rc.2`.
- Dynamic discovery of every account-visible Responses model.
- Streaming text, reasoning, encrypted reasoning replay, tools, usage, and finish reasons.
- Official Grok CLI browser OAuth on macOS arm64 and Windows x64; the CLI owns token persistence.
- Single authentication path with no embedded OAuth client identity, client secret, or plugin-managed refresh token.
- Single-flight renewal delegates expired official credentials to the verified Grok CLI `models` command; the plugin never executes an OAuth refresh grant itself.
- Loopback-only Web settings and a closed `/grok` TUI command surface.

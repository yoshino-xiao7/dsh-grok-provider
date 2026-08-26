# Changelog

## Unreleased

- Correct post-release status across the Simplified Chinese and English READMEs, security policy, and maintainer documentation.
- Replace the one-off token-based publication path with a reusable npm Trusted Publisher OIDC workflow.
- Record GitHub `dsh-plugin` discovery and the exact `0.1.0` YukiRyou catalog entry for macOS arm64.
- Add a mandatory release checklist so documentation, bilingual release notes, credentials, artifacts, and Registry readback are complete before publication.

## 0.1.0 - 2026-08-26

- Clean-room Grok Build provider for DeepSeek Harness `0.1.1-rc.2`.
- Dynamic discovery of every account-visible Responses model.
- Streaming text, reasoning, encrypted reasoning replay, tools, usage, and finish reasons.
- Official Grok CLI browser OAuth on macOS arm64 and Windows x64; the CLI owns token persistence.
- Single authentication path with no embedded OAuth client identity, client secret, or plugin-managed refresh token.
- Single-flight renewal delegates expired official credentials to the verified Grok CLI `models` command; the plugin never executes an OAuth refresh grant itself.
- Loopback-only Web settings and a closed `/grok` TUI command surface.
- Responsive Web account dashboard with live Grok Build billing-period reset data and dynamic model capability cards; complete typed periods recover proto3-omitted zero usage while ambiguous missing percentages remain unknown.
- Community-oriented Simplified Chinese default `README.md` and English `README.en.md`, plus contribution and private security-reporting guidance; all are included in the npm artifact.
- Windows x64 code path is included but remains real-device unverified until the documented post-release `0.1.0` validation.
- Export package metadata for the Harness rc.2 Web client-module scanner and report credential readiness only after validating the official credential source.

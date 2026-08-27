# dsh-grok-provider

[简体中文](README.md) | [English](README.en.md)

Use an already authenticated official Grok Build account from DeepSeek Harness, with dynamic model discovery, streaming reasoning, tool calls, and an account quota/model capability dashboard.

> Unofficial community project; not affiliated with xAI or DeepSeek Harness. The current stable version is `0.1.3`. The project no longer publishes prereleases; stable defects are fixed in a new incremented stable version.

## What it provides

| Capability | Current implementation |
| --- | --- |
| Sign-in | Invokes official `grok login --oauth`; the plugin does not implement an OAuth grant |
| Credentials | Reuses official CLI session state without creating a second token store |
| Models | Discovers every model visible to the account at runtime; no static model allowlist |
| Conversations | Streaming Responses text, reasoning, encrypted reasoning replay, usage, and finish reasons |
| Tools | Returns function calls to the Harness permission layer; the provider never executes tools |
| Account dashboard | Login status, weekly/monthly quota, reset time, dynamic model capabilities and reasoning efforts |
| Surfaces | Bilingual Web settings and a closed `/grok` TUI command set |

## Quick start

### 1. Prerequisites

- DeepSeek Harness `0.1.1-rc.2`
- Node.js `24.19.0` or newer
- macOS arm64 or Windows x64
- Official Grok Build CLI with `login --oauth` support and the default Grok home

Install the CLI from the [official Grok Build documentation](https://docs.x.ai/build/overview), then verify:

```sh
grok --version
grok models
```

The official CLI opens a browser on first use. The provider supports only the official default `~/.grok` directory (`%USERPROFILE%\.grok` on Windows).

### 2. Install the provider

Install the published exact version from npm:

```sh
dsh plugin --profile web add dsh-grok-provider@0.1.3
dsh web
```

### 3. Sign in and select a model

Open **Settings → Grok Build**:

1. Select “Sign in with Grok.”
2. Complete authorization in the page opened by the official Grok CLI.
3. Return to Harness and refresh the account dashboard.
4. Select any account-visible Grok model from the model picker.

The provider does not take over the login page or ask you to paste an access or refresh token.

## User surfaces

The Web settings page shows:

- login state and sign-in, cancel, and logout actions;
- used/remaining quota and the real billing-period reset time;
- account-visible models, context windows, reasoning efforts, streaming and tool capabilities.

When protobuf-backed billing includes a complete weekly/monthly period but omits a zero-valued percentage, the page restores “0% used / 100% remaining.” Other incomplete responses remain unknown.

TUI commands:

```text
/grok status
/grok login
/grok cancel
/grok logout
```

These commands never enter model context. Logout requires confirmation because it invokes official `grok logout` and affects other clients sharing the same Grok home.

## Update and uninstall

Update an installed version:

```sh
dsh plugin --profile web update dsh-grok-provider
dsh web
```

Uninstall:

```sh
dsh plugin --profile web remove dsh-grok-provider
dsh web
```

Uninstalling the provider does not remove the official Grok CLI or directly modify/delete `auth.json`.

## Sources and discovery

- Exact npm version: [dsh-grok-provider@0.1.3](https://www.npmjs.com/package/dsh-grok-provider/v/0.1.3)
- GitHub release and integrity values: [v0.1.3](https://github.com/yoshino-xiao7/dsh-grok-provider/releases/tag/v0.1.3)
- GitHub community discovery: the repository carries the DeepSeek Harness-recommended `dsh-plugin` and `dsh` topics
- YukiRyou managed source: [deepseek-yukiryou-plugin-catalog](https://github.com/yoshino-xiao7/deepseek-yukiryou-plugin-catalog), following the exact verified stable version and currently marking only verified macOS arm64

Directory inclusion is not an endorsement by xAI or DeepSeek Harness. The public curated directory still requires its repository-age gate and independent maintainer review.

## Compatibility and scope

| Item | `0.1.3` status |
| --- | --- |
| DeepSeek Harness | Exact support for `0.1.1-rc.2` |
| Node.js | `>=24.19.0` |
| macOS arm64 | Real-network and isolated Harness acceptance completed |
| Windows x64 | Code and Windows CI supported; no independent real-device acceptance completed for this release |
| macOS x64 / Linux | Unsupported |
| Grok CLI | No full-version lock; official path, `login --oauth` capability, and production OIDC credential contract are enforced |
| Models | Every account catalog model whose backend has a strict codec in this release |

The initial release excludes image input, Web/X Search, arbitrary downloads, API-key mode, multiple accounts, enterprise OIDC, ACP, and Headless agent wrapping. See the complete [product requirements](docs/01-product-requirements.md).

## How it works

```text
Harness UI / TUI
       │ closed actions and redacted DTOs only
       ▼
dsh-grok-provider Host
       ├── Official Grok CLI: login / models / logout
       ├── Pinned Models/Billing endpoints: catalog and quota
       └── Pinned Responses endpoint: streamed inference
                    │
                    ▼
              xAI Grok Build
```

Model IDs come from the runtime catalog rather than a hardcoded list. If an account exposes a new backend that cannot be mapped safely, discovery fails closed instead of hiding the model and claiming complete support.

## Security and privacy

- Model, catalog, and billing requests allow only compile-time pinned HTTPS origins/paths and reject redirects.
- Renderer and RPC code never receive tokens, `user_id`, credential paths, arbitrary URLs, or raw upstream responses.
- The Host must perform a bounded read of the official `auth.json`, whose raw file may contain a refresh token. The parser does not use, cache, or persist that refresh token; it retains only validation metadata and a short-lived access-token lease.
- The provider does not implement a refresh grant. Near expiry it may invoke one bounded official `grok models`, then reread and revalidate the official credential file.
- Login subprocesses use fixed argv, a scrubbed environment, output limits, deadlines, cancellation, and no shell.
- Prompts and tool results are sent to the xAI Grok Build service; the provider itself does not log them.

See the full [threat model](docs/03-security-threat-model.md). For vulnerabilities, read the [security policy](SECURITY.md) and never post tokens, `auth.json`, personal data, or full diagnostic logs in a public issue.

## Troubleshooting

### “Grok CLI not found”

Confirm the official CLI is in its default location and run `grok --version`. The provider will not load an executable from PATH, the workspace, or a UI-selected arbitrary path.

### The page asks you to sign in again

Use the settings button or run `grok login --oauth` in a terminal. The provider does not lock the complete CLI version, but fails closed when the path, `--oauth` capability, or production OIDC credential contract does not match.

### A model is missing

Run `grok models` and verify that the same account can see it. The provider returns every valid catalog record; an unknown backend fails discovery rather than being silently filtered.

### Why is quota percentage unknown?

A protobuf-omitted zero is restored only with a complete typed period. In every other case the upstream response lacks enough information, so the provider preserves “unknown.” OAuth token expiry is never shown as a quota reset.

### An existing conversation fails immediately after switching from another model to Grok

Versions through `0.1.2` could not convert some third-party tool-call histories containing special characters, notably `|` in Ark call IDs. Update to `0.1.3`; it preserves call/result correlation while safely mapping incompatible historical IDs before sending the request to Grok.

### Does Windows work?

Windows x64 code and CI coverage are present. Ordinary later stable fixes do not repeat real-device acceptance; changes to authentication, the Harness subprocess seam, or platform security policy still require targeted validation.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run pack:check
```

The package has zero ordinary runtime dependencies; Harness services are exact peer dependencies. `npm run build` creates disposable `dist/` artifacts. The npm tarball excludes `src/`, tests, spikes, and local evidence.

Project map:

- [`docs/README.md`](docs/README.md): design-document index and current decisions;
- [`docs/04-harness-contract.md`](docs/04-harness-contract.md): Harness integration contract;
- [`docs/05-test-plan.md`](docs/05-test-plan.md): platform, security, and release gates;
- [`docs/09-implementation-status.md`](docs/09-implementation-status.md): implementation and acceptance status;
- [`CHANGELOG.md`](CHANGELOG.md): version history.

Read the [contributing guide](CONTRIBUTING.md) before filing an issue or PR. Changes to authentication, transport, credential formats, or release boundaries must update the relevant ADR/threat model before implementation and tests.

## Roadmap

- [x] Official CLI browser login, dynamic model catalog, and Responses streaming
- [x] Web/TUI account controls, quota dashboard, and model capability display
- [x] Publish `0.1.0` and verify Registry integrity/provenance
- [x] Configure npm Trusted Publisher, revoke the initial token, and add `dsh-plugin` discovery plus the YukiRyou catalog entry
- [x] Publish the `0.1.1` documentation and release-process correction
- [x] Publish the `0.1.2` Windows CLI compatibility correction
- [x] Prepare the `0.1.3` cross-provider tool-history compatibility correction
- [ ] Complete independent Windows x64 acceptance and publish a later stable fix if needed
- [ ] Evaluate additional content types and platforms only against verified Harness/xAI contracts

The roadmap is not a compatibility promise; every new capability must pass the documented design and security gates.

## License

[MIT](LICENSE)

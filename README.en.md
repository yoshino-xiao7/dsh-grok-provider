# dsh-grok-provider

[简体中文](README.md) | [English](README.en.md)

Use an already authenticated official Grok Build account from DeepSeek Harness, with dynamic model discovery, streaming reasoning, image input, optional Web/X Search, tool calls, and an account quota/model capability dashboard.

> Unofficial community project; not affiliated with xAI or DeepSeek Harness. The current source candidate is `0.1.11`; the current stable release and npm Registry `latest` are both `0.1.10`. Published `0.1.10` repaired Web/X Search settings registration, but real use later found that `grok-4.6` at High Effort can hit a generic invalid-response error while continuing after Web Search because of a reasoning-lifecycle compatibility gap; unpublished `0.1.11` is the focused protocol repair. Version `0.1.8` was published and then withdrawn and cannot be reused. The project no longer publishes prereleases; stable defects are fixed in a new incremented stable version.

## What it provides

| Capability | Current implementation |
| --- | --- |
| Sign-in | Invokes official `grok login --oauth`; the official CLI owns sign-in URL generation and external-browser launch, while the plugin does not implement an OAuth grant |
| Credentials | Reuses official CLI session state without creating a second token store |
| Models | Discovers every model visible to the account at runtime; no static model allowlist |
| Conversations | Streaming Responses text, reasoning, encrypted reasoning replay, usage, and finish reasons |
| Images | Only exact `grok-4.6` accepts bounded JPEG/PNG images from Harness attachments; `grok-4.5` and all other models remain text-only |
| Search | `0.1.10` provides independent, default-off Web Search and X Search for exact `grok-4.6`; the `0.1.11` candidate repairs the High Effort + Web Search reasoning-continuation lifecycle, while remote lifecycles are never misrepresented as local tools |
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

When the network is reachable and OIDC discovery succeeds, the official CLI opens a browser on first use. The provider supports only the official default `~/.grok` directory (`%USERPROFILE%\.grok` on Windows).

### 2. Install the provider

`0.1.11` is not published yet. After it is published and read back from the Registry, install that exact version from npm:

```sh
dsh plugin --profile web add dsh-grok-provider@0.1.11
dsh web
```

### 3. Sign in and select a model

Open **Settings → Grok Build**:

1. Select “Sign in with browser.”
2. Complete authorization in the page opened by the official Grok CLI.
3. Return to Harness and refresh the account dashboard.
4. Select any account-visible Grok model from the model picker.

The provider does not take over the login page or ask you to paste an access or refresh token.

## User surfaces

The Web settings page shows:

- login state, Provider/Grok Build CLI versions, and sign-in, cancel, and logout actions;
- the official installation link and “Check again” recovery when the CLI is missing or invalid;
- used/remaining quota and the real billing-period reset time;
- account-visible models, context windows, reasoning efforts, and image-input, streaming, and tool capabilities.
- independent, default-off Web Search and X Search settings with nearby remote-query, additional-usage, citation, and prompt-injection disclosures.

When protobuf-backed billing includes a complete weekly/monthly period but omits a zero-valued percentage, the page restores “0% used / 100% remaining.” Other incomplete responses remain unknown.

Harness `0.1.1-rc.2` does not expose an icon field on `settings.section`. The Provider embeds the MIT-licensed `IconThinkOutline16` path geometry from `@deepseek-ai/dsh-client-ui-primitives@0.1.0-rc.7` and displays it only when the `Grok Build` label and settings-dialog DOM structure produce one exact match; otherwise it safely keeps the Host gear. The compatibility observer, marker, and style are all removed when the plugin unloads.

## Plugin preview

Select a preview to view the full-size image.

<table>
  <tr>
    <td colspan="3" width="50%" valign="top" align="center">
      <a href=".github/assets/plugin-preview/image-input.png"><img src=".github/assets/plugin-preview/image-input.png" alt="Grok 4.6 analyzing an image attached to a Harness conversation" width="100%"></a><br>
      <sub><strong>Image input</strong> — Grok 4.6 analyzes Harness attachments directly</sub>
    </td>
    <td colspan="3" width="50%" valign="top" align="center">
      <a href=".github/assets/plugin-preview/model-picker.png"><img src=".github/assets/plugin-preview/model-picker.png" alt="Selecting Grok 4.6 or Grok 4.5 in the DeepSeek Harness model picker" width="100%"></a><br>
      <sub><strong>Model selection</strong> — Choose Grok 4.6 or Grok 4.5 based on account capabilities</sub>
    </td>
  </tr>
  <tr>
    <td colspan="4" width="66.67%" valign="top" align="center">
      <a href=".github/assets/plugin-preview/grok-context.png"><img src=".github/assets/plugin-preview/grok-context.png" alt="Context statistics and tool calls for a Grok 4.6 conversation" width="100%"></a><br>
      <sub><strong>Conversation context</strong> — Inspect context statistics and tool calls</sub>
    </td>
    <td colspan="2" width="33.33%" valign="top" align="center">
      <a href=".github/assets/plugin-preview/account-dashboard.png"><img src=".github/assets/plugin-preview/account-dashboard.png" alt="Grok Build account quota, reset time, and dynamic model capabilities" width="100%"></a><br>
      <sub><strong>Account dashboard</strong> — Quota, reset time, and dynamic model capabilities</sub>
    </td>
  </tr>
</table>

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

- Current npm stable release: [dsh-grok-provider@0.1.10](https://www.npmjs.com/package/dsh-grok-provider/v/0.1.10) (unique artifact, dual-platform CI, signatures, and provenance verified; known High Effort + Web Search reasoning-compatibility defect)
- Most recent GitHub release and integrity values: [v0.1.10](https://github.com/yoshino-xiao7/dsh-grok-provider/releases/tag/v0.1.10)
- GitHub community discovery: the repository carries the DeepSeek Harness-recommended `dsh-plugin` and `dsh` topics
- YukiRyou managed source: [deepseek-yukiryou-plugin-catalog](https://github.com/yoshino-xiao7/deepseek-yukiryou-plugin-catalog), still pinned to the real-device-accepted `dsh-grok-provider@0.1.0` and marking only `darwin-arm64`

Directory inclusion is not an endorsement by xAI or DeepSeek Harness. [Listing PR #3415](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/3415) has added the project to the public `awesome-dsh-plugin` `model` category. That directory is repository-level discovery and carries no exact npm-version or platform-acceptance claim.

## Compatibility and scope

| Item | `0.1.10` stable / `0.1.11` candidate status |
| --- | --- |
| DeepSeek Harness | Exact support for `0.1.1-rc.2` |
| Node.js | `>=24.19.0` |
| macOS arm64 | Image sending has real-Harness confirmation; focused `0.1.11` reasoning regressions and a redacted real summary/Search probe pass, while the final artifact and candidate macOS 14 CI remain pending |
| Windows x64 | Existing code, slow fakes, and `0.1.10` Windows 2022 CI pass; final `0.1.11` candidate CI remains pending. On a reachable network the official CLI generates the URL and opens the browser, and that path still lacks real-device Windows acceptance |
| macOS x64 / Linux | Unsupported |
| Grok CLI | No full-version lock; official path, `login --oauth` capability, and production OIDC credential contract are enforced |
| Models | Every account catalog model whose backend has a strict codec in this release |

`0.1.11` preserves the published image boundary: image input is enabled only for exact `grok-4.6`, while `grok-4.5` and every other dynamically discovered model remain text-only. Image sending has been confirmed in a real Harness conversation. Images must be verified JPEG/PNG projections from the Harness attachment service. Ordinary user content and images nested one level inside a tool result are supported with fixed `detail:"high"`; URLs, filesystem paths, file IDs, and caller-supplied data URLs are rejected. Private reasoning in ordinary user/system history is omitted while adjacent visible text remains ordered.

Each projected image is limited to 4 MiB, 16,777,216 pixels, and 8192px per side. A request retains at most eight images and 8 MiB of projected image bytes. When a limit is exceeded, the globally oldest images are offloaded to Harness text placeholders; the final JSON remains capped at 16 MiB.

Published `0.1.10` registers and persists both Search settings through the canonical Harness settings module; each new call reads the latest value once before model discovery, while prepared and in-flight calls keep their original snapshot. Real use later found that exact `grok-4.6` at High Effort may close a reasoning item, complete Search, and then reuse the same ID once as an empty placeholder, which the old decoder rejected. The `0.1.11` candidate permits that strictly empty one-time reuse only when a completed Search lies between the two reasoning lifecycles and adds the official raw `reasoning_text` lifecycle. Raw and summary modes are mutually exclusive; replay metadata does not retain raw plaintext, later requests send only `encrypted_content` with an empty summary, and live raw deltas remain visible to Harness as reasoning output. A redacted real probe observed 34 summary deltas and zero raw deltas, so it verifies only the summary/Search path; raw reasoning remains fixture-verified. Search stays default-off and limited to exact `grok-4.6`; remote activity is not projected as a local tool, and citation URLs are never opened or downloaded. Search results are untrusted remote data, so verify sources before commands or file changes. Image generation, arbitrary downloads, API-key mode, multiple accounts, enterprise OIDC, ACP, and Headless agent wrapping remain out of scope; see the [capability roadmap](docs/11-capability-roadmap.md).

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

Model IDs come from the runtime catalog rather than a hardcoded list. Image modality is enabled only for exact model IDs backed by separate protocol and live evidence. If an account exposes a new backend that cannot be mapped safely, discovery fails closed instead of hiding the model and claiming complete support.

## Security and privacy

- Model, catalog, and billing requests allow only compile-time pinned HTTPS origins/paths and reject redirects.
- Renderer and RPC code never receive tokens, `user_id`, credential paths, arbitrary URLs, or raw upstream responses.
- The Host must perform a bounded read of the official `auth.json`, whose raw file may contain a refresh token. The parser does not use, cache, or persist that refresh token; it retains only validation metadata and a short-lived access-token lease.
- The provider does not implement a refresh grant. Near expiry it may invoke one bounded official `grok models`, then reread and revalidate the official credential file.
- Login subprocesses use fixed argv, a scrubbed environment, output limits, deadlines, cancellation, and no shell.
- Prompts, tool results, image projections selected for a request, and Search queries when enabled are sent to the xAI Grok Build service; the provider itself does not log that content, source images, projected bytes, or citation URLs.

See the full [threat model](docs/03-security-threat-model.md). For vulnerabilities, read the [security policy](SECURITY.md) and never post tokens, `auth.json`, personal data, or full diagnostic logs in a public issue.

## Troubleshooting

### “Grok CLI not found”

Install Grok Build CLI from the official link shown on the page, then click “Detect again.” Confirm that the CLI is in its default location and run `grok --version`. The provider does not install the CLI automatically and will not load an executable from PATH, the workspace, or a UI-selected arbitrary path. The settings page displays both the provider and verified CLI versions.

### The page asks you to sign in again

Use the settings button or run `grok login --oauth` in a terminal. The provider does not lock the complete CLI version, but fails closed when the path, `--oauth` capability, or production OIDC credential contract does not match.

### The browser does not open after clicking sign-in on Windows

Run the official CLI directly first:

```powershell
& "$env:USERPROFILE\.grok\bin\grok.exe" login --oauth
```

If it times out at `auth.x.ai/.well-known/openid-configuration`, the failure occurs before a sign-in URL is generated; it is not a broken Provider browser button. Check Windows DNS, outbound HTTPS, firewall, VPN, and proxy settings—especially when the browser uses PAC/system proxy but the CLI process has no `HTTPS_PROXY`. Do not disable TLS verification or post proxy credentials, sign-in URLs, authorization codes, or tokens in an issue.

The settings page promptly settles this known discovery timeout and says that browser sign-in has not started. An authentication flow that is still running within the five-minute deadline remains cancellable, while unknown CLI output is reduced to a redacted generic error. This is accurate diagnosis of the failure boundary: the Provider does not open the browser itself and does not repair Windows DNS, proxy, firewall, VPN, or official-CLI behavior.

### A model is missing

Run `grok models` and verify that the same account can see it. The provider returns every valid catalog record; an unknown backend fails discovery rather than being silently filtered.

### Why is quota percentage unknown?

A protobuf-omitted zero is restored only with a complete typed period. In every other case the upstream response lacks enough information, so the provider preserves “unknown.” OAuth token expiry is never shown as a quota reset.

### An existing conversation fails immediately after switching from another model to Grok

Versions through `0.1.2` could not convert some third-party tool-call histories containing special characters, notably `|` in Ark call IDs. Update to `0.1.3` or later; it preserves call/result correlation while safely mapping incompatible historical IDs before sending the request to Grok.

### Does Windows work?

Windows x64 is covered by code, slow fakes, and passing `0.1.9` Windows 2022 CI. The official CLI still generates the sign-in URL and launches the external browser. Network-reachable browser launch has not yet been confirmed on a real Windows device, so it must not be described as fixed or verified.

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
- [`docs/11-capability-roadmap.md`](docs/11-capability-roadmap.md): content-type sequence from `0.1.4`;
- [`CHANGELOG.md`](CHANGELOG.md): version history.

Read the [contributing guide](CONTRIBUTING.md) before filing an issue or PR. Changes to authentication, transport, credential formats, or release boundaries must update the relevant ADR/threat model before implementation and tests.

## Roadmap

- [x] Official CLI browser login, dynamic model catalog, and Responses streaming
- [x] Web/TUI account controls, quota dashboard, and model capability display
- [x] Publish `0.1.0` and verify Registry integrity/provenance
- [x] Configure npm Trusted Publisher, revoke the initial token, and add `dsh-plugin` discovery plus the YukiRyou catalog entry
- [x] Publish the `0.1.1` documentation and release-process correction
- [x] Publish the `0.1.2` Windows CLI compatibility correction
- [x] Publish the `0.1.3` cross-provider tool-history compatibility correction
- [x] Publish `0.1.4`: image input only for exact `grok-4.6`; red/blue user/tool-result Proxy gates and final Harness attachment revalidation passed, while `grok-4.5` fails closed as text-only
- [x] Publish `0.1.5`: maintenance for release binding, dashboard capability badges, and transactional Provider Runtime installation; the unique artifact, dual-platform CI, signatures, and SLSA provenance are verified
- [x] Publish `0.1.6`: image-history reasoning compatibility and per-stage official-CLI deadline repair for Windows; image sending is confirmed in a real Harness conversation
- [x] Publish `0.1.7`: Provider/CLI version diagnostics, CLI installation recovery, redacted OIDC discovery-timeout settlement, and the `IconThinkOutline16` settings-navigation compatibility layer
- [x] Publish `0.1.9`: added the Web/X Search protocol and settings page; the unique artifact, dual-platform CI, signatures, and SLSA provenance are verified; post-release verification found the missing Host settings namespace and unusable controls
- [x] Publish `0.1.10`: `llm-grok` registration, per-call capture, unique artifact, dual-platform CI, signatures, and provenance are complete
- [ ] Publish `0.1.11`: repair High Effort + Web Search reasoning-lifecycle compatibility; final dual-platform CI, unique artifact, exact authorization, Registry, and provenance readback remain pending
- [ ] A subsequent slice: opt-in image generation (inline results only, committed through Harness attachments)
- [ ] Complete independent Windows x64 acceptance and publish a later stable fix if needed

Slice details, gates, and permanent non-goals are in the [capability roadmap](docs/11-capability-roadmap.md). The roadmap is not a compatibility promise; each capability needs its own ADR and security gates. `prompt_cache_key` is not bundled with image input. Arbitrary URL downloads and API-key mode stay out of scope.

## License

[MIT](LICENSE). See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for the reused Harness icon geometry and its license.

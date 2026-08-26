# dsh-grok-provider

Clean-room Grok Build provider for DeepSeek Harness. It dynamically discovers every model visible to the selected Grok Build account and maps the native Responses stream to Harness text, reasoning, encrypted reasoning replay, usage and tool calls.

> Pre-release status: `0.1.0` is implemented but must not be published yet. xAI support/permission evidence, official CLI artifact integrity, Windows x64 true-device run, canonical GitHub provenance and dual-platform candidate verification remain release gates.

## Compatibility

- DeepSeek Harness `0.1.1-rc.2`
- Node.js `24.19.0` or newer
- macOS arm64 and Windows x64
- Official Grok CLI `1.0.5 (5115b46bc909)` at its default `~/.grok` / `%USERPROFILE%\\.grok` location

macOS x64, Linux, images, Web/X Search, arbitrary downloads, API-key billing, ACP and Headless agent wrapping are outside `0.1.0`.

## Authentication

The Host invokes only the verified default executable with fixed `--version`, `login --oauth` or `logout` argv through Harness subprocess management. The official CLI opens the browser and owns `auth.json`; the plugin reads a bounded credential snapshot but never refreshes or rewrites that file. The package contains no independent OAuth client identity or token store.

## User surfaces

The bundle contributes a bilingual, responsive `Grok Build` settings page on a loopback Harness Web surface. It supports status, official CLI browser login, cancellation and double-confirmed logout. Tokens never reach the renderer.

The TUI exposes the closed command grammar:

```text
/grok status
/grok login
/grok cancel
/grok logout
```

The command is not sent to the model and its persisted result text is redacted-safe.

## Model support

The provider calls the authenticated Grok Build `/v1/models` catalog at runtime; model IDs are not hardcoded. Every catalog entry must declare a backend for which this release has a strict codec. The current account-visible `grok-4.6` and `grok-4.5` Responses models have both passed macOS arm64 true-network tests for first-turn streaming, encrypted-reasoning second-turn replay and a non-executed fixture function call.

If a future account exposes an unverified backend, discovery fails closed instead of hiding that model and falsely claiming complete support.

## Security boundary

- Inference endpoints are compile-time fixed HTTPS origins and reject redirects.
- Renderer/RPC inputs cannot provide commands, executable paths, environment variables, credential paths or base URLs.
- Official login uses a scrubbed environment, bounded output and plugin-owned deadlines; cancellation and capability teardown wait for the spawned process tree.
- The official CLI and its valid user/system/MDM configuration remain a trusted local component. The plugin's no-shell guarantee covers its own spawn boundary, not opaque behavior inside the official CLI.
- Official `auth.json` contains a refresh token in its raw bytes. The Host necessarily reads those bounded bytes transiently, ignores the refresh token and identity fields, and does not log or persist them.
- The plugin does not create a second credential record; login persistence remains entirely owned by the official CLI.

Full architecture, threat model, tests, evidence and unresolved release blockers live in [`docs/`](docs/README.md).

## Development

```sh
npm ci --ignore-scripts
npm test
npm run pack:check
```

Tests and builds target Node `24.19.0`. The package has zero ordinary runtime dependencies; Harness services are exact peer dependencies. `npm run build` creates disposable `dist/` artifacts, and the npm tarball excludes source, tests, spikes and local evidence.

# Changelog

## 1.0.2 - 2026-08-30

- Suppress contentless Harness reasoning blocks for upstream reasoning lifecycles that fully close without any visible summary or raw delta. The decoder now starts a visible block only when the first non-empty reasoning delta arrives; non-empty reasoning items remain separate blocks with their existing ordering.
- Preserve the strict protocol boundary while changing the projection: ordinary empty items retain their existing ID/type, sequence, output-index, status, summary/content, size, optional encrypted-content, and closure checks; Search-backed same-ID reuse additionally retains exact own-data key/accessor validation. Invalid reuse, ordering violations, and incomplete responses with an open reused lifecycle continue to fail closed.
- Preserve output-index order when a later visible block must wait for an earlier unresolved reasoning item. The shared delayed-chunk queue now fails closed above 65,536 chunks or 32 MiB of dynamic UTF-8 payload, preventing an unresolved item from amplifying memory across otherwise individually bounded blocks. Response text, tool calls, usage, finish reasons, visible non-empty replay, Search replay suppression, authentication, models, images, fixed endpoints, citation/URL handling, and Harness permissions remain unchanged. A hidden ordinary empty item has no replay-alignment slot, so validated encrypted content from that item is not persisted; existing empty `Think` rows stored in old conversations are not rewritten.
- Package the bilingual README with durable `1.0.2` wording and an exact `dsh-grok-provider@1.0.2` installation command. Publication, CI, artifact digest, Registry, signature, attestation, and provenance facts are intentionally recorded only after they actually exist.

## 1.0.1 - 2026-08-30

- Fix fixed-Proxy HTTP 400 failures when enabled xAI server `web_search` / `x_search` descriptors coexist with Harness function definitions using the same reserved names. Every source function is still fully validated first; only the definitions whose names collide with enabled server tools are omitted from the wire request. The same local functions remain available whenever the corresponding server Search setting is off.
- Preserve historical `function_call` / `function_call_output` items, including prior `web_search` and `x_search` calls, so an existing conversation can continue without rewriting or discarding its tool history. Bind the response decoder to a receipt that rejects any function/server-tool name intersection.
- Preserve transport failures raised while reading the SSE source instead of relabeling them as parser failures. Fixed-Proxy HTTP 400 maps to `PROVIDER_ERROR`; focused adapter coverage also locks 401/403 to `AUTH`, 429 to `RATE_LIMIT`, and `AbortError` to `ABORTED`, while malformed, truncated, or unsupported SSE continues to map to `INVALID_RESPONSE`.
- Complete one redacted real-account replay of the original failing X-session structure: 8 messages and 40 source functions compiled to 38 function definitions plus 2 server Search descriptors while preserving 2 historical reserved-name calls. One models GET and one Responses POST yielded 314 events and `response.completed`. No message text, result text, URL, account identity, or credential was retained.
- Set the source manifest and lockfile to `1.0.1`. The exact Node `24.19.0` local suite passes with 253 tests, 251 pass, 0 fail, and 2 platform skips; the production dependency audit reports zero vulnerabilities, an isolated-cache dry-run pack lists 73 files, and the secret-pattern scan finds only the explicit fixture canary and its checklist record. Code PR #31, merge commit `0c60200e12c3b8455331f31a317ece9b1945c458`, and main CI run `33312621786` passed on macOS 14 and Windows 2022. Release commit `3c25a53571531e35ac888df16df4fe6c01849e85` passed final dual-platform CI run `33312946205`; annotated tag object `ab79b1bb1e408a0112166cadc26761a327819c3f` peels to that commit. Trusted Publisher run `33313699790` attempt 1 published the explicitly authorized unique 73-file artifact: 240,904 bytes packed, 748,888 bytes unpacked, SHA-1 `9e6449160947104e8dbb71b7201c53e81b073f83`, SHA-256 `e3e15646d38de23c32c71ed759f9c10be9b2d790d4b10b4b8dfe59a44fbfef9f`, and SRI `sha512-Bm1qjJQ9i7CWT0oWah7QKDVBP8dR2YQtvEEZGE/BOSwZCo8sZbrW2v2QSfUfLsOLHcQXFZZ0jlDCAztr1m/q+A==`. The frozen candidate, GitHub Release, and npm tarballs are byte-identical; npm reports `latest=1.0.1`, the locked Node `24.19.0` / npm `11.5.1` Host/client smoke and production audit passed, package metadata exposes 1 Registry signature and 2 attestations, `npm audit signatures` verified 11 signed packages and 2 attestations, and SLSA provenance binds `release.yml`, `refs/tags/v1.0.1`, the release commit, and publish run. Real-device Windows external-browser launch remains unverified.

## 1.0.0 - 2026-08-30

- Fix the remaining `INVALID_RESPONSE` failures observed with exact `grok-4.6` Search responses by accepting repeated, already Search-backed reasoning IDs only as strictly empty placeholders. "Strictly empty" means no visible summary/content and no summary/raw lifecycle; a bounded opaque `encrypted_content` field remains permitted for replay continuity.
- Require every reused reasoning lifecycle to reach its own `response.output_item.done`. Incomplete lifecycles, cross-type reuse, reuse before the original item closes or before one completed server Search, non-empty summary/raw content, unknown terminal fields, and accessor-backed terminal fields continue to fail closed.
- Accept the observed completed Web Search `open_page` action only as the exact bounded `{ type: "open_page", url }` shape, require the streamed and final action type/URL to agree, discard the URL after validation, and never open, fetch, preview, or replay it.
- Capture Search terminal items and their response containers through own-data snapshots before dispatch or comparison, so self-replacing accessors cannot mutate IDs, inputs, action types, or `open_page` URLs during validation. Once an ID is Search-backed, later empty reuses also short-circuit the completed-Search scan.
- Add focused protocol regressions for multiple empty reuses, Web/X Search-backed reuse, lifecycle completion, closed reuse followed by max-token completion, opaque encrypted content, nested/container accessor rejection, and `open_page` start/final consistency.
- Complete two-layer redacted real-account verification without retaining prompts, results, URLs, account identity, or credentials: raw Web/X protocol probes each completed one 64-event response and observed the requested Search kind; the production adapter completed 5 Responses calls, with direct Web/X both ending in `stop` and a Harness-shaped local `x_search` call/result continuation ending `tool-calls`, `tool-calls`, then `stop`, with one local call in each of the first two turns. That continuation did not place a Harness `x_search` function definition beside an xAI `{ type: "x_search" }` server descriptor in the same wire request; `1.0.1` later isolated that combination as an HTTP 400 conflict.
- Set the source manifest and lockfile to `1.0.0`; pass 245 Node 24 tests (243 pass, 0 fail, 2 platform skips), production audit, deterministic build/bundle comparison, 72-entry dry-run pack, secret scan, and diff check. Code PR #28 and main CI run `33308371009` passed on macOS 14 and Windows 2022. Release commit `c6548199582b122f1d285422eabea0205eaf602f` passed final dual-platform CI run `33308603394`; annotated tag object `192561cda1ac58cbc4077f0de8fa614dff9a5557` peels to that commit. Trusted Publisher run `33309083806` attempt 1 published the explicitly authorized unique 72-file artifact: 226,704 bytes packed, 715,014 bytes unpacked, SHA-1 `50e5d898dba241d1e19def7705db216e3060b892`, SHA-256 `30cd83dad77f7d2611126b3c4737c8fabffeae79f385fa623e61dcecfe39f5e2`, and SRI `sha512-WL2f6Kfg5yT5nNf1p4//mLSajCnZttL/pDR3BISrFgSGtZd9DEJlnibq08ETz503n1wHIdCBcU/ICMPG9K4vOw==`. The frozen candidate, GitHub Release, and npm tarballs are byte-identical; npm reports `latest=1.0.0`, the isolated Node 24 Host `name`/`apply` and client `id` smoke passed, package metadata exposes 1 signature and 2 attestations, `npm audit signatures` verified 11 signed packages and 2 attestations, and SLSA provenance binds the tag, workflow, commit, and publish run. Real-device Windows external-browser launch remains unverified.

## 0.1.11 - 2026-08-30

- Fix `INVALID_RESPONSE` failures when exact `grok-4.6` at High Effort continues after Web Search by accepting the observed one-time reuse of an already closed reasoning item ID as a new empty reasoning placeholder only after one completed Search, while rejecting open, cross-type, non-empty, or repeated reuse.
- Accept closed empty reasoning output items without weakening sequence, output-index, item-status, or encrypted-replay validation.
- Decode the official Responses raw-reasoning lifecycle (`reasoning_text` content parts plus `response.reasoning_text.delta` / `done`) and keep raw reasoning strictly mutually exclusive with the existing reasoning-summary lifecycle.
- Keep raw plaintext out of replay metadata: subsequent requests send only `encrypted_content` with `summary: []` and never replay or relabel raw plaintext as a summary; live raw reasoning deltas remain visible to Harness like summary reasoning deltas.
- Add focused regressions for valid empty/reused reasoning, raw reasoning streaming and replay, plus malformed reuse, mixed raw/summary, out-of-order, duplicate, and incomplete lifecycle rejection.
- Re-run a redacted real `grok-4.6` Web Search probe through the production decoder: one POST yielded 68 events, 34 summary deltas, zero raw-reasoning deltas, one accepted finish, and no saved prompt, response text, query, citation URL, or credential. This verifies the observed summary/Search path only; raw reasoning remains fixture-verified rather than live-probe verified.
- Keep authentication, settings, model routing, image input, Search descriptors, citations, fixed endpoints, and platform support unchanged.

## 0.1.10 - 2026-08-30

- Register the `llm-grok` Host settings namespace through Harness's canonical settings module so the Web Search and X Search controls are writable instead of permanently `unavailable`.
- Resolve Search settings from schema defaults, composition config, and the persisted user layer, while retaining the composition config when no settings provider is mounted.
- Snapshot the current Search policy once at each adapter-call boundary before model discovery awaits; later calls observe committed setting changes while prepared and in-flight calls keep their original policy.
- Add real `SettingsProvider` integration coverage for namespace defaults, lifecycle cleanup, persisted updates, composition fallback, and prepared-call isolation, plus a deferred-discovery adapter regression.
- Keep authentication, credentials, endpoints, Search protocol allowlists, citation handling, image input, and platform support unchanged.

## 0.1.9 - 2026-08-30

- Add independent, default-off Web Search and X Search Provider settings for exact `grok-4.6`; keep every other dynamically discovered model Search-disabled until the same fixed-Proxy evidence exists.
- Compile Harness function tools followed by `web_search` and `x_search` under one 128-tool and 16 MiB request budget, while preserving the byte-identical `0.1.7` request path when both settings are off and disabling Search for non-interactive `purpose` calls.
- Bind each final request to a private response receipt so undeclared function names, disabled server tools, unknown events, malformed citations, and incomplete or out-of-order Search lifecycles fail closed before they can be projected into Harness.
- Decode the fixed Proxy's standard Web Search lifecycle and its Grok-Build-specific four-name X Search `custom_tool_call` lifecycle as server-executed activity that emits no Harness tool-call chunks; observing either category suppresses encrypted reasoning replay for that response.
- Preserve inline citation Markdown as assistant text while bounding and discarding structured citation metadata; never follow, preview, or download citation URLs.
- Add bilingual Search risk disclosures to the existing Grok Build settings page through Harness `settingsScope`, without a second configuration RPC, renderer-local persistence, a production dependency, a new endpoint, or a new authentication mode.
- Known issue: the published Host omitted the matching `llm-grok` settings registration, leaving both user-facing Search controls disabled. `0.1.10` repairs this integration and the missing live-setting consumption path.

## 0.1.8 - 2026-08-30 (withdrawn)

- Briefly published a Grok-only sidebar quota card that moved the sidebar's Grok quota querying and display ownership into the Provider, then withdrew the release by reverting that change.
- The npm Registry version `dsh-grok-provider@0.1.8` remains permanently reserved and cannot be reused after unpublish; `latest` returned to `0.1.7` after withdrawal, and the independent Search slice moved to the subsequently published `0.1.9`.

## 0.1.7 - 2026-08-29

- Add a separate Host diagnostics RPC that reports the installed package version and a closed Grok Build CLI state/version without exposing executable paths, stderr, environment, proxy data, or OAuth URLs.
- Disable browser sign-in until the official default CLI executable, bounded version output, and `login --oauth` capability pass; show the official install guide and a re-detection action when the CLI is missing or invalid.
- End the Web sign-in spinner with actionable, redacted outcomes for known OIDC discovery network timeout, the five-minute login deadline, missing/invalid CLI, and unknown CLI failure while preserving cancellation and cleanup quarantine semantics.
- Keep runtime diagnostics single-flight and lifecycle-owned: capability teardown cancels and awaits inspection, cleanup failure latches the CLI instance and aborts its in-flight authentication actions, and serial authentication polling uses a request epoch to reject stale responses after user actions, settlement, or unmount.
- Document the Windows pre-browser OIDC failure boundary and keep runtime diagnostics outside the authentication status polling path; the official CLI still owns sign-in URL generation and external-browser launch, so this release does not claim to repair Windows network/proxy conditions or to have verified network-reachable browser launch on a real Windows device.
- Render the MIT-licensed `IconThinkOutline16` path geometry from `@deepseek-ai/dsh-client-ui-primitives@0.1.0-rc.7` for the one exact Grok Build settings navigation match through a scoped, lifecycle-owned compatibility layer; ambiguous labels or unexpected DOM structure retain the Host gear, unload removes every injected resource, and the bundled third-party notice preserves attribution.
- Keep Web/X Search, image generation, new server-tool events, arbitrary URL downloads, API-key mode, and custom endpoints out of this maintenance release; the independent Search slice moves to `0.1.9` because the sidebar-quota `0.1.8` release was withdrawn and its Registry version cannot be reused.

## 0.1.6 - 2026-08-28

- Accept schema-valid provider-neutral user and system history containing private reasoning blocks, omit that reasoning from the Grok wire, and preserve adjacent visible text and ordered image input; malformed or oversized omitted blocks still fail closed before attachment I/O.
- Keep encrypted reasoning replay restricted to valid same-provider assistant history and retain the one-level tool-result text/image boundary with stable generic-error classification for unsupported tool-result blocks.
- Give executable resolution, read-only verification, `--version`, `login --help`, and the final official CLI action independent deadlines so Windows cold starts cannot consume the browser-login budget before `login --oauth` launches; process-tree teardown is independently bounded and late caller cancellation cannot be reported as success.
- Make executable metadata verification and direct-process completion observe cancellation; bound whole-tree teardown separately, and quarantine the authentication driver after cleanup failure until the Host restarts or the subprocess driver is replaced. Login start, logout, and credential refresh share controller-owned single-flight, cancellation, shutdown, and driver-generation guards so stale operations cannot dispatch or report success after replacement, without changing the fixed official path, fixed argv, scrubbed environment, output bounds, no-shell policy, or post-login credential validation.
- Keep Web/X Search, image generation, new server-tool events, arbitrary URL downloads, API-key mode, and custom endpoints out of this maintenance release; the proposed Search slice moves to `0.1.7`.

## 0.1.5 - 2026-08-28

- Bind Trusted Publisher runs to the exact stable tag ref and peeled commit, require one non-draft/non-prerelease GitHub Release asset with the exact package filename, and pin the publishing runtime to Node.js `24.19.0`.
- Project model input modalities into the account dashboard so exact `grok-4.6` visibly advertises image input while text-only models do not.
- Make provider installation transactional: partial authentication and adapter registrations are rolled back when a later installation step fails, while successful disposal remains idempotent and best-effort.
- Correct release-state and streaming-deadline documentation without changing authentication, endpoints, image compilation, or Responses wire behavior.
- Keep Web/X Search, image generation, URL downloads, API-key mode, and new SSE event handling outside this maintenance release.

## 0.1.4 - 2026-08-28

- Add an asynchronous Responses request compiler for bounded jpeg/png image input from the optional Harness attachment store.
- Preserve the exact `0.1.3` text request path when no image is present; compile ordered user and tool-result image content only before transport starts.
- Advertise image input only for exact `grok-4.6`; `grok-4.5` and all other models remain text-only.
- Enforce per-image bytes, pixels, dimensions, image count, aggregate derived bytes, a 20,000-block image-compilation budget, one-level tool-result nesting, MIME magic, cancellation, and a final 16 MiB JSON limit with deterministic oldest-first offloading.
- Keep `prompt_cache_key`, Web/X Search, image generation, URL downloads, new SSE events, authentication, and endpoint changes out of this release.
- Verify exact `grok-4.6` against the fixed CLI Chat Proxy with red and blue fixtures in both user-image and tool-result-image positions; all four streams returned HTTP 200 SSE completion and passed the normalized whole-response color assertion.
- Fail closed on `grok-4.5` image input after its controlled red-fixture Proxy response proved semantically unreliable; keep `grok-4.5` and every other model text-only.
- Fix image requests to `detail:"high"` following the official xAI Responses image example; retain real Harness `0.1.1-rc.2` attachment-local/LlmRuntime isolation as a final candidate revalidation gate.

## 0.1.3 - 2026-08-27

- Fix existing Harness conversations failing immediately after switching from Ark to Grok when an earlier tool-call ID contains Ark's `|` delimiter.
- Preserve Grok-compatible call IDs and deterministically map bounded incompatible historical IDs to safe request-local correlation IDs.
- Keep each mapped function call and function result correlated without forwarding the incompatible foreign identifier to xAI.
- Add regression coverage using the exact redacted Ark call-ID shape captured from the affected conversation.
- Add three repository-hosted preview images for community marketplace listings without including them in the npm runtime artifact.

## 0.1.2 - 2026-08-26

- Fix Windows browser sign-in for official Grok Build CLI `0.2.82`, which `0.1.1` rejected before invoking `login --oauth`.
- Replace the complete CLI-version allowlist with bounded version diagnostics plus a `login --help` capability probe for the independent `--oauth` option.
- Keep the security boundary closed: official default path and executable checks, fixed argv, scrubbed environment, no plugin shell, post-login production OIDC credential validation, and pinned Grok Build endpoints remain mandatory.
- Add regression coverage for the real Windows `0.2.82` output shape, compatible unknown versions, missing OAuth capability, and malformed version output.
- Document Windows x64 as code- and CI-supported without claiming independent real-device acceptance; publish later stable fixes for any discovered defect.
- Adopt stable-only releases: future defects are resolved by incrementing the stable version instead of publishing prereleases.

## 0.1.1 - 2026-08-26

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

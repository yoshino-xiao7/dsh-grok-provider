# Changelog

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

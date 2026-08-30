import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..")

test("the exact 1.0.0 source candidate exports runtime artifacts and Web loader metadata", async () => {
  const attributes = await fs.readFile(path.join(root, ".gitattributes"), "utf8")
  assert.match(attributes, /^\*\.yml text eol=lf$/mu)
  const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
  assert.equal(manifest.name, "dsh-grok-provider")
  assert.equal(manifest.version, "1.0.0")
  const lockfile = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"))
  assert.equal(lockfile.version, manifest.version)
  assert.equal(lockfile.packages[""].version, manifest.version)
  assert.deepEqual(manifest.repository, {
    type: "git",
    url: "git+https://github.com/yoshino-xiao7/dsh-grok-provider.git",
  })
  assert.equal(manifest.homepage, "https://github.com/yoshino-xiao7/dsh-grok-provider#readme")
  assert.equal(manifest.bugs.url, "https://github.com/yoshino-xiao7/dsh-grok-provider/issues")
  assert.deepEqual(manifest.exports["."], {
    types: "./types/index.d.ts",
    default: "./dist/host/index.mjs",
  })
  assert.deepEqual(manifest.exports["./client"], { default: "./dist/client/client.js" })
  assert.equal(manifest.exports["./package.json"], "./package.json")
  const require = createRequire(path.join(root, "web-loader-fixture.cjs"))
  assert.equal(require.resolve("dsh-grok-provider/package.json"), path.join(root, "package.json"))
  assert.deepEqual(manifest.files, [
    "dist",
    "docs",
    "types",
    "grok-provider.patch.yml",
    "README.md",
    "README.en.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "CHANGELOG.md",
  ])
  const thirdPartyNotices = await fs.readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8")
  assert.match(thirdPartyNotices, /@deepseek-ai\/dsh-client-ui-primitives@0\.1\.0-rc\.7/u)
  assert.match(
    thirdPartyNotices,
    /https:\/\/github\.com\/deepseek-ai\/deepseek-harness\/tree\/master\/packages\/client\/ui-primitives/u,
  )
  assert.match(thirdPartyNotices, /Copyright \(c\) 2026 DeepSeek/u)
  assert.match(thirdPartyNotices, /Permission is hereby granted, free of charge, to any person obtaining a copy/u)
  assert.match(thirdPartyNotices, /The above copyright notice and this permission notice shall be included in all/u)
  assert.match(thirdPartyNotices, /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/u)
  assert.match(thirdPartyNotices, /AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM/u)
  assert.equal(manifest.dependencies, undefined)
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-credentials"], undefined)
  assert.equal(manifest.devDependencies["@deepseek-ai/dsh-credentials"], undefined)
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-settings"], "0.1.1-rc.2")
  assert.equal(manifest.devDependencies["@deepseek-ai/dsh-settings"], "0.1.1-rc.2")
  assert.equal(manifest.peerDependenciesMeta?.["@deepseek-ai/dsh-settings"], undefined)
  assert.equal(manifest.scripts.prepack, "npm run build")
  assert.equal(manifest.scripts["pack:check"], "npm pack --dry-run --json")
  assert.equal(
    manifest.scripts["test:smoke-syntax"],
    "node --check spikes/image-input-smoke.mjs && node --check spikes/harness-attachment-smoke.mjs && node --check spikes/search-protocol-probe.mjs",
  )
  assert.match(manifest.scripts.test, /npm run test:smoke-syntax/u)

  const releaseWorkflow = await fs.readFile(
    path.join(root, ".github/workflows/release.yml"),
    "utf8",
  )
  assert.match(
    releaseWorkflow,
    /publish "\.\/release\/\$ARTIFACT_NAME"/u,
    "npm publish must receive an explicit local tarball path, not a GitHub shorthand",
  )
  assert.match(releaseWorkflow, /^\s*id-token: write$/mu)
  assert.match(releaseWorkflow, /^\s*environment: npm$/mu)
  assert.doesNotMatch(releaseWorkflow, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./u)
  assert.doesNotMatch(releaseWorkflow, /npm_dist_tag|NPM_DIST_TAG|-rc\./u)
  assert.match(releaseWorkflow, /--tag latest/u)
  assert.doesNotMatch(releaseWorkflow, /inputs\.dist[_-]tag/u)
  assert.match(releaseWorkflow, /RELEASE_TAG: \$\{\{ inputs\.tag \}\}/u)
  assert.match(releaseWorkflow, /CONTEXT_REF: \$\{\{ github\.ref \}\}/u)
  assert.match(releaseWorkflow, /CONTEXT_REF_NAME: \$\{\{ github\.ref_name \}\}/u)
  assert.match(releaseWorkflow, /CONTEXT_REF_TYPE: \$\{\{ github\.ref_type \}\}/u)
  assert.match(releaseWorkflow, /CONTEXT_SHA: \$\{\{ github\.sha \}\}/u)
  assert.match(releaseWorkflow, /test "\$CONTEXT_REF_TYPE" = tag/u)
  assert.match(releaseWorkflow, /test "\$CONTEXT_REF" = "refs\/tags\/\$RELEASE_TAG"/u)
  assert.match(releaseWorkflow, /test "\$CONTEXT_REF_NAME" = "\$RELEASE_TAG"/u)
  assert.match(releaseWorkflow, /git\/ref\/tags\/\$RELEASE_TAG/u)
  assert.match(releaseWorkflow, /test "\$peeled_type" = commit/u)
  assert.match(releaseWorkflow, /test "\$peeled_sha" = "\$CONTEXT_SHA"/u)
  assert.match(
    releaseWorkflow,
    /--json tagName,isDraft,isPrerelease,assets/u,
  )
  assert.match(releaseWorkflow, /test "\$\(jq -r \.tagName .*" = "\$RELEASE_TAG"/u)
  assert.match(releaseWorkflow, /test "\$\(jq -r \.isDraft .*" = false/u)
  assert.match(releaseWorkflow, /test "\$\(jq -r \.isPrerelease .*" = false/u)
  assert.match(releaseWorkflow, /test "\$\(jq -r '\.assets \| length'.*" = 1/u)
  assert.match(
    releaseWorkflow,
    /test "\$\(jq -r '\.assets\[0\]\.name'.*" = "\$ARTIFACT_NAME"/u,
  )
  assert.match(releaseWorkflow, /test "\$\{#downloaded\[@\]\}" -eq 1/u)
  assert.match(releaseWorkflow, /^\s*node-version: 24\.19\.0$/mu)

  const chineseReadme = await fs.readFile(path.join(root, "README.md"), "utf8")
  const englishReadme = await fs.readFile(path.join(root, "README.en.md"), "utf8")
  assert.match(chineseReadme, /\[English\]\(README\.en\.md\)/u)
  assert.match(englishReadme, /\[简体中文\]\(README\.md\)/u)
  assert.match(chineseReadme, /## 快速开始/u)
  assert.match(chineseReadme, /## 安全与隐私/u)
  assert.match(chineseReadme, /当前源码候选版本为 `1\.0\.0`/u)
  assert.match(chineseReadme, /npm Registry 的 `latest` 仍为 `0\.1\.11`/u)
  assert.match(chineseReadme, /dsh-grok-provider@1\.0\.0/u)
  assert.match(chineseReadme, /\[`THIRD_PARTY_NOTICES\.md`\]\(THIRD_PARTY_NOTICES\.md\)/u)
  assert.match(englishReadme, /## Quick start/u)
  assert.match(englishReadme, /## Security and privacy/u)
  assert.match(englishReadme, /current source candidate is `1\.0\.0`/u)
  assert.match(englishReadme, /npm Registry `latest` remain `0\.1\.11`/u)
  assert.match(englishReadme, /dsh-grok-provider@1\.0\.0/u)
  assert.match(englishReadme, /\[`THIRD_PARTY_NOTICES\.md`\]\(THIRD_PARTY_NOTICES\.md\)/u)
  const securityPolicy = await fs.readFile(path.join(root, "SECURITY.md"), "utf8")
  assert.match(securityPolicy, /当前源码候选版本为 `1\.0\.0`/u)
  assert.match(securityPolicy, /npm Registry 的 `latest` 仍为 `0\.1\.11`/u)
  assert.match(securityPolicy, /current source candidate is `1\.0\.0`/u)
  assert.match(securityPolicy, /npm Registry `latest` remain `0\.1\.11`/u)
  const releaseNotes = await fs.readFile(
    path.join(root, "docs/releases/v1.0.0.md"),
    "utf8",
  )
  assert.equal(releaseNotes.startsWith("## 中文\n"), true)
  assert.match(releaseNotes, /尚未发布的源码候选/u)
  assert.match(releaseNotes, /exact `open_page`|精确.*`open_page`/iu)
  assert.match(releaseNotes, /(?:严格空.*reasoning|reasoning.*严格空|strictly empty.*reasoning|reasoning.*strictly empty)/iu)
  assert.match(releaseNotes, /\n<details>\n<summary>English release notes<\/summary>\n/u)
  assert.doesNotMatch(releaseNotes, /\n## English\n/u)
  assert.doesNotMatch(releaseNotes, /^# .*1\.0\.0/mu)

  const publishedReleaseNotes = await fs.readFile(
    path.join(root, "docs/releases/v0.1.11.md"),
    "utf8",
  )
  assert.match(publishedReleaseNotes, /`0\.1\.11` 已正式发布/u)
  assert.doesNotMatch(publishedReleaseNotes, /尚未发布|unpublished source candidate/iu)

  const withdrawnReleaseNotes = await fs.readFile(
    path.join(root, "docs/releases/v0.1.8.md"),
    "utf8",
  )
  assert.equal(withdrawnReleaseNotes.startsWith("## 中文\n"), true)
  assert.match(withdrawnReleaseNotes, /曾短暂发布.*侧栏额度/u)
  assert.match(withdrawnReleaseNotes, /随后.*撤回/u)
  assert.match(withdrawnReleaseNotes, /包名与版本号组合 `dsh-grok-provider@0\.1\.8` 已被永久占用/u)
  assert.match(withdrawnReleaseNotes, /撤回后.*`latest` 恢复为 `0\.1\.7`/u)
  assert.match(withdrawnReleaseNotes, /Web\/X Search 顺延至 `0\.1\.9`/u)
  assert.match(withdrawnReleaseNotes, /<summary>English withdrawal record<\/summary>/u)
  assert.doesNotMatch(withdrawnReleaseNotes, /dsh plugin|npm install|安装精确版本|Install the exact version/iu)
  assert.doesNotMatch(withdrawnReleaseNotes, /```(?:sh|bash)?/u)
  for (const filename of ["CONTRIBUTING.md", "SECURITY.md"]) {
    assert.match(chineseReadme, new RegExp(`\\(${filename.replace(".", "\\.")}\\)`, "u"))
    await fs.access(path.join(root, filename))
  }

  const host = await fs.readFile(path.join(root, "dist/host/index.mjs"), "utf8")
  const client = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  assert.match(host, /export const name = "llm-grok"/u)
  assert.match(host, /packageJson from "\.\.\/\.\.\/package\.json" with \{ type: "json" \}/u)
  assert.match(host, /pluginVersion: packageJson\.version/u)
  assert.match(client, /id: "dsh-grok-provider"/u)
  assert.match(client, /IconThinkOutline16 geometry from @deepseek-ai\/dsh-client-ui-primitives@0\.1\.0-rc\.7/u)
  assert.doesNotMatch(
    client,
    /pluginVersion:\s*["']\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?["']/u,
    "the Web bundle must receive the package version from Host diagnostics",
  )
  assert.doesNotMatch(client, /node:fs|node:path|refreshToken|accessToken|auth\.json/u)
  for (const filename of [
    "managed-capability.mjs",
    "managed-credential-source.mjs",
    "managed-device-flow.mjs",
    "managed-grant-store.mjs",
    "managed-oauth-client.mjs",
  ]) {
    await assert.rejects(fs.access(path.join(root, "dist/internal", filename)))
  }
})

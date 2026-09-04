import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..")

function markdownPreamble(markdown) {
  const firstSection = markdown.indexOf("\n## ")
  assert.notEqual(firstSection, -1, "README must contain a level-two section")
  return markdown.slice(0, firstSection)
}

function markdownSection(markdown, heading) {
  const marker = `${heading}\n`
  const start = markdown.indexOf(marker)
  assert.notEqual(start, -1, `README must contain ${heading}`)
  const bodyStart = start + marker.length
  const nextSection = markdown.indexOf("\n## ", bodyStart)
  return markdown.slice(bodyStart, nextSection === -1 ? undefined : nextSection)
}

async function collectDistFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectDistFiles(full))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

test("the exact 1.0.4 source release exports runtime artifacts and Web loader metadata", async () => {
  const attributes = await fs.readFile(path.join(root, ".gitattributes"), "utf8")
  assert.match(attributes, /^\*\.yml text eol=lf$/mu)
  const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
  assert.equal(manifest.name, "dsh-grok-provider")
  assert.equal(manifest.version, "1.0.4")
  const lockfile = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"))
  assert.equal(lockfile.version, "1.0.4")
  assert.equal(lockfile.packages[""].version, "1.0.4")
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
  assert.equal(manifest.peerDependencies["@deepseek-ai/cordis"], "4.0.2")
  assert.equal(manifest.peerDependencies["@deepseek-ai/schemastery"], "3.18.2")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-llm"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-settings"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-commands"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-subprocess"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-client-connection"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-client-locale"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-client-ui-settings"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-client-ui-renderer"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-client-runtime"], undefined)
  assert.equal(manifest.devDependencies["@deepseek-ai/dsh-settings"], "0.1.2-rc.1")
  assert.equal(manifest.peerDependenciesMeta?.["@deepseek-ai/dsh-settings"], undefined)
  assert.equal(manifest.peerDependenciesMeta?.["@deepseek-ai/dsh-client-ui-renderer"]?.optional, true)
  assert.deepEqual(manifest.dsh.client.inject, [
    "@deepseek-ai/dsh-client-connection",
    "@deepseek-ai/dsh-client-locale",
    "@deepseek-ai/dsh-client-ui-renderer",
    "@deepseek-ai/dsh-client-ui-settings",
  ])
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
  assert.match(
    releaseWorkflow,
    /readme_zh="\$\(tar -xOf "\$artifact" package\/README\.md\)"/u,
  )
  assert.match(
    releaseWorkflow,
    /readme_en="\$\(tar -xOf "\$artifact" package\/README\.en\.md\)"/u,
  )
  assert.match(releaseWorkflow, /extract_markdown_section '## 快速开始'/u)
  assert.match(releaseWorkflow, /extract_markdown_section '## Quick start'/u)
  assert.match(
    releaseWorkflow,
    /release_surface_zh="\$\(printf '%s\\n%s\\n' "\$preamble_zh" "\$quick_start_zh"\)"/u,
  )
  assert.match(
    releaseWorkflow,
    /release_surface_en="\$\(printf '%s\\n%s\\n' "\$preamble_en" "\$quick_start_en"\)"/u,
  )
  assert.match(
    releaseWorkflow,
    /printf -v expected_zh_artifact '本说明对应 `dsh-grok-provider@%s` 制品'/u,
  )
  assert.match(
    releaseWorkflow,
    /printf -v expected_zh_readme '本 README 随 `%s` 一起进入 npm tarball，下面的精确安装命令也固定为 `%s`。'/u,
  )
  assert.match(
    releaseWorkflow,
    /printf -v expected_en_artifact 'This README describes the `dsh-grok-provider@%s` artifact'/u,
  )
  assert.match(
    releaseWorkflow,
    /printf -v expected_en_readme 'This README is included in the `%s` npm tarball, and the exact installation command below is pinned to `%s`.'/u,
  )
  for (const [expected, surface] of [
    ["expected_zh_artifact", "preamble_zh"],
    ["expected_zh_readme", "preamble_zh"],
    ["expected_en_artifact", "preamble_en"],
    ["expected_en_readme", "preamble_en"],
  ]) {
    assert.match(
      releaseWorkflow,
      new RegExp(`grep -Fq "\\$${expected}" <<< "\\$${surface}"`, "u"),
    )
  }
  assert.match(
    releaseWorkflow,
    /grep -Eq '未发布\|候选\|继续安装' <<< "\$release_surface_zh"/u,
  )
  assert.match(
    releaseWorkflow,
    /grep -Eiq 'unpublished\|candidate\|continue installing' <<< "\$release_surface_en"/u,
  )
  assert.match(
    releaseWorkflow,
    /expected_install="dsh plugin --profile web add dsh-grok-provider@\$RELEASE_VERSION"/u,
  )
  assert.match(releaseWorkflow, /test "\$\{#install_commands_zh\[@\]\}" -eq 1/u)
  assert.match(releaseWorkflow, /test "\$\{install_commands_zh\[0\]\}" = "\$expected_install"/u)
  assert.match(releaseWorkflow, /test "\$\{#install_commands_en\[@\]\}" -eq 1/u)
  assert.match(releaseWorkflow, /test "\$\{install_commands_en\[0\]\}" = "\$expected_install"/u)
  assert.match(releaseWorkflow, /^\s*node-version: 24\.19\.0$/mu)

  const chineseReadme = await fs.readFile(path.join(root, "README.md"), "utf8")
  const englishReadme = await fs.readFile(path.join(root, "README.en.md"), "utf8")
  const chinesePreamble = markdownPreamble(chineseReadme)
  const englishPreamble = markdownPreamble(englishReadme)
  const chineseQuickStart = markdownSection(chineseReadme, "## 快速开始")
  const englishQuickStart = markdownSection(englishReadme, "## Quick start")
  const chineseReleaseSurface = `${chinesePreamble}\n${chineseQuickStart}`
  const englishReleaseSurface = `${englishPreamble}\n${englishQuickStart}`
  assert.match(chineseReadme, /\[English\]\(README\.en\.md\)/u)
  assert.match(englishReadme, /\[简体中文\]\(README\.md\)/u)
  assert.match(chineseReadme, /## 快速开始/u)
  assert.match(chineseReadme, /## 安全与隐私/u)
  assert.match(
    chinesePreamble,
    /本说明对应 `dsh-grok-provider@1\.0\.4` 制品；`0\.1\.8` 曾发布后撤回且版本号不可复用。/u,
  )
  assert.match(
    chinesePreamble,
    /本 README 随 `1\.0\.4` 一起进入 npm tarball，下面的精确安装命令也固定为 `1\.0\.4`。/u,
  )
  assert.doesNotMatch(chineseReleaseSurface, /未发布|候选|继续安装/u)
  assert.deepEqual(
    chineseQuickStart.match(/dsh plugin --profile web add dsh-grok-provider@[0-9]+\.[0-9]+\.[0-9]+/gu),
    ["dsh plugin --profile web add dsh-grok-provider@1.0.4"],
  )
  assert.match(chineseReadme, /\[`THIRD_PARTY_NOTICES\.md`\]\(THIRD_PARTY_NOTICES\.md\)/u)
  assert.match(englishReadme, /## Quick start/u)
  assert.match(englishReadme, /## Security and privacy/u)
  assert.match(
    englishPreamble,
    /This README describes the `dsh-grok-provider@1\.0\.4` artifact; version `0\.1\.8` was published and then withdrawn and cannot be reused\./u,
  )
  assert.match(
    englishPreamble,
    /This README is included in the `1\.0\.4` npm tarball, and the exact installation command below is pinned to `1\.0\.4`\./u,
  )
  assert.doesNotMatch(englishReleaseSurface, /unpublished|candidate|continue installing/iu)
  assert.deepEqual(
    englishQuickStart.match(/dsh plugin --profile web add dsh-grok-provider@[0-9]+\.[0-9]+\.[0-9]+/gu),
    ["dsh plugin --profile web add dsh-grok-provider@1.0.4"],
  )
  assert.match(englishReadme, /\[`THIRD_PARTY_NOTICES\.md`\]\(THIRD_PARTY_NOTICES\.md\)/u)
  const securityPolicy = await fs.readFile(path.join(root, "SECURITY.md"), "utf8")
  assert.match(securityPolicy, /本安全策略对应 `dsh-grok-provider@1\.0\.4` 制品/u)
  assert.match(
    securityPolicy,
    /Release security note: the published `1\.0\.2` artifact changes visible reasoning projection and its aligned replay envelope/u,
  )
  const currentReleaseNotes = await fs.readFile(
    path.join(root, "docs/releases/v1.0.2.md"),
    "utf8",
  )
  assert.equal(currentReleaseNotes.startsWith("## 中文\n"), true)
  assert.match(currentReleaseNotes, /多个完整闭合、但没有任何可见内容的 reasoning lifecycle/u)
  assert.match(currentReleaseNotes, /10 个空 reasoning/u)
  assert.match(currentReleaseNotes, /Web Search 实际完成 5 个 Search lifecycle/u)
  assert.match(currentReleaseNotes, /X Search 实际完成 3 个 custom-tool Search lifecycle/u)
  assert.match(currentReleaseNotes, /dsh-grok-provider@1\.0\.2/u)
  assert.match(currentReleaseNotes, /\n<details>\n<summary>English release notes<\/summary>\n/u)
  assert.match(currentReleaseNotes, /`dsh-grok-provider@1\.0\.2` 已正式发布/u)
  assert.doesNotMatch(currentReleaseNotes, /尚未发布|unpublished.*candidate|仍须逐项实际完成/iu)
  assert.match(currentReleaseNotes, /be200f9352afe93b27dd2856d89c01674f0cd637/u)
  assert.match(currentReleaseNotes, /b7efd3aabb99c73e1747d2d87890cdf9b284c438/u)
  assert.match(currentReleaseNotes, /33318426571/u)
  assert.match(currentReleaseNotes, /33319150964.*attempt 1/su)
  assert.match(currentReleaseNotes, /74 文件.*255,282 bytes.*789,962 bytes/su)
  assert.match(currentReleaseNotes, /3feddb7048fe4c796037804518999b12ae491802/u)
  assert.match(currentReleaseNotes, /010a21770cb3e4e42b7195984df1f5bf8dc5027066198cf99b7d713ac045f605/u)
  assert.match(
    currentReleaseNotes,
    /sha512-TcvvPUXBJZEA728pVnUrXSZebGfIoB5ATG5041wA1OFzOE\+hFTO98C5Fxl99WuFW2y7V89gkusYIKCpGlLNQIg==/u,
  )
  assert.match(currentReleaseNotes, /冻结候选、GitHub Release asset 与 npm Registry tarball 逐字节一致/u)
  assert.match(
    currentReleaseNotes,
    /npm 确认 `dsh-grok-provider@1\.0\.2` 可安装且 `latest=1\.0\.2`/u,
  )
  assert.match(currentReleaseNotes, /11 个 Registry 签名包与 2 个 attested 包/u)
  assert.match(currentReleaseNotes, /1 个 Registry signature 与 2 个 attestations/u)
  assert.match(currentReleaseNotes, /`refs\/tags\/v1\.0\.2`/u)
  assert.match(currentReleaseNotes, /不构成网络可达 Windows 真机外部浏览器弹出验收/u)
  assert.match(currentReleaseNotes, /is not real-device Windows external-browser acceptance/u)
  const nextReleaseNotes = await fs.readFile(
    path.join(root, "docs/releases/v1.0.4.md"),
    "utf8",
  )
  assert.match(nextReleaseNotes, /^# dsh-grok-provider v1\.0\.4$/mu)
  assert.match(nextReleaseNotes, /installSection/u)
  assert.match(nextReleaseNotes, /dsh plugin --profile web add dsh-grok-provider@1\.0\.4/u)
  assert.match(nextReleaseNotes, /<summary>English<\/summary>/u)
  const releaseNotes = await fs.readFile(
    path.join(root, "docs/releases/v1.0.1.md"),
    "utf8",
  )
  assert.equal(releaseNotes.startsWith("## 中文\n"), true)
  assert.match(releaseNotes, /`1\.0\.1` 已正式发布/u)
  assert.doesNotMatch(releaseNotes, /尚未发布|unpublished.*candidate/iu)
  assert.match(releaseNotes, /HTTP 400/iu)
  assert.match(releaseNotes, /40.*38.*2/su)
  assert.match(releaseNotes, /PROVIDER_ERROR/u)
  assert.match(releaseNotes, /dsh-grok-provider@1\.0\.1/u)
  assert.match(releaseNotes, /\n<details>\n<summary>English release notes<\/summary>\n/u)
  assert.doesNotMatch(releaseNotes, /\n## English\n/u)
  assert.doesNotMatch(releaseNotes, /^# .*1\.0\.1/mu)

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
  for (const file of await collectDistFiles(path.join(root, "dist"))) {
    const source = await fs.readFile(file, "utf8")
    assert.doesNotMatch(
      source,
      /installSettingsSection|settingsNamespace/u,
      `${path.relative(root, file)} must not import deleted settings helpers`,
    )
  }
  assert.match(host, /export const name = "llm-grok"/u)
  assert.match(host, /const SETTINGS_NAMESPACE = "llm-grok"/u)
  assert.match(host, /settings\.installSection\(/u)
  assert.doesNotMatch(host, /installSettingsSection|settingsNamespace/u)
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

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..")

test("the exact 0.1.2 manifest exports runtime artifacts and Web loader metadata", async () => {
  const attributes = await fs.readFile(path.join(root, ".gitattributes"), "utf8")
  assert.match(attributes, /^\*\.yml text eol=lf$/mu)
  const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
  assert.equal(manifest.name, "dsh-grok-provider")
  assert.equal(manifest.version, "0.1.2")
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
    "CHANGELOG.md",
  ])
  assert.equal(manifest.dependencies, undefined)
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-credentials"], undefined)
  assert.equal(manifest.devDependencies["@deepseek-ai/dsh-credentials"], undefined)
  assert.equal(manifest.scripts.prepack, "npm run build")
  assert.equal(manifest.scripts["pack:check"], "npm pack --dry-run --json")

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
  assert.match(releaseWorkflow, /test "\$is_prerelease" = false/u)
  assert.doesNotMatch(releaseWorkflow, /inputs\.dist[_-]tag/u)

  const chineseReadme = await fs.readFile(path.join(root, "README.md"), "utf8")
  const englishReadme = await fs.readFile(path.join(root, "README.en.md"), "utf8")
  assert.match(chineseReadme, /\[English\]\(README\.en\.md\)/u)
  assert.match(englishReadme, /\[简体中文\]\(README\.md\)/u)
  assert.match(chineseReadme, /## 快速开始/u)
  assert.match(chineseReadme, /## 安全与隐私/u)
  assert.match(englishReadme, /## Quick start/u)
  assert.match(englishReadme, /## Security and privacy/u)
  for (const filename of ["CONTRIBUTING.md", "SECURITY.md"]) {
    assert.match(chineseReadme, new RegExp(`\\(${filename.replace(".", "\\.")}\\)`, "u"))
    await fs.access(path.join(root, filename))
  }

  const host = await fs.readFile(path.join(root, "dist/host/index.mjs"), "utf8")
  const client = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  assert.match(host, /export const name = "llm-grok"/u)
  assert.match(client, /id: "dsh-grok-provider"/u)
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

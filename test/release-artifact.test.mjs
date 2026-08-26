import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..")

test("the exact 0.1.0 manifest exports only built runtime artifacts", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
  assert.equal(manifest.name, "dsh-grok-provider-yukiryou")
  assert.equal(manifest.version, "0.1.0")
  assert.deepEqual(manifest.exports["."], {
    types: "./types/index.d.ts",
    default: "./dist/host/index.mjs",
  })
  assert.deepEqual(manifest.exports["./client"], { default: "./dist/client/client.js" })
  assert.deepEqual(manifest.files, [
    "dist",
    "docs",
    "types",
    "grok-provider.patch.yml",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
  ])
  assert.equal(manifest.dependencies, undefined)
  assert.equal(manifest.peerDependencies["@deepseek-ai/dsh-credentials"], undefined)
  assert.equal(manifest.devDependencies["@deepseek-ai/dsh-credentials"], undefined)
  assert.equal(manifest.scripts.prepack, "npm run build")
  assert.equal(manifest.scripts["pack:check"], "npm pack --dry-run --json")

  const host = await fs.readFile(path.join(root, "dist/host/index.mjs"), "utf8")
  const client = await fs.readFile(path.join(root, "dist/client/client.js"), "utf8")
  assert.match(host, /export const name = "llm-grok"/u)
  assert.match(client, /id: "dsh-grok-provider-yukiryou"/u)
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

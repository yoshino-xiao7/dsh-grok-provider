import assert from "node:assert/strict"
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { verifyOfficialCliExecutable } from "../../../src/internal/official-cli-verifier.mjs"

test("macOS verification accepts an owned executable symlink only when it resolves inside GROK_HOME", {
  skip: process.platform !== "darwin",
}, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dsh-grok-verifier-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const grokHome = path.join(root, ".grok")
  const bin = path.join(grokHome, "bin")
  const downloads = path.join(grokHome, "downloads")
  await mkdir(bin, { recursive: true })
  await mkdir(downloads, { recursive: true })
  const resolved = path.join(downloads, "grok-macos-aarch64")
  const candidate = path.join(bin, "grok")
  await writeFile(resolved, "fixture")
  await chmod(resolved, 0o700)
  await symlink("../downloads/grok-macos-aarch64", candidate)

  await verifyOfficialCliExecutable({ candidate, resolved, grokHome, platform: "darwin" })

  const outside = path.join(root, "outside")
  await writeFile(outside, "fixture")
  await chmod(outside, 0o700)
  await assert.rejects(
    verifyOfficialCliExecutable({ candidate, resolved: outside, grokHome, platform: "darwin" }),
    { name: "OfficialCliVerificationError" },
  )
})

test("Windows verification accepts only a regular exe inside GROK_HOME", {
  skip: process.platform !== "win32",
}, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dsh-grok-verifier-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const grokHome = path.join(root, ".grok")
  const bin = path.join(grokHome, "bin")
  await mkdir(bin, { recursive: true })
  const candidate = path.join(bin, "grok.exe")
  await writeFile(candidate, "fixture")

  await verifyOfficialCliExecutable({
    candidate,
    resolved: candidate,
    grokHome,
    platform: "win32",
  })
})

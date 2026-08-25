import assert from "node:assert/strict"
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  createOfficialCredentialLoader,
  isSameOpenedFile,
} from "../../../src/internal/official-credential-loader.mjs"

test("the credential loader rejects a file replaced between path inspection and open", () => {
  assert.equal(isSameOpenedFile({ dev: 10, ino: 20 }, { dev: 10, ino: 20 }), true)
  assert.equal(isSameOpenedFile({ dev: 10, ino: 20 }, { dev: 10, ino: 21 }), false)
  assert.equal(isSameOpenedFile({ dev: 10, ino: 20 }, { dev: 11, ino: 20 }), false)
})

test("the macOS credential loader reads one owned 0600 regular file and rejects symlinks", {
  skip: process.platform !== "darwin",
}, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dsh-grok-auth-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const authPath = path.join(root, "auth.json")
  await writeFile(authPath, "fixture")
  await chmod(authPath, 0o600)
  const load = createOfficialCredentialLoader({ authPath, platform: "darwin" })

  assert.equal(new TextDecoder().decode(await load()), "fixture")

  const alias = path.join(root, "alias.json")
  await symlink("auth.json", alias)
  const loadAlias = createOfficialCredentialLoader({ authPath: alias, platform: "darwin" })
  await assert.rejects(loadAlias(), { name: "OfficialCredentialFileError" })
})

test("the Windows credential loader reads the default regular credential file", {
  skip: process.platform !== "win32",
}, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dsh-grok-auth-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const authPath = path.join(root, "auth.json")
  await writeFile(authPath, "fixture")
  const load = createOfficialCredentialLoader({ authPath, platform: "win32" })

  assert.equal(new TextDecoder().decode(await load()), "fixture")
})

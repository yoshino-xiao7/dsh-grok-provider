import assert from "node:assert/strict"
import test from "node:test"

import { createOfficialAuthDriver } from "../../../src/internal/official-auth-driver.mjs"
import {
  OfficialCliAuthError,
  OfficialCliCleanupError,
} from "../../../src/internal/official-cli-auth.mjs"

test("official login succeeds only after the resulting credential passes the bound schema", async () => {
  const calls = []
  const driver = createOfficialAuthDriver({
    officialAuth: {
      async login() { calls.push("login"); return { kind: "succeeded" } },
      async logout() { calls.push("logout"); return { kind: "succeeded" } },
      async refresh() { calls.push("refresh"); return { kind: "succeeded" } },
    },
    credentialSource: {
      async withAccessToken(operation) {
        calls.push("validate")
        return operation("fixture-never-exposed")
      },
    },
  })

  const session = await driver.begin({ signal: new AbortController().signal })
  assert.deepEqual(await session.completion, { kind: "succeeded" })
  assert.deepEqual(calls, ["login", "validate"])
  assert.deepEqual(await driver.logout({ signal: new AbortController().signal }), { kind: "succeeded" })
  assert.deepEqual(await driver.refresh({ signal: new AbortController().signal }), { kind: "succeeded" })
  assert.deepEqual(calls, ["login", "validate", "logout", "refresh"])
})

test("a zero-exit official login with an invalid credential fails closed", async () => {
  const driver = createOfficialAuthDriver({
    officialAuth: {
      async login() { return { kind: "succeeded" } },
      async logout() { return { kind: "succeeded" } },
      async refresh() { return { kind: "succeeded" } },
    },
    credentialSource: {
      async withAccessToken() { throw new Error("invalid fixture credential") },
    },
  })
  const session = await driver.begin({ signal: new AbortController().signal })
  await assert.rejects(session.completion)
})

test("official CLI login failure preserves one closed reason without reading credentials", async () => {
  let credentialReads = 0
  const driver = createOfficialAuthDriver({
    officialAuth: {
      async login() { return { kind: "failed", reason: "auth-network-timeout" } },
      async logout() { return { kind: "succeeded" } },
      async refresh() { return { kind: "succeeded" } },
    },
    credentialSource: {
      async withAccessToken() { credentialReads += 1 },
    },
  })

  const session = await driver.begin({ signal: new AbortController().signal })
  assert.deepEqual(await session.completion, {
    kind: "failed",
    reason: "auth-network-timeout",
  })
  assert.equal(credentialReads, 0)
})

test("official CLI preflight errors become closed failures without reading credentials", async () => {
  let credentialReads = 0
  const driver = createOfficialAuthDriver({
    officialAuth: {
      async login() { throw new OfficialCliAuthError("cli-missing") },
      async logout() { return { kind: "succeeded" } },
      async refresh() { return { kind: "succeeded" } },
    },
    credentialSource: {
      async withAccessToken() { credentialReads += 1 },
    },
  })

  const session = await driver.begin({ signal: new AbortController().signal })
  assert.deepEqual(await session.completion, { kind: "failed", reason: "cli-missing" })
  assert.equal(credentialReads, 0)
})

test("official CLI cleanup failure is preserved for controller quarantine", async () => {
  let credentialReads = 0
  const driver = createOfficialAuthDriver({
    officialAuth: {
      async login() { throw new OfficialCliCleanupError() },
      async logout() { throw new OfficialCliCleanupError() },
      async refresh() { throw new OfficialCliCleanupError() },
    },
    credentialSource: {
      async withAccessToken() { credentialReads += 1 },
    },
  })

  const session = await driver.begin({ signal: new AbortController().signal })
  assert.deepEqual(await session.completion, { kind: "cleanup-failed" })
  assert.deepEqual(await driver.logout({ signal: new AbortController().signal }), {
    kind: "cleanup-failed",
  })
  assert.deepEqual(await driver.refresh({ signal: new AbortController().signal }), {
    kind: "cleanup-failed",
  })
  assert.equal(credentialReads, 0)
})

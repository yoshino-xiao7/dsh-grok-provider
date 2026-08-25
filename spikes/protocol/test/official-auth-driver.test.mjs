import assert from "node:assert/strict"
import test from "node:test"

import { createOfficialAuthDriver } from "../../../src/internal/official-auth-driver.mjs"

test("official login succeeds only after the resulting credential passes the bound schema", async () => {
  const calls = []
  const driver = createOfficialAuthDriver({
    officialAuth: {
      async login() { calls.push("login"); return { kind: "succeeded" } },
      async logout() { calls.push("logout"); return { kind: "succeeded" } },
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
})

test("a zero-exit official login with an invalid credential fails closed", async () => {
  const driver = createOfficialAuthDriver({
    officialAuth: {
      async login() { return { kind: "succeeded" } },
      async logout() { return { kind: "succeeded" } },
    },
    credentialSource: {
      async withAccessToken() { throw new Error("invalid fixture credential") },
    },
  })
  const session = await driver.begin({ signal: new AbortController().signal })
  await assert.rejects(session.completion)
})

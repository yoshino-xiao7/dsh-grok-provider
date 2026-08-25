import assert from "node:assert/strict"
import test from "node:test"

import { createManagedGrantStore } from "../../../src/internal/managed-grant-store.mjs"

test("a completed managed login is persisted as one owner-scoped grant record", async () => {
  const writes = []
  const credentials = {
    async readRecord() { return writes.at(-1)?.replacement },
    async modifyRecord(key, mutate) {
      const replacement = await mutate(undefined)
      writes.push({ key, replacement })
      return replacement
    },
    async deleteRecord() {},
  }
  const store = createManagedGrantStore({
    credentialKey: "dsh-grok-provider/grok-oauth",
    credentials,
    contract: {
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
  })
  const grant = {
    version: 1,
    issuer: "https://auth.x.ai",
    clientId: "fixture-authorized-client",
    accessToken: "fixture-device-access-token",
    refreshToken: "fixture-device-refresh-token",
    expiresAt: "2030-01-01T01:00:20.000Z",
    scopes: ["openid", "offline_access", "grok-cli:access"],
    generation: 1,
  }

  await store.save(grant)

  assert.deepEqual(writes, [{
    key: "dsh-grok-provider/grok-oauth",
    replacement: { kind: "grant", payload: grant },
  }])
})

test("managed logout revokes the stored refresh token before deleting its owner record", async () => {
  const grant = {
    version: 1,
    issuer: "https://auth.x.ai",
    clientId: "fixture-authorized-client",
    accessToken: "fixture-device-access-token",
    refreshToken: "fixture-device-refresh-token",
    expiresAt: "2030-01-01T01:00:20.000Z",
    scopes: ["openid", "offline_access", "grok-cli:access"],
    generation: 1,
  }
  let record = { kind: "grant", payload: grant }
  const revoked = []
  const observedStates = []
  const store = createManagedGrantStore({
    credentialKey: "dsh-grok-provider/grok-oauth",
    credentials: {
      async readRecord() { return record },
      async modifyRecord(_key, mutate) {
        const replacement = await mutate(record)
        if (replacement !== undefined) record = replacement
        return record
      },
      async deleteRecord() { record = undefined },
    },
    contract: {
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
  })

  await store.revokeAndDelete(async ({ refreshToken }) => {
    revoked.push(refreshToken)
    observedStates.push(record.payload.state)
  })

  assert.deepEqual(revoked, ["fixture-device-refresh-token"])
  assert.deepEqual(observedStates, ["revoking"])
  assert.equal(record, undefined)
})

test("a failed managed revocation restores the exact grant for an explicit retry", async () => {
  const grant = {
    version: 1,
    issuer: "https://auth.x.ai",
    clientId: "fixture-authorized-client",
    accessToken: "fixture-device-access-token",
    refreshToken: "fixture-device-refresh-token",
    expiresAt: "2030-01-01T01:00:20.000Z",
    scopes: ["openid", "offline_access", "grok-cli:access"],
    generation: 7,
  }
  let record = { kind: "grant", payload: grant }
  const store = createManagedGrantStore({
    credentialKey: "dsh-grok-provider/grok-oauth",
    credentials: {
      async readRecord() { return record },
      async modifyRecord(_key, mutate) {
        const replacement = await mutate(record)
        if (replacement !== undefined) record = replacement
        return record
      },
      async deleteRecord() { record = undefined },
    },
    contract: {
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
  })

  await assert.rejects(store.revokeAndDelete(async () => {
    assert.equal(record.payload.state, "revoking")
    throw new Error("fixture network failure")
  }), { name: "ManagedGrantStoreError" })
  assert.deepEqual(record, { kind: "grant", payload: grant })
})

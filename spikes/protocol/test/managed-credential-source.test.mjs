import assert from "node:assert/strict"
import test from "node:test"

import { createManagedCredentialSource } from "../../../src/internal/managed-credential-source.mjs"

test("an unexpired owner-scoped managed grant authorizes one operation", async () => {
  const record = {
    kind: "grant",
    payload: {
      version: 1,
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      accessToken: "fixture-managed-access-token",
      refreshToken: "fixture-managed-refresh-token",
      expiresAt: "2030-01-01T01:00:00.000Z",
      scopes: ["openid", "offline_access", "grok-cli:access"],
      generation: 1,
    },
  }
  let refreshCalled = false

  const source = createManagedCredentialSource({
    contract: {
      clientId: "fixture-authorized-client",
      issuer: "https://auth.x.ai",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
    credentialKey: "fixture-package/grok-oauth",
    credentials: {
      readRecord: async (key) => {
        assert.equal(key, "fixture-package/grok-oauth")
        return record
      },
    },
    now: () => new Date("2030-01-01T00:30:00.000Z"),
    refreshGrant: async () => {
      refreshCalled = true
      throw new Error("refresh should not run")
    },
  })

  const result = await source.withAccessToken(async (token) => {
    assert.equal(token, "fixture-managed-access-token")
    return { authorized: true }
  })

  assert.deepEqual(result, { authorized: true })
  assert.equal(refreshCalled, false)
  assert.equal(JSON.stringify(result).includes("fixture-managed-refresh-token"), false)
})

test("an expired managed grant rotates refresh and access tokens atomically", async () => {
  let storedRecord = {
    kind: "grant",
    payload: {
      version: 1,
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      accessToken: "fixture-expired-access-token",
      refreshToken: "fixture-old-refresh-token",
      expiresAt: "2029-12-31T23:59:00.000Z",
      scopes: ["openid", "offline_access", "grok-cli:access"],
      generation: 4,
    },
  }
  let mutationCount = 0

  const source = createManagedCredentialSource({
    contract: {
      clientId: "fixture-authorized-client",
      issuer: "https://auth.x.ai",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
    credentialKey: "fixture-package/grok-oauth",
    credentials: {
      readRecord: async () => storedRecord,
      modifyRecord: async (key, mutate) => {
        assert.equal(key, "fixture-package/grok-oauth")
        mutationCount += 1
        const replacement = await mutate(storedRecord)
        if (replacement !== undefined) storedRecord = replacement
        return storedRecord
      },
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refreshGrant: async ({ refreshToken }) => {
      assert.equal(refreshToken, "fixture-old-refresh-token")
      return {
        accessToken: "fixture-rotated-access-token",
        refreshToken: "fixture-rotated-refresh-token",
        expiresAt: "2030-01-01T01:00:00.000Z",
        scopes: ["openid", "offline_access", "grok-cli:access"],
      }
    },
  })

  const result = await source.withAccessToken(async (token) => {
    assert.equal(token, "fixture-rotated-access-token")
    return { authorized: true }
  })

  assert.deepEqual(result, { authorized: true })
  assert.equal(mutationCount, 1)
  assert.equal(storedRecord.payload.generation, 5)
  assert.equal(storedRecord.payload.refreshToken, "fixture-rotated-refresh-token")
})

test("a managed grant inside the five-minute refresh window rotates before use", async () => {
  let storedRecord = {
    kind: "grant",
    payload: {
      version: 1,
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      accessToken: "fixture-expiring-access-token",
      refreshToken: "fixture-expiring-refresh-token",
      expiresAt: "2030-01-01T00:04:00.000Z",
      scopes: ["openid", "offline_access", "grok-cli:access"],
      generation: 8,
    },
  }

  const source = createManagedCredentialSource({
    contract: {
      clientId: "fixture-authorized-client",
      issuer: "https://auth.x.ai",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
    credentialKey: "fixture-package/grok-oauth",
    credentials: {
      readRecord: async () => storedRecord,
      modifyRecord: async (_key, mutate) => {
        const replacement = await mutate(storedRecord)
        if (replacement !== undefined) storedRecord = replacement
        return storedRecord
      },
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refreshGrant: async () => ({
      accessToken: "fixture-refreshed-before-use",
      refreshToken: "fixture-refreshed-before-use-refresh",
      expiresAt: "2030-01-01T01:00:00.000Z",
      scopes: ["openid", "offline_access", "grok-cli:access"],
    }),
  })

  await source.withAccessToken(async (token) => {
    assert.equal(token, "fixture-refreshed-before-use")
  })
  assert.equal(storedRecord.payload.generation, 9)
})

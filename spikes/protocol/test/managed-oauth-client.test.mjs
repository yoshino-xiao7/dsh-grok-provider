import assert from "node:assert/strict"
import test from "node:test"

import { createManagedOAuthClient } from "../../../src/internal/managed-oauth-client.mjs"

test("managed refresh posts a public-client grant to the fixed xAI token endpoint", async () => {
  const requests = []
  const client = createManagedOAuthClient({
    contract: {
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      revocationEndpoint: "https://auth.x.ai/oauth2/revoke",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    fetch: async (url, init) => {
      requests.push({ url, init })
      if (url.endsWith("/revoke")) return new Response(null, { status: 200 })
      return new Response(JSON.stringify({
        access_token: "fixture-new-access-token",
        refresh_token: "fixture-new-refresh-token",
        expires_in: 3600,
        scope: "openid offline_access grok-cli:access",
        token_type: "Bearer",
      }), { status: 200, headers: { "content-type": "application/json" } })
    },
  })

  const refreshed = await client.refreshGrant({
    refreshToken: "fixture-old-refresh-token",
    scopes: ["openid", "offline_access", "grok-cli:access"],
  })

  assert.deepEqual(refreshed, {
    accessToken: "fixture-new-access-token",
    refreshToken: "fixture-new-refresh-token",
    expiresAt: "2030-01-01T01:00:00.000Z",
    scopes: ["openid", "offline_access", "grok-cli:access"],
  })
  assert.equal(requests[0].url, "https://auth.x.ai/oauth2/token")
  assert.equal(requests[0].init.method, "POST")
  assert.equal(requests[0].init.redirect, "error")
  assert.equal(requests[0].init.headers.get("content-type"), "application/x-www-form-urlencoded")
  assert.equal(requests[0].init.body, new URLSearchParams({
    client_id: "fixture-authorized-client",
    grant_type: "refresh_token",
    refresh_token: "fixture-old-refresh-token",
    scope: "openid offline_access grok-cli:access",
  }).toString())

  await client.revoke({ refreshToken: "fixture-new-refresh-token" })
  assert.equal(requests[1].url, "https://auth.x.ai/oauth2/revoke")
  assert.equal(requests[1].init.redirect, "error")
  assert.equal(requests[1].init.body, new URLSearchParams({
    client_id: "fixture-authorized-client",
    token: "fixture-new-refresh-token",
    token_type_hint: "refresh_token",
  }).toString())
})

test("managed OAuth owns a per-request deadline without misreporting it as user cancellation", async () => {
  const client = createManagedOAuthClient({
    contract: {
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      revocationEndpoint: "https://auth.x.ai/oauth2/revoke",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    requestTimeoutMs: 5,
    fetch: async (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => {
      reject(new DOMException("Timed out", "AbortError"))
    }, { once: true })),
  })

  await assert.rejects(Promise.race([
    client.refreshGrant({
      refreshToken: "fixture-old-refresh-token",
      scopes: ["openid", "offline_access", "grok-cli:access"],
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("deadline missing")), 50)),
  ]), { name: "ManagedOAuthClientError" })
})

import assert from "node:assert/strict"
import test from "node:test"

import { createManagedDeviceFlow } from "../../../src/internal/managed-device-flow.mjs"

test("device authorization exposes only a fixed verification surface to the UI", async () => {
  const requests = []
  const flow = createManagedDeviceFlow({
    contract: {
      clientId: "fixture-authorized-client",
      deviceAuthorizationEndpoint: "https://auth.x.ai/oauth2/device/code",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      verificationOrigin: "https://auth.x.ai",
      verificationPath: "/oauth2/device/fixture-client-surface",
      scopes: ["openid", "offline_access", "grok-cli:access"],
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    request: async (request) => {
      requests.push(request)
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          device_code: "fixture-private-device-code",
          user_code: "ABCD-EFGH",
          verification_uri: "https://auth.x.ai/oauth2/device/fixture-client-surface",
          verification_uri_complete: "https://auth.x.ai/oauth2/device/fixture-client-surface?user_code=ABCD-EFGH",
          expires_in: 900,
          interval: 5,
        }),
      }
    },
  })

  const session = await flow.begin()

  assert.deepEqual(requests, [{
    endpoint: "https://auth.x.ai/oauth2/device/code",
    form: {
      client_id: "fixture-authorized-client",
      scope: "openid offline_access grok-cli:access",
    },
    signal: undefined,
  }])
  assert.deepEqual(session.public, {
    verificationUri: "https://auth.x.ai/oauth2/device/fixture-client-surface",
    verificationUriComplete: "https://auth.x.ai/oauth2/device/fixture-client-surface?user_code=ABCD-EFGH",
    userCode: "ABCD-EFGH",
    expiresAt: "2030-01-01T00:15:00.000Z",
  })
  assert.equal(JSON.stringify(session).includes("fixture-private-device-code"), false)
})

test("device polling honors pending and slow_down before returning a normalized grant", async () => {
  let currentTime = new Date("2030-01-01T00:00:00.000Z")
  const sleeps = []
  let tokenAttempt = 0

  const flow = createManagedDeviceFlow({
    contract: {
      clientId: "fixture-authorized-client",
      deviceAuthorizationEndpoint: "https://auth.x.ai/oauth2/device/code",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      verificationOrigin: "https://auth.x.ai",
      verificationPath: "/oauth2/device/fixture-client-surface",
      scopes: ["openid", "offline_access", "grok-cli:access"],
    },
    now: () => currentTime,
    sleep: async (delayMs) => {
      sleeps.push(delayMs)
      currentTime = new Date(currentTime.getTime() + delayMs)
    },
    request: async ({ endpoint, form }) => {
      if (endpoint.endsWith("/device/code")) {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            device_code: "fixture-private-device-code",
            user_code: "ABCD-EFGH",
            verification_uri: "https://auth.x.ai/oauth2/device/fixture-client-surface",
            verification_uri_complete: "https://auth.x.ai/oauth2/device/fixture-client-surface?user_code=ABCD-EFGH",
            expires_in: 900,
            interval: 5,
          }),
        }
      }

      assert.equal(endpoint, "https://auth.x.ai/oauth2/token")
      assert.deepEqual(form, {
        client_id: "fixture-authorized-client",
        device_code: "fixture-private-device-code",
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      })
      tokenAttempt += 1
      if (tokenAttempt === 1) {
        return { status: 400, contentType: "application/json", body: '{"error":"authorization_pending"}' }
      }
      if (tokenAttempt === 2) {
        return { status: 400, contentType: "application/json", body: '{"error":"slow_down"}' }
      }
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "fixture-device-access-token",
          refresh_token: "fixture-device-refresh-token",
          expires_in: 3600,
          scope: "openid offline_access grok-cli:access",
          token_type: "Bearer",
        }),
      }
    },
  })

  const session = await flow.begin()
  const grant = await flow.waitForGrant(session)

  assert.deepEqual(sleeps, [5_000, 5_000, 10_000])
  assert.deepEqual(grant, {
    version: 1,
    issuer: "https://auth.x.ai",
    clientId: "fixture-authorized-client",
    accessToken: "fixture-device-access-token",
    refreshToken: "fixture-device-refresh-token",
    expiresAt: "2030-01-01T01:00:20.000Z",
    scopes: ["openid", "offline_access", "grok-cli:access"],
    generation: 1,
  })
  assert.equal(JSON.stringify(grant).includes("fixture-private-device-code"), false)
})

import assert from "node:assert/strict"
import test from "node:test"

import {
  GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  createCredentialSource,
} from "../../../src/internal/credential-source.mjs"
import { createAuthController } from "../../../src/internal/auth-controller.mjs"

test("a unique Grok production OIDC record authorizes one operation", async () => {
  const fixture = JSON.stringify({
    "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
      key: "fixture-access-token",
      auth_mode: "oidc",
      create_time: "2030-01-01T00:00:00.000Z",
      user_id: "fixture-user-id",
      email: "fixture@example.invalid",
      first_name: "Fixture",
      profile_image_asset_id: "fixture-profile-image",
      principal_type: "user",
      principal_id: "fixture-principal-id",
      team_id: "fixture-team-id",
      coding_data_retention_opt_out: false,
      refresh_token: "fixture-refresh-token-must-be-ignored",
      expires_at: "2030-01-01T01:00:00.000Z",
      oidc_issuer: "https://auth.x.ai",
      oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
    },
  })

  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => fixture,
    now: () => new Date("2030-01-01T00:30:00.000Z"),
  })

  const result = await source.withAccessToken(async (token, metadata) => {
    assert.equal(token, "fixture-access-token")
    assert.deepEqual(metadata, { userId: "fixture-user-id" })
    return { authorized: true }
  })

  assert.deepEqual(result, { authorized: true })
  assert.equal(JSON.stringify(result).includes("fixture-refresh-token"), false)
  assert.equal(JSON.stringify(result).includes("fixture@example.invalid"), false)
})

test("a credential file larger than 64 KiB is rejected before authorization", async () => {
  const fixture = JSON.stringify({
    "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
      key: "fixture-access-token",
      auth_mode: "oidc",
      expires_at: "2030-01-01T01:00:00.000Z",
      oidc_issuer: "https://auth.x.ai",
      oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
      ignored: "界".repeat(22_000),
    },
  })
  let operationCalled = false

  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => fixture,
    now: () => new Date("2030-01-01T00:30:00.000Z"),
  })

  await assert.rejects(
    source.withAccessToken(async () => {
      operationCalled = true
    }),
    {
      name: "CredentialFileTooLargeError",
      message: "The Grok credential file exceeds the 64 KiB limit",
    },
  )
  assert.equal(operationCalled, false)
})

test("an authorized operation failure is not misclassified as a credential failure", async () => {
  const fixture = JSON.stringify({
    "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
      key: "fixture-access-token",
      auth_mode: "oidc",
      expires_at: "2030-01-01T01:00:00.000Z",
      oidc_issuer: "https://auth.x.ai",
      oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
    },
  })
  const transportFailure = new Error("fixture transport failure")
  transportFailure.name = "FixtureTransportError"

  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => fixture,
    now: () => new Date("2030-01-01T00:30:00.000Z"),
  })

  await assert.rejects(
    source.withAccessToken(async () => {
      throw transportFailure
    }),
    (error) => error === transportFailure,
  )
})

test("an official access token inside the five-minute expiry window is rejected", async () => {
  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => JSON.stringify({
      "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
        key: "fixture-access-token",
        auth_mode: "oidc",
        expires_at: "2030-01-01T00:04:59.000Z",
        oidc_issuer: "https://auth.x.ai",
        oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
      },
    }),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
  })

  await assert.rejects(source.withAccessToken(async () => {}), { name: "UnsupportedCredentialError" })
})

test("an expired official access token is refreshed by the CLI before one operation", async () => {
  let refreshed = false
  let refreshCalls = 0
  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => JSON.stringify({
      "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
        key: refreshed ? "fresh-access-token" : "expired-access-token",
        auth_mode: "oidc",
        expires_at: refreshed ? "2030-01-01T01:00:00.000Z" : "2029-12-31T23:00:00.000Z",
        oidc_issuer: "https://auth.x.ai",
        oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
      },
    }),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => {
      refreshCalls += 1
      refreshed = true
    },
  })

  const result = await source.withAccessToken(async (token) => token)

  assert.equal(result, "fresh-access-token")
  assert.equal(refreshCalls, 1)
})

test("subprocess disposal makes an in-flight credential refresh fail closed", async () => {
  let refreshStarted
  const started = new Promise((resolve) => { refreshStarted = resolve })
  const controller = createAuthController({
    registry: {
      invalidate() {},
      async status() { return {} },
    },
    randomUUID: () => "disposed-refresh",
  })
  const removeDriver = controller.installDriver({
    async begin() {
      return { completion: Promise.resolve({ kind: "succeeded" }) }
    },
    async refresh({ signal }) {
      refreshStarted()
      return new Promise((resolve) => signal.addEventListener("abort", () => {
        resolve({ kind: "succeeded" })
      }, { once: true }))
    },
  })
  let loadCalls = 0
  let operationCalls = 0
  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => {
      loadCalls += 1
      return JSON.stringify({
        "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
          key: "expired-access-token",
          auth_mode: "oidc",
          expires_at: "2029-12-31T23:00:00.000Z",
          oidc_issuer: "https://auth.x.ai",
          oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
        },
      })
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => {
      const outcome = await controller.refresh()
      if (outcome.kind !== "succeeded") throw new Error("fixture refresh rejected")
    },
  })

  const request = source.withAccessToken(async () => {
    operationCalls += 1
  })
  await started
  removeDriver()
  assert.equal(await controller.shutdown(), true)

  await assert.rejects(request, { name: "UnsupportedCredentialError" })
  assert.equal(loadCalls, 1)
  assert.equal(operationCalls, 0)
})

test("concurrent operations share one official CLI credential refresh", async () => {
  let refreshed = false
  let refreshCalls = 0
  let finishRefresh
  const refreshGate = new Promise((resolve) => { finishRefresh = resolve })
  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => JSON.stringify({
      "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
        key: refreshed ? "fresh-access-token" : "expired-access-token",
        auth_mode: "oidc",
        expires_at: refreshed ? "2030-01-01T01:00:00.000Z" : "2029-12-31T23:00:00.000Z",
        oidc_issuer: "https://auth.x.ai",
        oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
      },
    }),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => {
      refreshCalls += 1
      await refreshGate
      refreshed = true
    },
  })

  const first = source.withAccessToken(async (token) => token)
  const second = source.withAccessToken(async (token) => token)
  await new Promise((resolve) => setImmediate(resolve))
  finishRefresh()

  assert.deepEqual(await Promise.all([first, second]), ["fresh-access-token", "fresh-access-token"])
  assert.equal(refreshCalls, 1)
})

test("a foreign credential contract never invokes the official CLI refresher", async () => {
  let refreshCalls = 0
  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => JSON.stringify({
      "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
        key: "foreign-access-token",
        auth_mode: "oidc",
        expires_at: "2029-12-31T23:00:00.000Z",
        oidc_issuer: "https://foreign.example.invalid",
        oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
      },
    }),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => { refreshCalls += 1 },
  })

  await assert.rejects(source.withAccessToken(async () => {}), { name: "UnsupportedCredentialError" })
  assert.equal(refreshCalls, 0)
})

test("a failed official CLI refresh fails closed without retrying the operation", async () => {
  let loadCalls = 0
  let refreshCalls = 0
  let operationCalls = 0
  const source = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => {
      loadCalls += 1
      return JSON.stringify({
        "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828": {
          key: "expired-access-token",
          auth_mode: "oidc",
          expires_at: "2029-12-31T23:00:00.000Z",
          oidc_issuer: "https://auth.x.ai",
          oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
        },
      })
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => {
      refreshCalls += 1
      throw new Error("fixture CLI failure must not escape")
    },
  })

  await assert.rejects(source.withAccessToken(async () => {
    operationCalls += 1
  }), { name: "UnsupportedCredentialError" })
  assert.equal(loadCalls, 1)
  assert.equal(refreshCalls, 1)
  assert.equal(operationCalls, 0)
})

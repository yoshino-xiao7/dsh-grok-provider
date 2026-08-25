import assert from "node:assert/strict"
import test from "node:test"

import {
  GROK_CLI_1_0_5_AUTH_CONTRACT,
  createCredentialSource,
} from "../../../src/internal/credential-source.mjs"

test("a unique Grok CLI 1.0.5 production OIDC record authorizes one operation", async () => {
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
    contract: GROK_CLI_1_0_5_AUTH_CONTRACT,
    load: async () => fixture,
    now: () => new Date("2030-01-01T00:30:00.000Z"),
  })

  const result = await source.withAccessToken(async (token) => {
    assert.equal(token, "fixture-access-token")
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
    contract: GROK_CLI_1_0_5_AUTH_CONTRACT,
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
    contract: GROK_CLI_1_0_5_AUTH_CONTRACT,
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
    contract: GROK_CLI_1_0_5_AUTH_CONTRACT,
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

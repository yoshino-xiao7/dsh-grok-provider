import assert from "node:assert/strict"
import test from "node:test"

import { createAuthController } from "../../../src/internal/auth-controller.mjs"
import { createAuthRegistry } from "../../../src/internal/auth-registry.mjs"
import { installManagedCapability } from "../../../src/internal/managed-capability.mjs"

test("managed capability completes device login, persists the grant, and installs its credential source", async () => {
  let stored
  const credentials = {
    async readRecord() { return stored },
    async modifyRecord(_key, mutate) {
      const replacement = await mutate(stored)
      if (replacement !== undefined) stored = replacement
      return stored
    },
    async deleteRecord() { stored = undefined },
  }
  const registry = createAuthRegistry({
    initialMode: "official-cli",
    createTransport: (source) => ({ source }),
  })
  registry.install("official-cli", { id: "official" })
  const controller = createAuthController({ registry, randomUUID: () => "managed-session" })
  const grant = {
    version: 1,
    issuer: "https://auth.x.ai",
    clientId: "fixture-authorized-client",
    accessToken: "fixture-access",
    refreshToken: "fixture-refresh",
    expiresAt: "2030-01-01T01:00:00.000Z",
    scopes: ["openid", "offline_access", "grok-cli:access"],
    generation: 1,
  }
  const revoked = []
  installManagedCapability({
    controller,
    registry,
    credentials,
    credentialKey: "dsh-grok-provider-yukiryou/grok-oauth",
    contract: {
      issuer: "https://auth.x.ai",
      clientId: "fixture-authorized-client",
      deviceAuthorizationEndpoint: "https://auth.x.ai/oauth2/device/code",
      tokenEndpoint: "https://auth.x.ai/oauth2/token",
      revocationEndpoint: "https://auth.x.ai/oauth2/revoke",
      verificationOrigin: "https://auth.x.ai",
      verificationPath: "/oauth2/device/fixture-client-surface",
      requiredScopes: ["openid", "offline_access", "grok-cli:access"],
    },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    oauthClient: {
      refreshGrant: async () => { throw new Error("not used") },
      async revoke({ refreshToken }) { revoked.push(refreshToken) },
    },
    deviceFlow: {
      async begin() {
        return { public: {
          verificationUri: "https://auth.x.ai/oauth2/device/fixture-client-surface",
          verificationUriComplete: "https://auth.x.ai/oauth2/device/fixture-client-surface?user_code=ABCD-EFGH",
          userCode: "ABCD-EFGH",
          expiresAt: "2030-01-01T00:15:00.000Z",
        } }
      },
      async waitForGrant() { return grant },
    },
  })

  const session = await controller.beginLogin("managed-device")
  assert.equal(session.public.userCode, "ABCD-EFGH")
  assert.deepEqual(await session.wait(), { kind: "succeeded" })
  assert.deepEqual(stored, { kind: "grant", payload: grant })
  registry.select("managed-device")
  assert.equal(registry.getGeneration().mode, "managed-device")
  assert.equal((await controller.logout("managed-device")).kind, "confirmation-required")
  assert.deepEqual(await controller.logout("managed-device"), { kind: "succeeded" })
  assert.deepEqual(revoked, ["fixture-refresh"])
  assert.equal(stored, undefined)
})

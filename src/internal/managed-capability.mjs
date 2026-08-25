import { createManagedCredentialSource } from "./managed-credential-source.mjs"
import { createManagedDeviceFlow } from "./managed-device-flow.mjs"
import { createManagedGrantStore } from "./managed-grant-store.mjs"
import { createManagedOAuthClient } from "./managed-oauth-client.mjs"

export function installManagedCapability({
  controller,
  registry,
  credentials,
  credentialKey,
  contract,
  now,
  fetch,
  sleep,
  oauthClient,
  deviceFlow,
}) {
  if (
    !controller ||
    typeof controller.installDriver !== "function" ||
    typeof controller.shutdown !== "function" ||
    !registry ||
    typeof registry.install !== "function" ||
    !credentials ||
    typeof credentialKey !== "string" ||
    credentialKey.length === 0 ||
    !isContract(contract) ||
    typeof now !== "function"
  ) throw new TypeError("Invalid managed Grok capability dependencies")

  const oauth = oauthClient ?? createManagedOAuthClient({ contract, fetch, now })
  if (!oauth || typeof oauth.refreshGrant !== "function" || typeof oauth.revoke !== "function") {
    throw new TypeError("Invalid managed Grok OAuth client")
  }
  const flow = deviceFlow ?? createManagedDeviceFlow({
    contract: {
      clientId: contract.clientId,
      deviceAuthorizationEndpoint: contract.deviceAuthorizationEndpoint,
      tokenEndpoint: contract.tokenEndpoint,
      verificationOrigin: contract.verificationOrigin,
      verificationPath: contract.verificationPath,
      scopes: [...contract.requiredScopes],
    },
    now,
    request: oauth.request,
    ...(sleep === undefined ? {} : { sleep }),
  })
  if (!flow || typeof flow.begin !== "function" || typeof flow.waitForGrant !== "function") {
    throw new TypeError("Invalid managed Grok device flow")
  }

  const source = createManagedCredentialSource({
    contract: {
      issuer: contract.issuer,
      clientId: contract.clientId,
      requiredScopes: [...contract.requiredScopes],
    },
    credentialKey,
    credentials,
    now,
    refreshGrant: (request) => oauth.refreshGrant(request),
  })
  const store = createManagedGrantStore({
    credentialKey,
    credentials,
    contract: {
      issuer: contract.issuer,
      clientId: contract.clientId,
      requiredScopes: [...contract.requiredScopes],
    },
  })
  const removeSource = registry.install("managed-device", source)
  const removeDriver = controller.installDriver("managed-device", {
    async begin({ signal }) {
      const deviceSession = await flow.begin({ signal })
      return {
        public: deviceSession.public,
        completion: (async () => {
          let grant
          try {
            grant = await flow.waitForGrant(deviceSession, { signal })
            await store.save(grant)
            return Object.freeze({ kind: "succeeded" })
          } finally {
            grant = undefined
          }
        })(),
      }
    },
    async logout({ signal }) {
      await store.revokeAndDelete(({ refreshToken }) => oauth.revoke({ refreshToken, signal }))
      return Object.freeze({ kind: "succeeded" })
    },
  })
  let disposed = false

  return async () => {
    if (disposed) return
    disposed = true
    await controller.shutdown("managed-device")
    removeDriver()
    removeSource()
  }
}

function isContract(contract) {
  return (
    contract !== null &&
    typeof contract === "object" &&
    contract.issuer === "https://auth.x.ai" &&
    typeof contract.clientId === "string" &&
    contract.clientId.length > 0 &&
    contract.deviceAuthorizationEndpoint === "https://auth.x.ai/oauth2/device/code" &&
    contract.tokenEndpoint === "https://auth.x.ai/oauth2/token" &&
    contract.revocationEndpoint === "https://auth.x.ai/oauth2/revoke" &&
    contract.verificationOrigin === "https://auth.x.ai" &&
    typeof contract.verificationPath === "string" &&
    contract.verificationPath.startsWith("/oauth2/device/") &&
    Array.isArray(contract.requiredScopes) &&
    contract.requiredScopes.length > 0
  )
}

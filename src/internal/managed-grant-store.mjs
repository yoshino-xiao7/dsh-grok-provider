const GRANT_FIELDS = [
  "accessToken",
  "clientId",
  "expiresAt",
  "generation",
  "issuer",
  "refreshToken",
  "scopes",
  "version",
]

export class ManagedGrantStoreError extends Error {
  constructor() {
    super("The managed Grok credential could not be persisted")
    this.name = "ManagedGrantStoreError"
  }
}

export function createManagedGrantStore({ credentialKey, credentials, contract }) {
  if (
    typeof credentialKey !== "string" ||
    credentialKey.length === 0 ||
    credentialKey.length > 256 ||
    !credentials ||
    typeof credentials.modifyRecord !== "function" ||
    typeof credentials.readRecord !== "function" ||
    typeof credentials.deleteRecord !== "function" ||
    !isContract(contract)
  ) {
    throw new TypeError("Invalid managed grant store dependencies")
  }

  return Object.freeze({
    async save(grant) {
      const payload = copyGrant(grant, contract)
      let stored
      try {
        stored = await credentials.modifyRecord(credentialKey, async () => ({
          kind: "grant",
          payload,
        }))
        if (!isPlainObject(stored) || stored.kind !== "grant") {
          throw new ManagedGrantStoreError()
        }
        copyGrant(stored.payload, contract)
      } catch (error) {
        if (error instanceof TypeError || error instanceof ManagedGrantStoreError) throw error
        throw new ManagedGrantStoreError()
      } finally {
        stored = undefined
      }
    },

    async revokeAndDelete(revoke) {
      if (typeof revoke !== "function") throw new TypeError("A managed grant revoker is required")
      let record
      let original
      let marker
      let payload
      let refreshToken
      try {
        record = await credentials.modifyRecord(credentialKey, async (current) => {
          if (current === undefined) return undefined
          if (isRevocationMarker(current, contract)) return undefined
          payload = copyGrantRecord(current, contract)
          original = { kind: "grant", payload }
          marker = createRevocationMarker(payload)
          return marker
        })
        if (record === undefined) return
        if (!isRevocationMarker(record, contract)) throw new ManagedGrantStoreError()
        marker = record
        refreshToken = marker.payload.refreshToken
        await revoke({ refreshToken })
        record = await credentials.readRecord(credentialKey)
        if (!sameRevocationMarker(record, marker)) throw new ManagedGrantStoreError()
        await credentials.deleteRecord(credentialKey)
      } catch (error) {
        if (original !== undefined && marker !== undefined) {
          try {
            await credentials.modifyRecord(credentialKey, async (current) => (
              sameRevocationMarker(current, marker) ? original : undefined
            ))
          } catch {
            // Preserve the original failure taxonomy; a surviving marker safely blocks token use.
          }
        }
        if (error instanceof TypeError || error instanceof ManagedGrantStoreError) throw error
        if (error?.name === "AbortError") throw error
        throw new ManagedGrantStoreError()
      } finally {
        refreshToken = undefined
        payload = undefined
        marker = undefined
        original = undefined
        record = undefined
      }
    },
  })
}

function copyGrantRecord(record, contract) {
  if (!isPlainObject(record) || record.kind !== "grant") throw new ManagedGrantStoreError()
  return copyGrant(record.payload, contract)
}

function createRevocationMarker(payload) {
  return {
    kind: "grant",
    payload: {
      version: 1,
      state: "revoking",
      issuer: payload.issuer,
      clientId: payload.clientId,
      refreshToken: payload.refreshToken,
      generation: payload.generation,
    },
  }
}

function isRevocationMarker(record, contract) {
  if (!isPlainObject(record) || record.kind !== "grant" || !isPlainObject(record.payload)) return false
  const payload = record.payload
  return Object.keys(payload).sort().join("\0") === [
    "clientId", "generation", "issuer", "refreshToken", "state", "version",
  ].join("\0") &&
    payload.version === 1 &&
    payload.state === "revoking" &&
    payload.issuer === contract.issuer &&
    payload.clientId === contract.clientId &&
    isBoundedString(payload.refreshToken, 16 * 1024) &&
    Number.isSafeInteger(payload.generation) &&
    payload.generation >= 1
}

function sameRevocationMarker(left, right) {
  return isPlainObject(left) && isPlainObject(right) &&
    left.kind === "grant" && right.kind === "grant" &&
    isPlainObject(left.payload) && isPlainObject(right.payload) &&
    left.payload.version === right.payload.version &&
    left.payload.state === right.payload.state &&
    left.payload.issuer === right.payload.issuer &&
    left.payload.clientId === right.payload.clientId &&
    left.payload.refreshToken === right.payload.refreshToken &&
    left.payload.generation === right.payload.generation
}

function copyGrant(grant, contract) {
  if (!isPlainObject(grant)) throw new ManagedGrantStoreError()
  const fields = Object.keys(grant).sort()
  if (fields.length !== GRANT_FIELDS.length || fields.some((field, index) => field !== GRANT_FIELDS[index])) {
    throw new ManagedGrantStoreError()
  }
  if (
    grant.version !== 1 ||
    grant.issuer !== contract.issuer ||
    grant.clientId !== contract.clientId ||
    !isBoundedString(grant.accessToken, 16 * 1024) ||
    !isBoundedString(grant.refreshToken, 16 * 1024) ||
    !Number.isSafeInteger(grant.generation) ||
    grant.generation < 1 ||
    typeof grant.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(grant.expiresAt)) ||
    !hasRequiredScopes(grant.scopes, contract.requiredScopes)
  ) {
    throw new ManagedGrantStoreError()
  }

  return {
    version: 1,
    issuer: grant.issuer,
    clientId: grant.clientId,
    accessToken: grant.accessToken,
    refreshToken: grant.refreshToken,
    expiresAt: grant.expiresAt,
    scopes: [...grant.scopes],
    generation: grant.generation,
  }
}

function isContract(contract) {
  return (
    isPlainObject(contract) &&
    isBoundedString(contract.issuer, 256) &&
    isBoundedString(contract.clientId, 256) &&
    Array.isArray(contract.requiredScopes) &&
    contract.requiredScopes.length > 0 &&
    contract.requiredScopes.length <= 16 &&
    contract.requiredScopes.every((scope) => isBoundedString(scope, 128)) &&
    new Set(contract.requiredScopes).size === contract.requiredScopes.length
  )
}

function hasRequiredScopes(scopes, requiredScopes) {
  return (
    Array.isArray(scopes) &&
    scopes.length > 0 &&
    scopes.length <= 16 &&
    scopes.every((scope) => isBoundedString(scope, 128)) &&
    new Set(scopes).size === scopes.length &&
    requiredScopes.every((scope) => scopes.includes(scope))
  )
}

function isBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

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
const REFRESH_SKEW_MS = 5 * 60 * 1000

export class ManagedCredentialError extends Error {
  constructor() {
    super("The managed Grok credential is missing, expired, or unsupported")
    this.name = "ManagedCredentialError"
  }
}

export function createManagedCredentialSource({
  contract,
  credentialKey,
  credentials,
  now,
  refreshGrant,
}) {
  if (
    !isContract(contract) ||
    typeof credentialKey !== "string" ||
    credentialKey.length === 0 ||
    !credentials ||
    typeof credentials.readRecord !== "function" ||
    typeof now !== "function" ||
    typeof refreshGrant !== "function"
  ) {
    throw new TypeError("Invalid managed credential source dependencies")
  }

  return Object.freeze({
    async withAccessToken(operation) {
      if (typeof operation !== "function") {
        throw new TypeError("Access-token operation must be a function")
      }

      let record
      let payload
      let accessToken

      try {
        try {
          record = await credentials.readRecord(credentialKey)
          payload = parseGrantRecord(record, contract)

          if (!hasSufficientLifetime(payload.expiresAt, now())) {
            if (typeof credentials.modifyRecord !== "function") {
              throw new ManagedCredentialError()
            }

            record = await credentials.modifyRecord(credentialKey, async (current) => {
              const currentPayload = parseGrantRecord(current, contract)
              if (hasSufficientLifetime(currentPayload.expiresAt, now())) return undefined
              if (currentPayload.generation === Number.MAX_SAFE_INTEGER) {
                throw new ManagedCredentialError()
              }

              const refreshed = await refreshGrant({
                refreshToken: currentPayload.refreshToken,
                scopes: [...currentPayload.scopes],
              })
              const replacement = buildRotatedRecord(currentPayload, refreshed)
              parseGrantRecord(replacement, contract)
              return replacement
            })

            payload = parseGrantRecord(record, contract)
            if (!hasSufficientLifetime(payload.expiresAt, now())) {
              throw new ManagedCredentialError()
            }
          }

          accessToken = payload.accessToken
        } catch (error) {
          if (error instanceof TypeError || error instanceof ManagedCredentialError) {
            throw error
          }
          throw new ManagedCredentialError()
        }

        return await operation(accessToken)
      } finally {
        accessToken = undefined
        payload = undefined
        record = undefined
      }
    },
  })
}

function parseGrantRecord(record, contract) {
  if (!isPlainObject(record) || record.kind !== "grant" || !isPlainObject(record.payload)) {
    throw new ManagedCredentialError()
  }

  const payload = record.payload
  const fields = Object.keys(payload).sort()
  if (fields.length !== GRANT_FIELDS.length || fields.some((field, index) => field !== GRANT_FIELDS[index])) {
    throw new ManagedCredentialError()
  }

  if (
    payload.version !== 1 ||
    payload.issuer !== contract.issuer ||
    payload.clientId !== contract.clientId ||
    typeof payload.accessToken !== "string" ||
    payload.accessToken.length === 0 ||
    typeof payload.refreshToken !== "string" ||
    payload.refreshToken.length === 0 ||
    !Number.isSafeInteger(payload.generation) ||
    payload.generation < 0 ||
    !isDateTime(payload.expiresAt) ||
    !hasRequiredScopes(payload.scopes, contract.requiredScopes)
  ) {
    throw new ManagedCredentialError()
  }

  return payload
}

function buildRotatedRecord(current, refreshed) {
  if (!isPlainObject(refreshed)) throw new ManagedCredentialError()
  const allowedFields = ["accessToken", "expiresAt", "refreshToken", "scopes"]
  if (Object.keys(refreshed).some((field) => !allowedFields.includes(field))) {
    throw new ManagedCredentialError()
  }
  if (
    typeof refreshed.accessToken !== "string" ||
    refreshed.accessToken.length === 0 ||
    typeof refreshed.expiresAt !== "string" ||
    !Array.isArray(refreshed.scopes)
  ) {
    throw new ManagedCredentialError()
  }
  if (refreshed.refreshToken !== undefined && (
    typeof refreshed.refreshToken !== "string" ||
    refreshed.refreshToken.length === 0
  )) {
    throw new ManagedCredentialError()
  }

  return {
    kind: "grant",
    payload: {
      version: 1,
      issuer: current.issuer,
      clientId: current.clientId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? current.refreshToken,
      expiresAt: refreshed.expiresAt,
      scopes: [...refreshed.scopes],
      generation: current.generation + 1,
    },
  }
}

function isContract(contract) {
  return (
    isPlainObject(contract) &&
    typeof contract.clientId === "string" &&
    contract.clientId.length > 0 &&
    typeof contract.issuer === "string" &&
    contract.issuer.length > 0 &&
    Array.isArray(contract.requiredScopes) &&
    contract.requiredScopes.length > 0 &&
    contract.requiredScopes.every((scope) => typeof scope === "string" && scope.length > 0)
  )
}

function hasRequiredScopes(scopes, requiredScopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return false
  if (!scopes.every((scope) => typeof scope === "string" && scope.length > 0)) return false
  if (new Set(scopes).size !== scopes.length) return false
  return requiredScopes.every((scope) => scopes.includes(scope))
}

function hasSufficientLifetime(value, now) {
  if (!(now instanceof Date)) return false
  const expiresAt = Date.parse(value)
  return Number.isFinite(expiresAt) && expiresAt - now.getTime() > REFRESH_SKEW_MS
}

function isDateTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

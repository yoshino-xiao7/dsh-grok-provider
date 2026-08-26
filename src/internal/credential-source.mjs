const CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828"
const EXPIRY_SKEW_MS = 5 * 60 * 1000

export const GROK_PRODUCTION_OIDC_AUTH_CONTRACT = Object.freeze({
  authMode: "oidc",
  clientId: CLIENT_ID,
  issuer: "https://auth.x.ai",
  scope: `https://auth.x.ai::${CLIENT_ID}`,
})

export class UnsupportedCredentialError extends Error {
  constructor() {
    super("The Grok credential does not match the supported authentication contract")
    this.name = "UnsupportedCredentialError"
  }
}

export class CredentialFileTooLargeError extends Error {
  constructor() {
    super("The Grok credential file exceeds the 64 KiB limit")
    this.name = "CredentialFileTooLargeError"
  }
}

class CredentialRefreshRequiredError extends Error {}

export function createCredentialSource({ contract, load, now, refresh }) {
  if (
    !contract ||
    typeof load !== "function" ||
    typeof now !== "function" ||
    (refresh !== undefined && typeof refresh !== "function")
  ) {
    throw new TypeError("Invalid credential source dependencies")
  }
  let activeRefresh

  const refreshOnce = async () => {
    if (activeRefresh === undefined) {
      activeRefresh = Promise.resolve().then(refresh).finally(() => {
        activeRefresh = undefined
      })
    }
    return activeRefresh
  }

  return Object.freeze({
    async withAccessToken(operation) {
      if (typeof operation !== "function") {
        throw new TypeError("Access-token operation must be a function")
      }

      let raw
      let rawText
      let parsed
      let accessToken
      let metadata
      let refreshAttempted = false

      try {
        while (accessToken === undefined) {
          try {
            raw = await load()
            if (utf8ByteLength(raw) > 64 * 1024) {
              throw new CredentialFileTooLargeError()
            }
            rawText = decodeUtf8(raw)
            parsed = JSON.parse(rawText)

            if (!isPlainObject(parsed)) throw new UnsupportedCredentialError()

            const entries = Object.entries(parsed)
            if (entries.length !== 1 || entries[0][0] !== contract.scope) {
              throw new UnsupportedCredentialError()
            }

            const record = entries[0][1]
            if (
              !isPlainObject(record) ||
              record.auth_mode !== contract.authMode ||
              record.oidc_issuer !== contract.issuer ||
              record.oidc_client_id !== contract.clientId ||
              typeof record.key !== "string" ||
              record.key.length === 0 ||
              !isDateTime(record.expires_at)
            ) {
              throw new UnsupportedCredentialError()
            }
            const currentTime = now()
            if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
              throw new TypeError("Invalid credential source clock")
            }
            if (!isFutureDateTime(record.expires_at, currentTime)) throw new CredentialRefreshRequiredError()

            accessToken = record.key
            metadata = Object.freeze({
              ...(isHeaderValue(record.user_id) ? { userId: record.user_id } : {}),
            })
          } catch (error) {
            if (
              error instanceof CredentialRefreshRequiredError &&
              refresh !== undefined &&
              !refreshAttempted
            ) {
              refreshAttempted = true
              try {
                await refreshOnce()
              } catch {
                throw new UnsupportedCredentialError()
              }
              raw = undefined
              rawText = undefined
              parsed = undefined
              continue
            }
            if (
              error instanceof UnsupportedCredentialError ||
              error instanceof CredentialFileTooLargeError ||
              error instanceof TypeError
            ) {
              throw error
            }
            throw new UnsupportedCredentialError()
          }
        }

        return await operation(accessToken, metadata)
      } finally {
        metadata = undefined
        accessToken = undefined
        parsed = undefined
        rawText = undefined
        raw = undefined
      }
    },
  })
}

function isHeaderValue(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 16 * 1024 && !/[\r\n\0]/u.test(value)
}

function utf8ByteLength(value) {
  if (typeof value === "string") return Buffer.byteLength(value, "utf8")
  if (value instanceof Uint8Array) return value.byteLength
  throw new TypeError("Credential loader must return a string or Uint8Array")
}

function decodeUtf8(value) {
  if (typeof value === "string") return value
  return new TextDecoder("utf-8", { fatal: true }).decode(value)
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isFutureDateTime(value, now) {
  if (typeof value !== "string") return false
  const expiresAt = Date.parse(value)
  return Number.isFinite(expiresAt) && expiresAt - now.getTime() > EXPIRY_SKEW_MS
}

function isDateTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

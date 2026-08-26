const MAX_BILLING_BYTES = 256 * 1024

export class InvalidBillingResponseError extends Error {
  constructor() {
    super("The Grok billing response is invalid or unsupported")
    this.name = "InvalidBillingResponseError"
  }
}

export function parseBillingSummary(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > MAX_BILLING_BYTES) fail()
  let value
  try { value = JSON.parse(raw) } catch { fail() }
  if (!isPlainObject(value) || (value.config !== null && !isPlainObject(value.config))) fail()
  if (value.config === null) return Object.freeze({ state: "unavailable" })

  const config = value.config
  const period = parsePeriod(config)
  const usedPercent = parseUsage(config, period)
  return Object.freeze({
    state: "ready",
    ...(usedPercent === undefined ? {} : {
      usedPercent,
      remainingPercent: normalizePercent(100 - usedPercent),
    }),
    ...period,
  })
}

function parseUsage(config, period) {
  if (config.creditUsagePercent !== undefined) {
    if (!isPercent(config.creditUsagePercent)) fail()
    return config.creditUsagePercent
  }
  // GetGrokCreditsConfig is protobuf-backed. Its JSON projection omits the
  // scalar zero value, while retaining the typed period that owns it.
  if (
    period.periodKind !== undefined
    && period.periodStart !== undefined
    && period.resetsAt !== undefined
  ) return 0
  if (config.monthlyLimit === undefined && config.used === undefined) return undefined
  const limit = parseCent(config.monthlyLimit)
  const used = parseCent(config.used)
  if (limit <= 0 || used < 0 || used > limit) fail()
  return normalizePercent((used / limit) * 100)
}

function parsePeriod(config) {
  if (config.currentPeriod !== undefined) {
    if (!isPlainObject(config.currentPeriod)) fail()
    const current = config.currentPeriod
    const periodKind = current.type === "USAGE_PERIOD_TYPE_WEEKLY" ? "weekly"
      : current.type === "USAGE_PERIOD_TYPE_MONTHLY" ? "monthly" : undefined
    if (current.type !== undefined && (
      typeof current.type !== "string" || current.type.length === 0 || current.type.length > 128
    )) fail()
    const periodStart = parseOptionalDateTime(current.start)
    const resetsAt = parseOptionalDateTime(current.end)
    return {
      ...(periodKind === undefined ? {} : { periodKind }),
      ...(periodStart === undefined ? {} : { periodStart }),
      ...(resetsAt === undefined ? {} : { resetsAt }),
    }
  }
  const periodStart = parseOptionalDateTime(config.billingPeriodStart)
  const resetsAt = parseOptionalDateTime(config.billingPeriodEnd)
  if (periodStart === undefined && resetsAt === undefined) return {}
  return {
    periodKind: "monthly",
    ...(periodStart === undefined ? {} : { periodStart }),
    ...(resetsAt === undefined ? {} : { resetsAt }),
  }
}

function parseCent(value) {
  if (!isPlainObject(value) || !Number.isSafeInteger(value.val)) fail()
  return value.val
}

function parseOptionalDateTime(value) {
  if (value === undefined) return undefined
  if (typeof value !== "string") fail()
  const time = Date.parse(value)
  if (!Number.isFinite(time)) fail()
  return new Date(time).toISOString()
}

function normalizePercent(value) {
  return Math.round(value * 100) / 100
}

function isPercent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
}

function fail() {
  throw new InvalidBillingResponseError()
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

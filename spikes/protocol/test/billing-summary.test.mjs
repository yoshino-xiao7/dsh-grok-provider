import assert from "node:assert/strict"
import test from "node:test"

import { parseBillingSummary } from "../../../src/internal/billing-summary.mjs"

test("the current credits shape maps usage and weekly reset without identity or balances", () => {
  const summary = parseBillingSummary(JSON.stringify({
    config: {
      creditUsagePercent: 27.5,
      currentPeriod: {
        type: "USAGE_PERIOD_TYPE_WEEKLY",
        start: "2030-01-01T00:00:00Z",
        end: "2030-01-08T00:00:00Z",
      },
      prepaidBalance: { val: 12345 },
      history: [{ secret: "must-not-cross" }],
    },
    subscriptionTier: "Fixture Heavy",
  }))

  assert.deepEqual(summary, {
    state: "ready",
    usedPercent: 27.5,
    remainingPercent: 72.5,
    periodKind: "weekly",
    periodStart: "2030-01-01T00:00:00.000Z",
    resetsAt: "2030-01-08T00:00:00.000Z",
  })
  assert.equal(JSON.stringify(summary).includes("Fixture Heavy"), false)
  assert.equal(JSON.stringify(summary).includes("12345"), false)
})

test("the legacy monthly shape derives usage only from coherent cent counters", () => {
  assert.deepEqual(parseBillingSummary(JSON.stringify({ config: {
    monthlyLimit: { val: 2000 }, used: { val: 500 },
    billingPeriodEnd: "2030-02-01T00:00:00Z",
  } })), {
    state: "ready",
    usedPercent: 25,
    remainingPercent: 75,
    periodKind: "monthly",
    resetsAt: "2030-02-01T00:00:00.000Z",
  })
})

test("a typed current period makes an omitted protobuf percentage an unambiguous zero", () => {
  assert.deepEqual(parseBillingSummary(JSON.stringify({ config: {
    currentPeriod: {
      type: "USAGE_PERIOD_TYPE_WEEKLY",
      start: "2030-01-01T00:00:00Z",
      end: "2030-01-08T00:00:00Z",
    },
    isUnifiedBillingUser: true,
  } })), {
    state: "ready",
    usedPercent: 0,
    remainingPercent: 100,
    periodKind: "weekly",
    periodStart: "2030-01-01T00:00:00.000Z",
    resetsAt: "2030-01-08T00:00:00.000Z",
  })
})

test("an incomplete or unknown period does not invent a zero percentage", () => {
  assert.deepEqual(parseBillingSummary('{"config":{}}'), { state: "ready" })
  assert.deepEqual(parseBillingSummary('{"config":null}'), { state: "unavailable" })
  assert.deepEqual(parseBillingSummary('{"config":{"currentPeriod":{"type":"USAGE_PERIOD_TYPE_WEEKLY","end":"2030-01-08T00:00:00Z"}}}'), {
    state: "ready", periodKind: "weekly", resetsAt: "2030-01-08T00:00:00.000Z",
  })
  assert.deepEqual(parseBillingSummary('{"config":{"currentPeriod":{"type":"USAGE_PERIOD_TYPE_FUTURE","end":"2030-01-08T00:00:00Z"}}}'), {
    state: "ready", resetsAt: "2030-01-08T00:00:00.000Z",
  })
})

test("invalid percentages, timestamps and oversized payloads fail closed", () => {
  assert.throws(() => parseBillingSummary('{"config":{"creditUsagePercent":101}}'), { name: "InvalidBillingResponseError" })
  assert.throws(() => parseBillingSummary('{"config":{"currentPeriod":{"end":"tomorrow"}}}'), { name: "InvalidBillingResponseError" })
  assert.throws(() => parseBillingSummary("x".repeat(256 * 1024 + 1)), { name: "InvalidBillingResponseError" })
})

import assert from "node:assert/strict"
import test from "node:test"

import { parseGrokCommandInput } from "../../../src/internal/grok-command.mjs"

test("the Grok command parser accepts only the documented closed grammar", () => {
  assert.deepEqual(parseGrokCommandInput(" status"), { verb: "status" })
  assert.deepEqual(parseGrokCommandInput(" login"), { verb: "login" })
  assert.deepEqual(parseGrokCommandInput(" cancel"), { verb: "cancel" })
  assert.deepEqual(parseGrokCommandInput(" logout"), { verb: "logout" })

  for (const invalid of [
    "",
    "status extra",
    " use",
    " use managed-device",
    " use official-cli extra",
    " login official-cli",
    " login managed-device",
    " login managed-device extra",
    " cancel now",
    " logout official-cli",
    " logout managed-device",
    " logout other",
    "\nstatus",
  ]) {
    assert.equal(parseGrokCommandInput(invalid), undefined)
  }
})

import assert from "node:assert/strict"
import test from "node:test"

import { parseGrokCommandInput } from "../../../src/internal/grok-command.mjs"

test("the Grok command parser accepts only the documented closed grammar", () => {
  assert.deepEqual(parseGrokCommandInput(" status"), { verb: "status" })
  assert.deepEqual(parseGrokCommandInput("\tuse managed-device"), { verb: "use", mode: "managed-device" })
  assert.deepEqual(parseGrokCommandInput(" login"), { verb: "login" })
  assert.deepEqual(parseGrokCommandInput(" login official-cli"), { verb: "login", mode: "official-cli" })
  assert.deepEqual(parseGrokCommandInput(" cancel"), { verb: "cancel" })
  assert.deepEqual(parseGrokCommandInput(" logout managed-device"), { verb: "logout", mode: "managed-device" })

  for (const invalid of [
    "",
    "status extra",
    " use",
    " use official-cli extra",
    " login managed-device extra",
    " cancel now",
    " logout",
    " logout other",
    "\nstatus",
  ]) {
    assert.equal(parseGrokCommandInput(invalid), undefined)
  }
})

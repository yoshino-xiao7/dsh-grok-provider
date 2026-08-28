import assert from "node:assert/strict"
import test from "node:test"

import { Context } from "@deepseek-ai/cordis"
import LlmRuntime, { LlmError } from "@deepseek-ai/dsh-llm"

import * as grokPlugin from "../src/host/index.mjs"
import { mapLlmError } from "../src/internal/llm-error.mjs"
import {
  InvalidRequestImageProjectionError,
  UnsupportedImageInputError,
} from "../src/internal/responses-request-compiler.mjs"
import { UnsupportedResponsesRequestError } from "../src/internal/responses-request.mjs"

test("the Host plugin registers and cleanly removes the Grok provider in the real LLM runtime", async () => {
  const ctx = new Context()
  const llmFiber = ctx.plugin(LlmRuntime)
  await llmFiber
  const grokFiber = ctx.plugin(grokPlugin)
  await grokFiber

  assert.deepEqual(ctx.llm.listProviders(), [{ id: "grok", name: "Grok Build" }])

  await grokFiber.dispose()
  assert.deepEqual(ctx.llm.listProviders(), [])
  await llmFiber.dispose()
})

test("the Host exposes no selectable authentication mode", () => {
  assert.equal(String(grokPlugin.Config), "{}")
  assert.deepEqual(Object.keys(grokPlugin).sort(), ["Config", "apply", "inject", "name"])
})

test("the Host distinguishes image policy failures from invalid generic requests", () => {
  assert.equal(mapLlmError(new UnsupportedImageInputError()).code, "UNSUPPORTED_CONTENT")
  assert.equal(mapLlmError(Object.assign(new Error("unsupported projection"), {
    code: "ATTACHMENT_PROJECTION_UNSUPPORTED",
  })).code, "UNSUPPORTED_CONTENT")
  assert.equal(mapLlmError(new InvalidRequestImageProjectionError()).code, "INVALID_RESPONSE")
  assert.equal(mapLlmError(new UnsupportedResponsesRequestError()).code, "INVALID_RESPONSE")
})

test("an aborted request maps an existing LLM error to ABORTED", () => {
  const controller = new AbortController()
  const reason = new LlmError("fixture", "AUTH")
  controller.abort(reason)

  const mapped = mapLlmError(reason, controller.signal)

  assert.equal(mapped.code, "ABORTED")
  assert.notEqual(mapped, reason)
  assert.equal(mapped.cause, reason)
})

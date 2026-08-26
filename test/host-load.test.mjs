import assert from "node:assert/strict"
import test from "node:test"

import { Context } from "@deepseek-ai/cordis"
import LlmRuntime from "@deepseek-ai/dsh-llm"

import * as grokPlugin from "../src/host/index.mjs"

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
})

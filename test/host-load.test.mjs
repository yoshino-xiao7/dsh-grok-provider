import assert from "node:assert/strict"
import test from "node:test"

import { Context } from "@deepseek-ai/cordis"
import LlmRuntime from "@deepseek-ai/dsh-llm"

import * as grokPlugin from "../src/host/index.mjs"

test("the Host plugin registers and cleanly removes the Grok provider in the real LLM runtime", async () => {
  const ctx = new Context()
  const llmFiber = ctx.plugin(LlmRuntime)
  await llmFiber
  const grokFiber = ctx.plugin(grokPlugin, { authMode: "official-cli" })
  await grokFiber

  assert.deepEqual(ctx.llm.listProviders(), [{ id: "grok", name: "Grok Build" }])

  await grokFiber.dispose()
  assert.deepEqual(ctx.llm.listProviders(), [])
  await llmFiber.dispose()
})

test("an unavailable selected auth mode is exposed through the Harness AUTH taxonomy", async () => {
  const ctx = new Context()
  const llmFiber = ctx.plugin(LlmRuntime)
  await llmFiber
  const grokFiber = ctx.plugin(grokPlugin, { authMode: "managed-device" })
  await grokFiber

  await assert.rejects(
    ctx.llm.listModels("grok"),
    (error) => error?.code === "AUTH" && error?.message === "Grok authentication is required",
  )

  await grokFiber.dispose()
  await llmFiber.dispose()
})

import os from "node:os"
import path from "node:path"

import { GROK_CLI_1_0_5_AUTH_CONTRACT, createCredentialSource } from "../src/internal/credential-source.mjs"
import { createGrokAdapter } from "../src/internal/grok-adapter.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"

if (process.platform !== "darwin") throw new Error("This smoke script is macOS-only")

const source = createCredentialSource({
  contract: GROK_CLI_1_0_5_AUTH_CONTRACT,
  load: createOfficialCredentialLoader({
    authPath: path.join(os.homedir(), ".grok", "auth.json"),
    platform: "darwin",
  }),
  now: () => new Date(),
})
const transport = createGrokTransport({
  credentialSource: source,
  fetch: globalThis.fetch,
  attributionHeaders: () => ({ "user-agent": "deepseek-harness/0.1.1-rc.2" }),
  clientIdentifier: "dsh-grok-provider",
  clientVersion: "1.0.5",
})
const adapter = createGrokAdapter({ getGeneration: () => ({ id: 1, transport }) })
const models = await adapter.listModels("grok")
console.log(JSON.stringify({ kind: "catalog", models: models.map((model) => model.id) }))

for (const model of models) {
  const counts = {}
  const content = []
  let replayState
  for await (const chunk of adapter.stream({
    provider: "grok",
    model: model.id,
    reasoningEffort: model.reasoning?.defaultEffort,
    messages: [{
      id: "smoke-user",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Reply with only the word OK." }],
    }],
  })) {
    counts[chunk.type] = (counts[chunk.type] ?? 0) + 1
    if (chunk.type === "block-end") content.push(chunk.block)
    if (chunk.type === "finish") replayState = chunk.replayState
  }
  if (!replayState || content.length === 0) throw new Error("Expected replay metadata")
  console.log(JSON.stringify({ kind: "stream", model: model.id, counts }))

  const replayCounts = {}
  for await (const chunk of adapter.stream({
    provider: "grok",
    model: model.id,
    reasoningEffort: model.reasoning?.defaultEffort,
    messages: [
      {
        id: "replay-user-1",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Reply with only the word OK." }],
      },
      {
        id: "replay-assistant-1",
        role: "assistant",
        source: { kind: "model", provider: "grok", model: model.id, replayState },
        content,
      },
      {
        id: "replay-user-2",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Reply with only the word AGAIN." }],
      },
    ],
  })) {
    replayCounts[chunk.type] = (replayCounts[chunk.type] ?? 0) + 1
  }
  if (replayCounts.finish !== 1) throw new Error("Expected replay completion")
  console.log(JSON.stringify({ kind: "replay", model: model.id, counts: replayCounts }))
}

for (const model of models) {
  let toolCallCount = 0
  for await (const chunk of adapter.stream({
    provider: "grok",
    model: model.id,
    reasoningEffort: model.reasoning?.defaultEffort,
    messages: [{
      id: "smoke-tool-user",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Call fixture_tool exactly once with value set to ok. Do not answer in text." }],
    }],
    tools: [{
      name: "fixture_tool",
      description: "A no-op verification tool",
      parameters: {
        type: "object",
        properties: { value: { type: "string", enum: ["ok"] } },
        required: ["value"],
        additionalProperties: false,
      },
    }],
  })) {
    if (chunk.type === "block-end" && chunk.block.type === "tool-call") {
      const args = JSON.parse(chunk.block.arguments)
      if (chunk.block.name !== "fixture_tool" || args.value !== "ok") {
        throw new Error("Unexpected tool-call mapping")
      }
      toolCallCount += 1
    }
  }
  if (toolCallCount !== 1) throw new Error("Expected exactly one tool call")
  console.log(JSON.stringify({ kind: "tool", model: model.id, toolCallCount }))
}

import assert from "node:assert/strict"
import test from "node:test"

import { createGrokAdapter } from "../../../src/internal/grok-adapter.mjs"

const catalog = JSON.stringify({
  object: "list",
  data: [
    {
      id: "grok-4.6",
      name: "Grok 4.6",
      context_window: 500000,
      api_backend: "responses",
      supports_reasoning_effort: true,
      reasoning_effort: "high",
      reasoning_efforts: [
        { id: "low", value: "low", label: "Low", default: false },
        { id: "high", value: "high", label: "High", default: true },
      ],
    },
    {
      id: "grok-4.5",
      name: "Grok 4.5",
      context_window: 500000,
      api_backend: "responses",
      supports_reasoning_effort: false,
    },
  ],
})

test("the adapter advertises every account-visible model and freezes prepare generation", async () => {
  const used = []
  const encoder = new TextEncoder()
  const oldTransport = {
    async listModels() { return catalog },
    async *streamResponses(request) {
      used.push({ generation: "old", request })
      const events = [
        { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
        { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
        { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "msg_1", type: "message", role: "assistant", status: "in_progress", content: [] } },
        { type: "response.content_part.added", sequence_number: 3, output_index: 0, item_id: "msg_1", part: { type: "output_text", text: "" } },
        { type: "response.output_text.delta", sequence_number: 4, output_index: 0, item_id: "msg_1", delta: "OK" },
        { type: "response.output_text.done", sequence_number: 5, output_index: 0, item_id: "msg_1", text: "OK" },
        { type: "response.content_part.done", sequence_number: 6, output_index: 0, item_id: "msg_1", part: { type: "output_text", text: "OK" } },
        { type: "response.output_item.done", sequence_number: 7, output_index: 0, item: { id: "msg_1", type: "message", role: "assistant", status: "completed" } },
        { type: "response.completed", sequence_number: 8, response: { status: "completed", usage: { input_tokens: 1, output_tokens: 1 } } },
      ]
      for (const event of events) {
        yield encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      }
    },
  }
  let generation = { id: 1, transport: oldTransport }
  const adapter = createGrokAdapter({ getGeneration: () => generation })

  const models = await adapter.listModels("grok")
  assert.deepEqual(models.map((model) => model.id), ["grok-4.6", "grok-4.5"])
  assert.equal(models[0].context.contextWindow, 500000)

  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  generation = {
    id: 2,
    transport: {
      async listModels() { return catalog },
      async *streamResponses(request) { used.push({ generation: "new", request }) },
    },
  }
  const chunks = []
  for await (const chunk of prepared.stream({
    provider: "grok",
    model: "grok-4.6",
    messages: [{ id: "u1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "Hi" }] }],
  })) chunks.push(chunk)

  assert.equal(used[0].generation, "old")
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })
})

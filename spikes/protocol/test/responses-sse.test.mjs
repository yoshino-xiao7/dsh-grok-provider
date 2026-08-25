import assert from "node:assert/strict"
import test from "node:test"

import { parseResponsesSse } from "../../../src/internal/responses-sse.mjs"

test("fragmented Responses SSE frames decode incrementally and require matching event types", async () => {
  const encoder = new TextEncoder()
  async function* bytes() {
    yield encoder.encode(': keep-alive\r\nevent: response.created\r\ndata: {"type":"response.cre')
    yield encoder.encode('ated","sequence_number":0,"response":{"status":"in_progress"}}\r\n\r\n')
    yield encoder.encode('event: response.completed\ndata: {"type":"response.completed","sequence_number":1,"response":{"status":"completed"}}\n\n')
    yield encoder.encode('data: [DONE]\n\n')
  }

  const events = []
  for await (const event of parseResponsesSse(bytes())) events.push(event)

  assert.deepEqual(events, [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.completed", sequence_number: 1, response: { status: "completed" } },
  ])
})

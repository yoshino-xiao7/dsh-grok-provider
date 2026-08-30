import assert from "node:assert/strict"
import test from "node:test"

import { GrokTransportError } from "../../../src/internal/grok-transport.mjs"
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

test("Responses SSE preserves an error thrown by its source iterator", async () => {
  const expected = new GrokTransportError(400)
  async function* failedSource() {
    throw expected
  }

  await assert.rejects(async () => {
    for await (const _event of parseResponsesSse(failedSource())) {}
  }, (error) => error === expected)
})

test("Responses SSE preserves a later source error after yielding valid events", async () => {
  const encoder = new TextEncoder()
  const expected = new GrokTransportError(502)
  async function* interruptedSource() {
    yield encoder.encode('data: {"type":"response.created","sequence_number":0,"response":{"status":"in_progress"}}\n\n')
    throw expected
  }

  const events = []
  await assert.rejects(async () => {
    for await (const event of parseResponsesSse(interruptedSource())) events.push(event)
  }, (error) => error === expected)
  assert.equal(events.length, 1)
  assert.equal(events[0].type, "response.created")
})

test("malformed Responses SSE remains an invalid event stream", async () => {
  const encoder = new TextEncoder()
  async function* malformedSource() {
    yield encoder.encode("data: {not-json}\n\n")
  }

  await assert.rejects(async () => {
    for await (const _event of parseResponsesSse(malformedSource())) {}
  }, { name: "InvalidResponsesSseError" })
})

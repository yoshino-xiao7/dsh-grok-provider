import assert from "node:assert/strict"
import test from "node:test"

import { encodeResponsesRequest } from "../../../src/internal/responses-request.mjs"

test("a Harness text and tool conversation maps losslessly to a stateless Responses request", () => {
  const request = encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    reasoningEffort: "high",
    system: "Be concise.",
    messages: [
      {
        id: "msg_user",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "What is the weather?" }],
      },
      {
        id: "msg_assistant",
        role: "assistant",
        source: { kind: "model", provider: "grok", model: "grok-4.6" },
        content: [
          { type: "text", text: "Checking." },
          { type: "tool-call", id: "call_weather", name: "get_weather", arguments: '{"city":"Paris"}' },
        ],
      },
      {
        id: "msg_tool",
        role: "user",
        source: { kind: "tool", callId: "call_weather" },
        content: [{
          type: "tool-result",
          toolCallId: "call_weather",
          content: [{ type: "text", text: "Sunny" }],
          isError: false,
        }],
      },
    ],
    tools: [{
      name: "get_weather",
      description: "Look up weather",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    }],
    temperature: 0.2,
    maxTokens: 512,
  })

  assert.deepEqual(request, {
    model: "grok-4.6",
    input: [
      { role: "user", content: "What is the weather?" },
      { role: "assistant", content: "Checking." },
      {
        type: "function_call",
        call_id: "call_weather",
        name: "get_weather",
        arguments: '{"city":"Paris"}',
      },
      {
        type: "function_call_output",
        call_id: "call_weather",
        output: "Sunny",
      },
    ],
    instructions: "Be concise.",
    tools: [{
      type: "function",
      name: "get_weather",
      description: "Look up weather",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    }],
    reasoning: { effort: "high" },
    temperature: 0.2,
    max_output_tokens: 512,
    include: ["reasoning.encrypted_content"],
    stream: true,
    store: false,
  })
})

test("a same-provider replay envelope restores encrypted reasoning in block order", () => {
  const request = encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "assistant-1",
      role: "assistant",
      source: {
        kind: "model",
        provider: "grok",
        model: "grok-4.6",
        replayState: {
          response: { version: 1 },
          blocks: [
            { type: "reasoning", id: "rs_fixture", encryptedContent: "sealed-fixture" },
            null,
          ],
        },
      },
      content: [
        { type: "reasoning", text: "Brief reasoning." },
        { type: "text", text: "OK" },
      ],
    }],
  })

  assert.deepEqual(request.input, [
    {
      type: "reasoning",
      id: "rs_fixture",
      encrypted_content: "sealed-fixture",
      summary: [{ type: "summary_text", text: "Brief reasoning." }],
    },
    { role: "assistant", content: "OK" },
  ])
})

test("foreign or misaligned replay metadata is never sent upstream", () => {
  const base = {
    id: "assistant-1",
    role: "assistant",
    content: [
      { type: "reasoning", text: "Private summary." },
      { type: "text", text: "Visible answer." },
    ],
  }
  for (const source of [
    {
      kind: "model",
      provider: "other",
      model: "grok-4.6",
      replayState: {
        response: { version: 1 },
        blocks: [{ type: "reasoning", id: "rs_bad", encryptedContent: "sealed-bad" }, null],
      },
    },
    {
      kind: "model",
      provider: "grok",
      model: "grok-4.6",
      replayState: {
        response: { version: 1 },
        blocks: [{ type: "reasoning", id: "rs_bad", encryptedContent: "sealed-bad" }],
      },
    },
  ]) {
    const request = encodeResponsesRequest({
      provider: "grok",
      model: "grok-4.6",
      messages: [{ ...base, source }],
    })
    assert.deepEqual(request.input, [{ role: "assistant", content: "Visible answer." }])
  }
})

import assert from "node:assert/strict"
import test from "node:test"

import { decodeResponsesEvents } from "../../../src/internal/responses-codec.mjs"

test("a completed Responses stream maps reasoning, text, disjoint usage, and stop", () => {
  const events = [
    { type: "response.created", sequence_number: 0, response: { id: "resp_fixture", status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { id: "resp_fixture", status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "rs_fixture", type: "reasoning", status: "in_progress", summary: [] } },
    { type: "response.reasoning_summary_part.added", sequence_number: 3, output_index: 0, item_id: "rs_fixture", summary_index: 0, part: { type: "summary_text", text: "" } },
    { type: "response.reasoning_summary_text.delta", sequence_number: 4, output_index: 0, item_id: "rs_fixture", summary_index: 0, delta: "Brief reasoning." },
    { type: "response.reasoning_summary_text.done", sequence_number: 5, output_index: 0, item_id: "rs_fixture", summary_index: 0, text: "Brief reasoning." },
    { type: "response.reasoning_summary_part.done", sequence_number: 6, output_index: 0, item_id: "rs_fixture", summary_index: 0, part: { type: "summary_text", text: "Brief reasoning." } },
    { type: "response.output_item.done", sequence_number: 7, output_index: 0, item: { id: "rs_fixture", type: "reasoning", status: "completed", encrypted_content: "sealed-fixture", summary: [{ type: "summary_text", text: "Brief reasoning." }] } },
    { type: "response.output_item.added", sequence_number: 8, output_index: 1, item: { id: "msg_fixture", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 9, output_index: 1, item_id: "msg_fixture", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 10, output_index: 1, item_id: "msg_fixture", content_index: 0, delta: "OK", logprobs: [] },
    { type: "response.output_text.done", sequence_number: 11, output_index: 1, item_id: "msg_fixture", content_index: 0, text: "OK", logprobs: [] },
    { type: "response.content_part.done", sequence_number: 12, output_index: 1, item_id: "msg_fixture", content_index: 0, part: { type: "output_text", text: "OK", annotations: [] } },
    { type: "response.output_item.done", sequence_number: 13, output_index: 1, item: { id: "msg_fixture", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "OK", annotations: [] }] } },
    {
      type: "response.completed",
      sequence_number: 14,
      response: {
        id: "resp_fixture",
        status: "completed",
        usage: {
          input_tokens: 10,
          input_tokens_details: { cached_tokens: 2 },
          output_tokens: 3,
          output_tokens_details: { reasoning_tokens: 1 },
          total_tokens: 13,
        },
      },
    },
  ]

  assert.deepEqual(decodeResponsesEvents(events), [
    { type: "block-start", index: 0, blockType: "reasoning" },
    { type: "reasoning-delta", index: 0, text: "Brief reasoning." },
    { type: "block-end", index: 0, block: { type: "reasoning", text: "Brief reasoning." } },
    { type: "block-start", index: 1, blockType: "text" },
    { type: "text-delta", index: 1, text: "OK" },
    { type: "block-end", index: 1, block: { type: "text", text: "OK" } },
    {
      type: "usage",
      usage: {
        inputTokens: 8,
        outputTokens: 3,
        cacheReadTokens: 2,
        reasoningTokens: 1,
      },
    },
    {
      type: "finish",
      reason: { kind: "stop" },
      replayState: {
        response: { version: 1 },
        blocks: [
          { type: "reasoning", id: "rs_fixture", encryptedContent: "sealed-fixture" },
          null,
        ],
      },
    },
  ])
})

test("a Responses function call preserves call_id and raw argument deltas", () => {
  const events = [
    { type: "response.created", sequence_number: 0, response: { id: "resp_tool", status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { id: "resp_tool", status: "in_progress" } },
    {
      type: "response.output_item.added",
      sequence_number: 2,
      output_index: 0,
      item: {
        id: "fc_item_fixture",
        type: "function_call",
        status: "in_progress",
        call_id: "call_fixture",
        name: "fixture_tool",
        arguments: "",
      },
    },
    { type: "response.function_call_arguments.delta", sequence_number: 3, output_index: 0, item_id: "fc_item_fixture", delta: '{"value":' },
    { type: "response.function_call_arguments.delta", sequence_number: 4, output_index: 0, item_id: "fc_item_fixture", delta: '"ok"}' },
    { type: "response.function_call_arguments.done", sequence_number: 5, output_index: 0, item_id: "fc_item_fixture", name: "fixture_tool", arguments: '{"value":"ok"}' },
    {
      type: "response.output_item.done",
      sequence_number: 6,
      output_index: 0,
      item: {
        id: "fc_item_fixture",
        type: "function_call",
        status: "completed",
        call_id: "call_fixture",
        name: "fixture_tool",
        arguments: '{"value":"ok"}',
      },
    },
    {
      type: "response.completed",
      sequence_number: 7,
      response: {
        id: "resp_tool",
        status: "completed",
        usage: {
          input_tokens: 12,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 5,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 17,
        },
      },
    },
  ]

  assert.deepEqual(decodeResponsesEvents(events), [
    { type: "block-start", index: 0, blockType: "tool-call" },
    {
      type: "tool-call-delta",
      index: 0,
      id: "call_fixture",
      name: "fixture_tool",
      argumentsDelta: '{"value":',
    },
    {
      type: "tool-call-delta",
      index: 0,
      id: "call_fixture",
      argumentsDelta: '"ok"}',
    },
    {
      type: "block-end",
      index: 0,
      block: {
        type: "tool-call",
        id: "call_fixture",
        name: "fixture_tool",
        arguments: '{"value":"ok"}',
      },
    },
    { type: "usage", usage: { inputTokens: 12, outputTokens: 5 } },
    { type: "finish", reason: { kind: "tool-calls" } },
  ])
})

test("a max-output-token incomplete event closes text and maps max-tokens", () => {
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "msg_cut", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 3, output_index: 0, item_id: "msg_cut", part: { type: "output_text", text: "" } },
    { type: "response.output_text.delta", sequence_number: 4, output_index: 0, item_id: "msg_cut", delta: "Partial" },
    {
      type: "response.incomplete",
      sequence_number: 5,
      response: {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        usage: { input_tokens: 10, output_tokens: 7 },
      },
    },
  ]

  assert.deepEqual(decodeResponsesEvents(events).slice(-3), [
    { type: "block-end", index: 0, block: { type: "text", text: "Partial" } },
    { type: "usage", usage: { inputTokens: 10, outputTokens: 7 } },
    { type: "finish", reason: { kind: "max-tokens" } },
  ])
})

test("a completed response with no output blocks is rejected", () => {
  assert.throws(() => decodeResponsesEvents([
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.completed", sequence_number: 2, response: { status: "completed", usage: { input_tokens: 1, output_tokens: 0 } } },
  ]), { name: "InvalidResponsesStreamError" })
})

import assert from "node:assert/strict"
import test from "node:test"

import {
  createResponsesEventDecoder,
  decodeResponsesEvents,
} from "../../../src/internal/responses-codec.mjs"

const EMPTY_RECEIPT = Object.freeze({
  functionNames: Object.freeze([]),
  serverTools: Object.freeze([]),
})
const FUNCTION_RECEIPT = Object.freeze({
  functionNames: Object.freeze(["fixture_tool"]),
  serverTools: Object.freeze([]),
})

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

  assert.deepEqual(decodeResponsesEvents(events, EMPTY_RECEIPT), [
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

test("a completed Responses stream accepts raw reasoning text events", () => {
  const events = [
    { type: "response.created", sequence_number: 0, response: { id: "resp_raw", status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { id: "resp_raw", status: "in_progress" } },
    {
      type: "response.output_item.added",
      sequence_number: 2,
      output_index: 0,
      item: {
        id: "rs_raw",
        type: "reasoning",
        status: "in_progress",
        content: [],
        summary: [],
      },
    },
    {
      type: "response.content_part.added",
      sequence_number: 3,
      output_index: 0,
      item_id: "rs_raw",
      content_index: 0,
      part: { type: "reasoning_text", text: "" },
    },
    {
      type: "response.reasoning_text.delta",
      sequence_number: 4,
      output_index: 0,
      item_id: "rs_raw",
      content_index: 0,
      delta: "Raw ",
    },
    {
      type: "response.reasoning_text.delta",
      sequence_number: 5,
      output_index: 0,
      item_id: "rs_raw",
      content_index: 0,
      delta: "reasoning.",
    },
    {
      type: "response.reasoning_text.done",
      sequence_number: 6,
      output_index: 0,
      item_id: "rs_raw",
      content_index: 0,
      text: "Raw reasoning.",
    },
    {
      type: "response.content_part.done",
      sequence_number: 7,
      output_index: 0,
      item_id: "rs_raw",
      content_index: 0,
      part: { type: "reasoning_text", text: "Raw reasoning." },
    },
    {
      type: "response.output_item.done",
      sequence_number: 8,
      output_index: 0,
      item: {
        id: "rs_raw",
        type: "reasoning",
        status: "completed",
        content: [{ type: "reasoning_text", text: "Raw reasoning." }],
        encrypted_content: "sealed-raw",
        summary: [],
      },
    },
    { type: "response.output_item.added", sequence_number: 9, output_index: 1, item: { id: "msg_raw", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 10, output_index: 1, item_id: "msg_raw", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 11, output_index: 1, item_id: "msg_raw", content_index: 0, delta: "OK" },
    { type: "response.output_text.done", sequence_number: 12, output_index: 1, item_id: "msg_raw", content_index: 0, text: "OK" },
    { type: "response.content_part.done", sequence_number: 13, output_index: 1, item_id: "msg_raw", content_index: 0, part: { type: "output_text", text: "OK", annotations: [] } },
    { type: "response.output_item.done", sequence_number: 14, output_index: 1, item: { id: "msg_raw", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "OK", annotations: [] }] } },
    {
      type: "response.completed",
      sequence_number: 15,
      response: {
        id: "resp_raw",
        status: "completed",
        usage: { input_tokens: 4, output_tokens: 3 },
      },
    },
  ]

  assert.deepEqual(decodeResponsesEvents(events, EMPTY_RECEIPT), [
    { type: "block-start", index: 0, blockType: "reasoning" },
    { type: "reasoning-delta", index: 0, text: "Raw " },
    { type: "reasoning-delta", index: 0, text: "reasoning." },
    { type: "block-end", index: 0, block: { type: "reasoning", text: "Raw reasoning." } },
    { type: "block-start", index: 1, blockType: "text" },
    { type: "text-delta", index: 1, text: "OK" },
    { type: "block-end", index: 1, block: { type: "text", text: "OK" } },
    { type: "usage", usage: { inputTokens: 4, outputTokens: 3 } },
    {
      type: "finish",
      reason: { kind: "stop" },
      replayState: {
        response: { version: 1 },
        blocks: [
          {
            type: "reasoning",
            id: "rs_raw",
            encryptedContent: "sealed-raw",
            textType: "reasoning_text",
          },
          null,
        ],
      },
    },
  ])
})

test("a completed Responses stream accepts a closed empty reasoning item", () => {
  const emptyReasoning = {
    id: "rs_empty",
    type: "reasoning",
    status: "completed",
    encrypted_content: "sealed-empty",
    summary: [],
  }
  const events = [
    { type: "response.created", sequence_number: 0, response: { id: "resp_empty", status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { id: "resp_empty", status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: emptyReasoning },
    { type: "response.output_item.done", sequence_number: 3, output_index: 0, item: emptyReasoning },
    { type: "response.output_item.added", sequence_number: 4, output_index: 1, item: { id: "msg_empty_reasoning", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 5, output_index: 1, item_id: "msg_empty_reasoning", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 6, output_index: 1, item_id: "msg_empty_reasoning", content_index: 0, delta: "OK" },
    { type: "response.output_text.done", sequence_number: 7, output_index: 1, item_id: "msg_empty_reasoning", content_index: 0, text: "OK" },
    { type: "response.content_part.done", sequence_number: 8, output_index: 1, item_id: "msg_empty_reasoning", content_index: 0, part: { type: "output_text", text: "OK", annotations: [] } },
    { type: "response.output_item.done", sequence_number: 9, output_index: 1, item: { id: "msg_empty_reasoning", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "OK", annotations: [] }] } },
    {
      type: "response.completed",
      sequence_number: 10,
      response: {
        id: "resp_empty",
        status: "completed",
        usage: { input_tokens: 4, output_tokens: 2 },
      },
    },
  ]

  assert.deepEqual(decodeResponsesEvents(events, EMPTY_RECEIPT), [
    { type: "block-start", index: 0, blockType: "reasoning" },
    { type: "block-end", index: 0, block: { type: "reasoning", text: "" } },
    { type: "block-start", index: 1, blockType: "text" },
    { type: "text-delta", index: 1, text: "OK" },
    { type: "block-end", index: 1, block: { type: "text", text: "OK" } },
    { type: "usage", usage: { inputTokens: 4, outputTokens: 2 } },
    {
      type: "finish",
      reason: { kind: "stop" },
      replayState: {
        response: { version: 1 },
        blocks: [
          { type: "reasoning", id: "rs_empty", encryptedContent: "sealed-empty" },
          null,
        ],
      },
    },
  ])
})

test("a reasoning item start cannot hide nonempty summary or content", () => {
  const invalidStarts = [
    {
      id: "rs_hidden_summary",
      type: "reasoning",
      status: "in_progress",
      summary: [{ type: "summary_text", text: "hidden" }],
    },
    {
      id: "rs_hidden_content",
      type: "reasoning",
      status: "in_progress",
      summary: [],
      content: [{ type: "reasoning_text", text: "hidden" }],
    },
  ]

  for (const item of invalidStarts) {
    const decoder = createRunningDecoder(EMPTY_RECEIPT)
    assert.throws(() => decoder.push({
      type: "response.output_item.added",
      sequence_number: 2,
      output_index: 0,
      item,
    }), { name: "InvalidResponsesStreamError" })
  }
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

  assert.deepEqual(decodeResponsesEvents(events, FUNCTION_RECEIPT), [
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

  assert.deepEqual(decodeResponsesEvents(events, EMPTY_RECEIPT).slice(-3), [
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
  ], EMPTY_RECEIPT), { name: "InvalidResponsesStreamError" })
})

test("a response receipt is mandatory, exact, and detached from caller mutation", () => {
  assert.throws(() => createResponsesEventDecoder(), { name: "InvalidResponsesStreamError" })
  assert.throws(() => createResponsesEventDecoder({
    functionNames: [],
    serverTools: [],
    permissive: true,
  }), { name: "InvalidResponsesStreamError" })
  assert.throws(() => createResponsesEventDecoder({
    functionNames: ["fixture_tool", "fixture_tool"],
    serverTools: [],
  }), { name: "InvalidResponsesStreamError" })
  assert.throws(() => createResponsesEventDecoder({
    functionNames: [],
    serverTools: ["x_search", "web_search"],
  }), { name: "InvalidResponsesStreamError" })
  assert.throws(() => createResponsesEventDecoder({
    functionNames: ["web_search"],
    serverTools: ["web_search"],
  }), { name: "InvalidResponsesStreamError" })
  assert.throws(() => createResponsesEventDecoder({
    functionNames: ["x_search"],
    serverTools: ["x_search"],
  }), { name: "InvalidResponsesStreamError" })

  const functionNames = ["fixture_tool"]
  const decoder = createResponsesEventDecoder({ functionNames, serverTools: [] })
  functionNames[0] = "other_tool"
  decoder.push({
    type: "response.created",
    sequence_number: 0,
    response: { status: "in_progress" },
  })
  decoder.push({
    type: "response.in_progress",
    sequence_number: 1,
    response: { status: "in_progress" },
  })
  assert.deepEqual(decoder.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: {
      id: "fc_receipt",
      type: "function_call",
      status: "in_progress",
      call_id: "call_receipt",
      name: "fixture_tool",
      arguments: "",
    },
  }), [{ type: "block-start", index: 0, blockType: "tool-call" }])
})

test("a function call not declared by the response receipt is rejected", () => {
  const decoder = createRunningDecoder(EMPTY_RECEIPT)
  assert.throws(() => decoder.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: {
      id: "fc_undeclared",
      type: "function_call",
      status: "in_progress",
      call_id: "call_undeclared",
      name: "fixture_tool",
      arguments: "",
    },
  }), { name: "InvalidResponsesStreamError" })
})

test("output item ids and call ids cannot be reused across output indexes", () => {
  const duplicateItem = createRunningDecoder(EMPTY_RECEIPT)
  duplicateItem.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: { id: "duplicate_item", type: "message", role: "assistant", status: "in_progress", content: [] },
  })
  assert.throws(() => duplicateItem.push({
    type: "response.output_item.added",
    sequence_number: 3,
    output_index: 1,
    item: { id: "duplicate_item", type: "message", role: "assistant", status: "in_progress", content: [] },
  }), { name: "InvalidResponsesStreamError" })

  const duplicateCall = createRunningDecoder(FUNCTION_RECEIPT)
  duplicateCall.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: functionCallItem("fc_first", "duplicate_call"),
  })
  assert.throws(() => duplicateCall.push({
    type: "response.output_item.added",
    sequence_number: 3,
    output_index: 1,
    item: functionCallItem("fc_second", "duplicate_call"),
  }), { name: "InvalidResponsesStreamError" })
})

test("response identity is bound across created, in-progress, and terminal events", () => {
  const mismatchedProgress = createResponsesEventDecoder(EMPTY_RECEIPT)
  mismatchedProgress.push({
    type: "response.created",
    sequence_number: 0,
    response: { id: "resp_first", status: "in_progress" },
  })
  assert.throws(() => mismatchedProgress.push({
    type: "response.in_progress",
    sequence_number: 1,
    response: { id: "resp_other", status: "in_progress" },
  }), { name: "InvalidResponsesStreamError" })

  const mismatchedTerminal = minimalTextEvents({ text: "OK" })
  mismatchedTerminal[0].response.id = "resp_first"
  mismatchedTerminal[1].response.id = "resp_first"
  mismatchedTerminal.at(-1).response.id = "resp_other"
  assert.throws(() => decodeResponsesEvents(mismatchedTerminal, EMPTY_RECEIPT), {
    name: "InvalidResponsesStreamError",
  })
})

test("created and in-progress metadata cannot predeclare Search evidence", () => {
  const citationAtCreated = createResponsesEventDecoder({
    functionNames: [],
    serverTools: ["web_search"],
  })
  assert.throws(() => citationAtCreated.push({
    type: "response.created",
    sequence_number: 0,
    response: {
      status: "in_progress",
      citations: ["https://example.com/source"],
    },
  }), { name: "InvalidResponsesStreamError" })

  const outputAtInProgress = createResponsesEventDecoder({
    functionNames: [],
    serverTools: ["web_search"],
  })
  outputAtInProgress.push({
    type: "response.created",
    sequence_number: 0,
    response: { status: "in_progress" },
  })
  assert.throws(() => outputAtInProgress.push({
    type: "response.in_progress",
    sequence_number: 1,
    response: {
      status: "in_progress",
      output: [webSearchItem("completed", "xAI", [])],
    },
  }), { name: "InvalidResponsesStreamError" })

  const usageAtInProgress = createResponsesEventDecoder({
    functionNames: [],
    serverTools: ["web_search"],
  })
  usageAtInProgress.push({
    type: "response.created",
    sequence_number: 0,
    response: { status: "in_progress" },
  })
  assert.throws(() => usageAtInProgress.push({
    type: "response.in_progress",
    sequence_number: 1,
    response: {
      status: "in_progress",
      server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 },
    },
  }), { name: "InvalidResponsesStreamError" })
})

test("sequence numbers and newly added output indexes are contiguous", () => {
  const skippedSequence = createResponsesEventDecoder(EMPTY_RECEIPT)
  skippedSequence.push({
    type: "response.created",
    sequence_number: 0,
    response: { status: "in_progress" },
  })
  assert.throws(() => skippedSequence.push({
    type: "response.in_progress",
    sequence_number: 2,
    response: { status: "in_progress" },
  }), { name: "InvalidResponsesStreamError" })

  const skippedInitialIndex = createRunningDecoder(EMPTY_RECEIPT)
  assert.throws(() => skippedInitialIndex.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 1,
    item: { id: "msg_skipped_initial", type: "message", role: "assistant", status: "in_progress", content: [] },
  }), { name: "InvalidResponsesStreamError" })

  const skippedLaterIndex = createRunningDecoder(EMPTY_RECEIPT)
  skippedLaterIndex.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: { id: "msg_index_zero", type: "message", role: "assistant", status: "in_progress", content: [] },
  })
  assert.throws(() => skippedLaterIndex.push({
    type: "response.output_item.added",
    sequence_number: 3,
    output_index: 2,
    item: { id: "msg_index_two", type: "message", role: "assistant", status: "in_progress", content: [] },
  }), { name: "InvalidResponsesStreamError" })
})

test("reasoning summary parts enforce added, delta, text-done, and part-done order", () => {
  const deltaBeforePart = createReasoningDecoder("reasoning_early_delta")
  assert.throws(() => deltaBeforePart.push({
    type: "response.reasoning_summary_text.delta",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_early_delta",
    delta: "x",
  }), { name: "InvalidResponsesStreamError" })

  const duplicatePart = createReasoningDecoder("reasoning_duplicate_part")
  duplicatePart.push({
    type: "response.reasoning_summary_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_duplicate_part",
    part: { type: "summary_text", text: "" },
  })
  assert.throws(() => duplicatePart.push({
    type: "response.reasoning_summary_part.added",
    sequence_number: 4,
    output_index: 0,
    item_id: "reasoning_duplicate_part",
    part: { type: "summary_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })

  const partDoneBeforeTextDone = createReasoningDecoder("reasoning_early_part_done")
  partDoneBeforeTextDone.push({
    type: "response.reasoning_summary_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_early_part_done",
    part: { type: "summary_text", text: "" },
  })
  partDoneBeforeTextDone.push({
    type: "response.reasoning_summary_text.delta",
    sequence_number: 4,
    output_index: 0,
    item_id: "reasoning_early_part_done",
    delta: "x",
  })
  assert.throws(() => partDoneBeforeTextDone.push({
    type: "response.reasoning_summary_part.done",
    sequence_number: 5,
    output_index: 0,
    item_id: "reasoning_early_part_done",
    part: { type: "summary_text", text: "x" },
  }), { name: "InvalidResponsesStreamError" })
})

test("raw reasoning content requires explicit item and content indexes", () => {
  const missingItemId = createReasoningDecoder("reasoning_raw_missing_item")
  assert.throws(() => missingItemId.push({
    type: "response.content_part.added",
    sequence_number: 3,
    output_index: 0,
    content_index: 0,
    part: { type: "reasoning_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })

  const missingContentIndex = createReasoningDecoder("reasoning_raw_missing_content")
  assert.throws(() => missingContentIndex.push({
    type: "response.content_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_raw_missing_content",
    part: { type: "reasoning_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })

  const wrongItemId = createReasoningDecoder("reasoning_raw_wrong_item")
  assert.throws(() => wrongItemId.push({
    type: "response.content_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_raw_other_item",
    content_index: 0,
    part: { type: "reasoning_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })

  const wrongContentIndex = createReasoningDecoder("reasoning_raw_wrong_content")
  assert.throws(() => wrongContentIndex.push({
    type: "response.content_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_raw_wrong_content",
    content_index: 1,
    part: { type: "reasoning_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })
})

test("raw reasoning enforces part, delta, text-done, and part-done order", () => {
  const deltaBeforePart = createReasoningDecoder("reasoning_raw_early_delta")
  assert.throws(() => deltaBeforePart.push({
    type: "response.reasoning_text.delta",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_raw_early_delta",
    content_index: 0,
    delta: "Raw reasoning.",
  }), { name: "InvalidResponsesStreamError" })

  const partDoneBeforeTextDone = createReasoningDecoder("reasoning_raw_early_part_done")
  openRawReasoning(partDoneBeforeTextDone, "reasoning_raw_early_part_done")
  partDoneBeforeTextDone.push({
    type: "response.reasoning_text.delta",
    sequence_number: 4,
    output_index: 0,
    item_id: "reasoning_raw_early_part_done",
    content_index: 0,
    delta: "Raw reasoning.",
  })
  assert.throws(() => partDoneBeforeTextDone.push({
    type: "response.content_part.done",
    sequence_number: 5,
    output_index: 0,
    item_id: "reasoning_raw_early_part_done",
    content_index: 0,
    part: { type: "reasoning_text", text: "Raw reasoning." },
  }), { name: "InvalidResponsesStreamError" })
})

test("raw reasoning done text must match its accumulated deltas", () => {
  const decoder = createReasoningDecoder("reasoning_raw_mismatched_done")
  openRawReasoning(decoder, "reasoning_raw_mismatched_done")
  decoder.push({
    type: "response.reasoning_text.delta",
    sequence_number: 4,
    output_index: 0,
    item_id: "reasoning_raw_mismatched_done",
    content_index: 0,
    delta: "Raw reasoning.",
  })

  assert.throws(() => decoder.push({
    type: "response.reasoning_text.done",
    sequence_number: 5,
    output_index: 0,
    item_id: "reasoning_raw_mismatched_done",
    content_index: 0,
    text: "Different reasoning.",
  }), { name: "InvalidResponsesStreamError" })
})

test("raw and summary reasoning representations cannot mix", () => {
  const rawThenSummary = createReasoningDecoder("reasoning_raw_then_summary")
  openRawReasoning(rawThenSummary, "reasoning_raw_then_summary")
  assert.throws(() => rawThenSummary.push({
    type: "response.reasoning_summary_part.added",
    sequence_number: 4,
    output_index: 0,
    item_id: "reasoning_raw_then_summary",
    summary_index: 0,
    part: { type: "summary_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })

  const summaryThenRaw = createReasoningDecoder("reasoning_summary_then_raw")
  summaryThenRaw.push({
    type: "response.reasoning_summary_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "reasoning_summary_then_raw",
    summary_index: 0,
    part: { type: "summary_text", text: "" },
  })
  assert.throws(() => summaryThenRaw.push({
    type: "response.content_part.added",
    sequence_number: 4,
    output_index: 0,
    item_id: "reasoning_summary_then_raw",
    content_index: 0,
    part: { type: "reasoning_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })
})

test("raw reasoning terminal content and summary must match the streamed representation", () => {
  const nonemptySummary = createReasoningDecoder("reasoning_raw_terminal_summary")
  closeRawReasoningPart(nonemptySummary, "reasoning_raw_terminal_summary")
  assert.throws(() => nonemptySummary.push({
    type: "response.output_item.done",
    sequence_number: 7,
    output_index: 0,
    item: {
      id: "reasoning_raw_terminal_summary",
      type: "reasoning",
      status: "completed",
      content: [{ type: "reasoning_text", text: "Raw reasoning." }],
      summary: [{ type: "summary_text", text: "Unexpected summary." }],
    },
  }), { name: "InvalidResponsesStreamError" })

  const mismatchedContent = createReasoningDecoder("reasoning_raw_terminal_content")
  closeRawReasoningPart(mismatchedContent, "reasoning_raw_terminal_content")
  assert.throws(() => mismatchedContent.push({
    type: "response.output_item.done",
    sequence_number: 7,
    output_index: 0,
    item: {
      id: "reasoning_raw_terminal_content",
      type: "reasoning",
      status: "completed",
      content: [{ type: "reasoning_text", text: "Different reasoning." }],
      summary: [],
    },
  }), { name: "InvalidResponsesStreamError" })
})

test("a max-output-token incomplete event closes partial raw reasoning without replay", () => {
  const events = [
    { type: "response.created", sequence_number: 0, response: { id: "resp_raw_incomplete", status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { id: "resp_raw_incomplete", status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "rs_raw_incomplete", type: "reasoning", status: "in_progress", content: [], summary: [] } },
    { type: "response.content_part.added", sequence_number: 3, output_index: 0, item_id: "rs_raw_incomplete", content_index: 0, part: { type: "reasoning_text", text: "" } },
    { type: "response.reasoning_text.delta", sequence_number: 4, output_index: 0, item_id: "rs_raw_incomplete", content_index: 0, delta: "Partial reasoning." },
    {
      type: "response.incomplete",
      sequence_number: 5,
      response: {
        id: "resp_raw_incomplete",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        usage: { input_tokens: 4, output_tokens: 2 },
      },
    },
  ]

  assert.deepEqual(decodeResponsesEvents(events, EMPTY_RECEIPT), [
    { type: "block-start", index: 0, blockType: "reasoning" },
    { type: "reasoning-delta", index: 0, text: "Partial reasoning." },
    { type: "block-end", index: 0, block: { type: "reasoning", text: "Partial reasoning." } },
    { type: "usage", usage: { inputTokens: 4, outputTokens: 2 } },
    { type: "finish", reason: { kind: "max-tokens" } },
  ])
})

test("Web Search lifecycle emits no tool chunks, preserves cited text, and suppresses reasoning replay", () => {
  const text = "Web result"
  const annotation = citationAnnotation({ endIndex: text.length })
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "rs_web", type: "reasoning", status: "in_progress", summary: [] } },
    { type: "response.reasoning_summary_part.added", sequence_number: 3, output_index: 0, item_id: "rs_web", part: { type: "summary_text", text: "" } },
    { type: "response.reasoning_summary_text.delta", sequence_number: 4, output_index: 0, item_id: "rs_web", delta: "Search reasoning." },
    { type: "response.reasoning_summary_text.done", sequence_number: 5, output_index: 0, item_id: "rs_web", text: "Search reasoning." },
    { type: "response.reasoning_summary_part.done", sequence_number: 6, output_index: 0, item_id: "rs_web", part: { type: "summary_text", text: "Search reasoning." } },
    { type: "response.output_item.done", sequence_number: 7, output_index: 0, item: { id: "rs_web", type: "reasoning", status: "completed", encrypted_content: "sealed-search", summary: [{ type: "summary_text", text: "Search reasoning." }] } },
    { type: "response.output_item.added", sequence_number: 8, output_index: 1, item: webSearchItem("in_progress", "", []) },
    { type: "response.web_search_call.in_progress", sequence_number: 9, output_index: 1, item_id: "ws_fixture" },
    { type: "response.web_search_call.searching", sequence_number: 10, output_index: 1, item_id: "ws_fixture" },
    { type: "response.web_search_call.completed", sequence_number: 11, output_index: 1, item_id: "ws_fixture" },
    {
      type: "response.output_item.done",
      sequence_number: 12,
      output_index: 1,
      item: webSearchItem("completed", "xAI", [{ kind: "web", score: 1, metadata: { public: true } }]),
    },
    { type: "response.output_item.added", sequence_number: 13, output_index: 2, item: { id: "msg_web", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 14, output_index: 2, item_id: "msg_web", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 15, output_index: 2, item_id: "msg_web", content_index: 0, delta: text },
    { type: "response.output_text.annotation.added", sequence_number: 16, output_index: 2, item_id: "msg_web", content_index: 0, annotation_index: 0, annotation },
    { type: "response.output_text.done", sequence_number: 17, output_index: 2, item_id: "msg_web", content_index: 0, text },
    { type: "response.content_part.done", sequence_number: 18, output_index: 2, item_id: "msg_web", content_index: 0, part: { type: "output_text", text, annotations: [annotation] } },
    { type: "response.output_item.done", sequence_number: 19, output_index: 2, item: { id: "msg_web", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [annotation] }] } },
    {
      type: "response.completed",
      sequence_number: 20,
      response: {
        status: "completed",
        output: [
          {
            id: "rs_web",
            type: "reasoning",
            status: "completed",
            encrypted_content: "sealed-search",
            summary: [{ type: "summary_text", text: "Search reasoning." }],
          },
          webSearchItem("completed", "xAI", []),
          { type: "message", content: [{ type: "output_text", text, annotations: [annotation] }] },
        ],
        citations: [annotation.url],
        server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 },
        usage: { input_tokens: 10, output_tokens: 3 },
      },
    },
  ]

  const receipt = {
    functionNames: [],
    serverTools: ["web_search"],
  }
  const chunks = decodeResponsesEvents(events, receipt)
  assert.deepEqual(chunks.map((chunk) => chunk.type), [
    "block-start",
    "reasoning-delta",
    "block-end",
    "block-start",
    "text-delta",
    "block-end",
    "usage",
    "finish",
  ])
  assert.deepEqual(chunks.find((chunk) => chunk.type === "text-delta"), {
    type: "text-delta",
    index: 2,
    text,
  })
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })

  const terminal = events.at(-1)
  const missingLifecycleSnapshot = events.map((event) => event === terminal
    ? {
      ...event,
      response: {
        ...event.response,
        output: [event.response.output[0], event.response.output[2]],
      },
    }
    : event)
  assert.throws(() => decodeResponsesEvents(missingLifecycleSnapshot, receipt), {
    name: "InvalidResponsesStreamError",
  })

  const misindexedLifecycleSnapshot = events.map((event) => event === terminal
    ? {
      ...event,
      response: {
        ...event.response,
        output: [
          event.response.output[1],
          event.response.output[0],
          event.response.output[2],
        ],
      },
    }
    : event)
  assert.throws(() => decodeResponsesEvents(misindexedLifecycleSnapshot, receipt), {
    name: "InvalidResponsesStreamError",
  })

  const impreciseUsageCount = events.map((event) => event === terminal
    ? {
      ...event,
      response: {
        ...event.response,
        server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 2 },
      },
    }
    : event)
  assert.throws(() => decodeResponsesEvents(impreciseUsageCount, receipt), {
    name: "InvalidResponsesStreamError",
  })
})

test("a completed Web Search accepts an exact 16 KiB multibyte open_page URL", () => {
  const prefix = "https://example.com/"
  const remainingBytes = (16 * 1024) - Buffer.byteLength(prefix, "utf8")
  const url = `${prefix}${"界".repeat(Math.floor(remainingBytes / 3))}${"a".repeat(remainingBytes % 3)}`
  assert.equal(Buffer.byteLength(url, "utf8"), 16 * 1024)

  const chunks = decodeResponsesEvents(
    webSearchCompletionEvents({ type: "open_page", url }),
    { functionNames: [], serverTools: ["web_search"] },
  )
  assert.deepEqual(chunks.map((chunk) => chunk.type), [
    "block-start",
    "text-delta",
    "block-end",
    "usage",
    "finish",
  ])
  assert.equal(chunks.some((chunk) => chunk.type.includes("tool-call")), false)
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })
  assert.equal("replayState" in chunks.at(-1), false)
})

test("open_page rejects malformed, oversized, unknown, and premature actions without invoking accessors", () => {
  const prefix = "https://example.com/"
  const overLimit = `${prefix}${"a".repeat((16 * 1024) - Buffer.byteLength(prefix, "utf8") + 1)}`
  const invalidCompletedActions = [
    { label: "empty URL", action: { type: "open_page", url: "" } },
    { label: "non-string URL", action: { type: "open_page", url: 42 } },
    { label: "missing URL", action: { type: "open_page" } },
    { label: "extra key", action: { type: "open_page", url: "https://example.com", extra: true } },
    { label: "oversized URL", action: { type: "open_page", url: overLimit } },
    { label: "unknown action", action: { type: "find", url: "https://example.com" } },
  ]
  for (const { label, action } of invalidCompletedActions) {
    assert.throws(() => decodeResponsesEvents(
      webSearchCompletionEvents(action),
      { functionNames: [], serverTools: ["web_search"] },
    ), { name: "InvalidResponsesStreamError" }, label)
  }

  const direct = createRunningDecoder({ functionNames: [], serverTools: ["web_search"] })
  assert.throws(() => direct.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: webSearchItemWithAction("in_progress", {
      type: "open_page",
      url: "https://example.com/direct",
    }),
  }), { name: "InvalidResponsesStreamError" })

  let typeGetterCalls = 0
  const typeAccessor = { url: "https://example.com/type-accessor" }
  Object.defineProperty(typeAccessor, "type", {
    enumerable: true,
    get() {
      typeGetterCalls += 1
      return "open_page"
    },
  })
  assert.throws(() => decodeResponsesEvents(
    webSearchCompletionEvents(typeAccessor),
    { functionNames: [], serverTools: ["web_search"] },
  ), { name: "InvalidResponsesStreamError" })
  assert.equal(typeGetterCalls, 0)

  let urlGetterCalls = 0
  const urlAccessor = { type: "open_page" }
  Object.defineProperty(urlAccessor, "url", {
    enumerable: true,
    get() {
      urlGetterCalls += 1
      return "https://example.com/url-accessor"
    },
  })
  assert.throws(() => decodeResponsesEvents(
    webSearchCompletionEvents(urlAccessor),
    { functionNames: [], serverTools: ["web_search"] },
  ), { name: "InvalidResponsesStreamError" })
  assert.equal(urlGetterCalls, 0)
})

test("terminal Web Search output must match the streamed action type and open_page URL", () => {
  const receipt = { functionNames: [], serverTools: ["web_search"] }
  assert.throws(() => decodeResponsesEvents(
    webSearchCompletionEvents(
      { type: "open_page", url: "https://example.com/streamed" },
      { type: "open_page", url: "https://example.com/terminal" },
    ),
    receipt,
  ), { name: "InvalidResponsesStreamError" })

  assert.throws(() => decodeResponsesEvents(
    webSearchCompletionEvents(
      { type: "open_page", url: "https://example.com/streamed" },
      { type: "search", query: "xAI", sources: [] },
    ),
    receipt,
  ), { name: "InvalidResponsesStreamError" })
})

test("streamed and terminal Search items reject self-replacing accessors without invocation", () => {
  const receipt = { functionNames: [], serverTools: ["web_search"] }

  const streamedWebEvents = webSearchCompletionEvents({ type: "search", query: "xAI", sources: [] })
  const streamedWebItem = streamedWebEvents.find(
    (event) => event.type === "response.output_item.done" && event.output_index === 0,
  ).item
  const streamedWebIdCalls = installSelfReplacingAccessor(streamedWebItem, "id", "ws_fixture")
  assert.throws(() => decodeResponsesEvents(streamedWebEvents, receipt), {
    name: "InvalidResponsesStreamError",
  })
  assert.equal(streamedWebIdCalls(), 0)

  const streamedUrl = "https://example.com/streamed"
  const terminalWebEvents = webSearchCompletionEvents(
    { type: "open_page", url: streamedUrl },
    { type: "open_page", url: "https://example.com/mismatched" },
  )
  const terminalWebItem = terminalWebEvents.at(-1).response.output[0]
  const terminalWebTypeCalls = installSelfReplacingAccessor(
    terminalWebItem,
    "type",
    "web_search_call",
    () => {
      terminalWebItem.action.url = streamedUrl
    },
  )
  assert.throws(() => decodeResponsesEvents(terminalWebEvents, receipt), {
    name: "InvalidResponsesStreamError",
  })
  assert.equal(terminalWebTypeCalls(), 0)

  const streamedXEvents = xSearchCompletionEvents()
  const streamedXItem = streamedXEvents.find(
    (event) => event.type === "response.output_item.done" && event.output_index === 0,
  ).item
  const streamedXIdCalls = installSelfReplacingAccessor(streamedXItem, "id", "x_fixture")
  assert.throws(() => decodeResponsesEvents(streamedXEvents, {
    functionNames: [],
    serverTools: ["x_search"],
  }), { name: "InvalidResponsesStreamError" })
  assert.equal(streamedXIdCalls(), 0)

  const terminalXEvents = xSearchCompletionEvents()
  const terminalXItem = terminalXEvents.at(-1).response.output[0]
  const terminalXTypeCalls = installSelfReplacingAccessor(
    terminalXItem,
    "type",
    "custom_tool_call",
  )
  assert.throws(() => decodeResponsesEvents(terminalXEvents, {
    functionNames: [],
    serverTools: ["x_search"],
  }), { name: "InvalidResponsesStreamError" })
  assert.equal(terminalXTypeCalls(), 0)

  const terminalXInputEvents = xSearchCompletionEvents()
  const terminalXInputItem = terminalXInputEvents.at(-1).response.output[0]
  const terminalXInputCalls = installSelfReplacingAccessor(
    terminalXInputItem,
    "input",
    '{"query":"xAI"}',
  )
  assert.throws(() => decodeResponsesEvents(terminalXInputEvents, {
    functionNames: [],
    serverTools: ["x_search"],
  }), { name: "InvalidResponsesStreamError" })
  assert.equal(terminalXInputCalls(), 0)

  const terminalStatusEvents = webSearchCompletionEvents(
    { type: "open_page", url: streamedUrl },
    { type: "open_page", url: "https://example.com/status-mismatch" },
  )
  const terminalStatusResponse = terminalStatusEvents.at(-1).response
  const terminalStatusCalls = installSelfReplacingAccessor(
    terminalStatusResponse,
    "status",
    "completed",
    () => {
      terminalStatusResponse.output[0].action.url = streamedUrl
    },
  )
  assert.throws(() => decodeResponsesEvents(terminalStatusEvents, receipt), {
    name: "InvalidResponsesStreamError",
  })
  assert.equal(terminalStatusCalls(), 0)

  const terminalOutputEvents = webSearchCompletionEvents({
    type: "open_page",
    url: streamedUrl,
  })
  const terminalOutputResponse = terminalOutputEvents.at(-1).response
  const terminalOutput = terminalOutputResponse.output
  const terminalOutputCalls = installSelfReplacingAccessor(
    terminalOutputResponse,
    "output",
    terminalOutput,
  )
  assert.throws(() => decodeResponsesEvents(terminalOutputEvents, receipt), {
    name: "InvalidResponsesStreamError",
  })
  assert.equal(terminalOutputCalls(), 0)
})

test("Web Search continuation accepts closed empty reasoning before the final message", () => {
  const firstEmpty = {
    id: "rs_search_empty_completed",
    type: "reasoning",
    status: "completed",
    encrypted_content: "sealed-search-empty-completed",
    summary: [],
  }
  const secondEmptyAdded = {
    id: "rs_search_empty_progress",
    type: "reasoning",
    status: "in_progress",
    summary: [],
  }
  const secondEmptyDone = {
    ...secondEmptyAdded,
    status: "completed",
    encrypted_content: "sealed-search-empty-progress",
  }
  const text = "Search result"
  const messageDone = {
    id: "msg_search_empty",
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  }
  const webDone = webSearchItem("completed", "xAI", [])
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: webSearchItem("in_progress", "", []) },
    { type: "response.web_search_call.in_progress", sequence_number: 3, output_index: 0, item_id: "ws_fixture" },
    { type: "response.web_search_call.searching", sequence_number: 4, output_index: 0, item_id: "ws_fixture" },
    { type: "response.web_search_call.completed", sequence_number: 5, output_index: 0, item_id: "ws_fixture" },
    { type: "response.output_item.done", sequence_number: 6, output_index: 0, item: webDone },
    { type: "response.output_item.added", sequence_number: 7, output_index: 1, item: firstEmpty },
    { type: "response.output_item.done", sequence_number: 8, output_index: 1, item: firstEmpty },
    { type: "response.output_item.added", sequence_number: 9, output_index: 2, item: secondEmptyAdded },
    { type: "response.output_item.done", sequence_number: 10, output_index: 2, item: secondEmptyDone },
    { type: "response.output_item.added", sequence_number: 11, output_index: 3, item: { id: "msg_search_empty", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 12, output_index: 3, item_id: "msg_search_empty", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 13, output_index: 3, item_id: "msg_search_empty", content_index: 0, delta: text },
    { type: "response.output_text.done", sequence_number: 14, output_index: 3, item_id: "msg_search_empty", content_index: 0, text },
    { type: "response.content_part.done", sequence_number: 15, output_index: 3, item_id: "msg_search_empty", content_index: 0, part: { type: "output_text", text, annotations: [] } },
    { type: "response.output_item.done", sequence_number: 16, output_index: 3, item: messageDone },
    {
      type: "response.completed",
      sequence_number: 17,
      response: {
        status: "completed",
        output: [webDone, firstEmpty, secondEmptyDone, messageDone],
        server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 },
        usage: { input_tokens: 8, output_tokens: 3 },
      },
    },
  ]

  const chunks = decodeResponsesEvents(events, {
    functionNames: [],
    serverTools: ["web_search"],
  })
  assert.deepEqual(chunks.map((chunk) => chunk.type), [
    "block-start",
    "block-end",
    "block-start",
    "block-end",
    "block-start",
    "text-delta",
    "block-end",
    "usage",
    "finish",
  ])
  assert.equal(chunks.some((chunk) => chunk.type.includes("tool-call")), false)
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })
})

test("Web Search continuation accepts consecutive closed empty reuse of a reasoning item id", () => {
  const initialReasoningDone = {
    id: "rs_search_reused",
    type: "reasoning",
    status: "completed",
    encrypted_content: "sealed-search-summary",
    summary: [{ type: "summary_text", text: "Search reasoning." }],
  }
  const reusedReasoningAdded = {
    id: "rs_search_reused",
    type: "reasoning",
    status: "in_progress",
    summary: [],
  }
  const reusedReasoningDone = {
    ...reusedReasoningAdded,
    status: "completed",
    encrypted_content: "sealed-search-empty",
  }
  const reusedReasoningDoneAgain = {
    ...reusedReasoningAdded,
    status: "completed",
    content: [],
    encrypted_content: "sealed-search-empty-again",
  }
  const webDone = webSearchItem("completed", "xAI", [])
  const messageDone = {
    id: "msg_search_reused",
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: "OK", annotations: [] }],
  }
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "rs_search_reused", type: "reasoning", status: "in_progress", summary: [] } },
    { type: "response.reasoning_summary_part.added", sequence_number: 3, output_index: 0, item_id: "rs_search_reused", summary_index: 0, part: { type: "summary_text", text: "" } },
    { type: "response.reasoning_summary_text.delta", sequence_number: 4, output_index: 0, item_id: "rs_search_reused", summary_index: 0, delta: "Search reasoning." },
    { type: "response.reasoning_summary_text.done", sequence_number: 5, output_index: 0, item_id: "rs_search_reused", summary_index: 0, text: "Search reasoning." },
    { type: "response.reasoning_summary_part.done", sequence_number: 6, output_index: 0, item_id: "rs_search_reused", summary_index: 0, part: { type: "summary_text", text: "Search reasoning." } },
    { type: "response.output_item.done", sequence_number: 7, output_index: 0, item: initialReasoningDone },
    { type: "response.output_item.added", sequence_number: 8, output_index: 1, item: webSearchItem("in_progress", "", []) },
    { type: "response.web_search_call.in_progress", sequence_number: 9, output_index: 1, item_id: "ws_fixture" },
    { type: "response.web_search_call.searching", sequence_number: 10, output_index: 1, item_id: "ws_fixture" },
    { type: "response.web_search_call.completed", sequence_number: 11, output_index: 1, item_id: "ws_fixture" },
    { type: "response.output_item.done", sequence_number: 12, output_index: 1, item: webDone },
    { type: "response.output_item.added", sequence_number: 13, output_index: 2, item: reusedReasoningAdded },
    { type: "response.output_item.done", sequence_number: 14, output_index: 2, item: reusedReasoningDone },
    { type: "response.output_item.added", sequence_number: 15, output_index: 3, item: { id: "msg_search_reused", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 16, output_index: 3, item_id: "msg_search_reused", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 17, output_index: 3, item_id: "msg_search_reused", content_index: 0, delta: "O" },
    { type: "response.output_item.added", sequence_number: 18, output_index: 4, item: reusedReasoningAdded },
    { type: "response.output_item.done", sequence_number: 19, output_index: 4, item: reusedReasoningDoneAgain },
    { type: "response.output_text.delta", sequence_number: 20, output_index: 3, item_id: "msg_search_reused", content_index: 0, delta: "K" },
    { type: "response.output_text.done", sequence_number: 21, output_index: 3, item_id: "msg_search_reused", content_index: 0, text: "OK" },
    { type: "response.content_part.done", sequence_number: 22, output_index: 3, item_id: "msg_search_reused", content_index: 0, part: { type: "output_text", text: "OK", annotations: [] } },
    { type: "response.output_item.done", sequence_number: 23, output_index: 3, item: messageDone },
    {
      type: "response.completed",
      sequence_number: 24,
      response: {
        status: "completed",
        output: [initialReasoningDone, webDone, reusedReasoningDone, messageDone, reusedReasoningDoneAgain],
        server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 },
        usage: { input_tokens: 8, output_tokens: 3 },
      },
    },
  ]

  const chunks = decodeResponsesEvents(events, {
    functionNames: [],
    serverTools: ["web_search"],
  })
  assert.equal(chunks.some((chunk) => chunk.type.includes("tool-call")), false)
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })
  assert.equal("replayState" in chunks.at(-1), false)
})

test("reasoning item id reuse remains strict and Search-backed", () => {
  const searchReceipt = { functionNames: [], serverTools: ["web_search"] }
  const unclosed = createReasoningDecoder("rs_reuse_unclosed", searchReceipt)
  unclosed.push({ type: "response.output_item.added", sequence_number: 3, output_index: 1, item: webSearchItem("in_progress", "", []) })
  unclosed.push({ type: "response.web_search_call.in_progress", sequence_number: 4, output_index: 1, item_id: "ws_fixture" })
  unclosed.push({ type: "response.web_search_call.searching", sequence_number: 5, output_index: 1, item_id: "ws_fixture" })
  unclosed.push({ type: "response.web_search_call.completed", sequence_number: 6, output_index: 1, item_id: "ws_fixture" })
  unclosed.push({ type: "response.output_item.done", sequence_number: 7, output_index: 1, item: webSearchItem("completed", "xAI", []) })
  assert.throws(() => unclosed.push({
    type: "response.output_item.added",
    sequence_number: 8,
    output_index: 2,
    item: { id: "rs_reuse_unclosed", type: "reasoning", status: "in_progress", summary: [] },
  }), { name: "InvalidResponsesStreamError" })

  const withoutSearch = createReasoningDecoder("rs_reuse_without_search")
  closeSummaryReasoning(withoutSearch, "rs_reuse_without_search")
  assert.throws(() => withoutSearch.push({
    type: "response.output_item.added",
    sequence_number: 8,
    output_index: 1,
    item: { id: "rs_reuse_without_search", type: "reasoning", status: "in_progress", summary: [] },
  }), { name: "InvalidResponsesStreamError" })

  const withContent = createReasoningDecoder("rs_reuse_content", searchReceipt)
  closeSummaryReasoning(withContent, "rs_reuse_content")
  closeWebSearch(withContent)
  assert.throws(() => withContent.push({
    type: "response.output_item.added",
    sequence_number: 13,
    output_index: 2,
    item: {
      id: "rs_reuse_content",
      type: "reasoning",
      status: "in_progress",
      summary: [],
      content: [],
    },
  }), { name: "InvalidResponsesStreamError" })

  const withSummaryLifecycle = createReasoningDecoder("rs_reuse_summary", searchReceipt)
  closeSummaryReasoning(withSummaryLifecycle, "rs_reuse_summary")
  closeWebSearch(withSummaryLifecycle)
  withSummaryLifecycle.push({
    type: "response.output_item.added",
    sequence_number: 13,
    output_index: 2,
    item: { id: "rs_reuse_summary", type: "reasoning", status: "in_progress", summary: [] },
  })
  assert.throws(() => withSummaryLifecycle.push({
    type: "response.reasoning_summary_part.added",
    sequence_number: 14,
    output_index: 2,
    item_id: "rs_reuse_summary",
    summary_index: 0,
    part: { type: "summary_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })

  const crossType = createReasoningDecoder("rs_reuse_cross_type", searchReceipt)
  closeSummaryReasoning(crossType, "rs_reuse_cross_type")
  closeWebSearch(crossType)
  assert.throws(() => crossType.push({
    type: "response.output_item.added",
    sequence_number: 13,
    output_index: 2,
    item: { id: "rs_reuse_cross_type", type: "message", role: "assistant", status: "in_progress", content: [] },
  }), { name: "InvalidResponsesStreamError" })

  const nonemptySummary = createReasoningDecoder("rs_reuse_nonempty", searchReceipt)
  closeSummaryReasoning(nonemptySummary, "rs_reuse_nonempty")
  closeWebSearch(nonemptySummary)
  assert.throws(() => nonemptySummary.push({
    type: "response.output_item.added",
    sequence_number: 13,
    output_index: 2,
    item: { id: "rs_reuse_nonempty", type: "reasoning", status: "in_progress", summary: [{ type: "summary_text", text: "visible" }] },
  }), { name: "InvalidResponsesStreamError" })

  let addedSummaryGetterCalls = 0
  const accessorAdded = {
    id: "rs_reuse_added_accessor",
    type: "reasoning",
    status: "in_progress",
  }
  Object.defineProperty(accessorAdded, "summary", {
    enumerable: true,
    get() {
      addedSummaryGetterCalls += 1
      return []
    },
  })
  const withAddedAccessor = createReasoningDecoder("rs_reuse_added_accessor", searchReceipt)
  closeSummaryReasoning(withAddedAccessor, "rs_reuse_added_accessor")
  closeWebSearch(withAddedAccessor)
  assert.throws(() => withAddedAccessor.push({
    type: "response.output_item.added",
    sequence_number: 13,
    output_index: 2,
    item: accessorAdded,
  }), { name: "InvalidResponsesStreamError" })
  assert.equal(addedSummaryGetterCalls, 0)

  const withRawLifecycle = createOpenReusedReasoning("rs_reuse_raw")
  assert.throws(() => withRawLifecycle.push({
    type: "response.content_part.added",
    sequence_number: 14,
    output_index: 2,
    item_id: "rs_reuse_raw",
    content_index: 0,
    part: { type: "reasoning_text", text: "" },
  }), { name: "InvalidResponsesStreamError" })
})

test("X Search also proves consecutive closed empty reasoning-id reuse", () => {
  const reasoningId = "rs_x_reused"
  const initialReasoningDone = {
    id: reasoningId,
    type: "reasoning",
    status: "completed",
    encrypted_content: "sealed-x-summary",
    summary: [{ type: "summary_text", text: "X reasoning." }],
  }
  const reusedAdded = { id: reasoningId, type: "reasoning", status: "in_progress", summary: [] }
  const reusedDone = { ...reusedAdded, status: "completed", encrypted_content: "sealed-x-empty" }
  const reusedDoneAgain = { ...reusedAdded, status: "completed", encrypted_content: "sealed-x-empty-again" }
  const input = '{"query":"xAI"}'
  const xDone = xSearchItem("completed", input)
  const messageDone = {
    id: "msg_x_reused",
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: "OK", annotations: [] }],
  }
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: reasoningId, type: "reasoning", status: "in_progress", summary: [] } },
    { type: "response.reasoning_summary_part.added", sequence_number: 3, output_index: 0, item_id: reasoningId, summary_index: 0, part: { type: "summary_text", text: "" } },
    { type: "response.reasoning_summary_text.delta", sequence_number: 4, output_index: 0, item_id: reasoningId, summary_index: 0, delta: "X reasoning." },
    { type: "response.reasoning_summary_text.done", sequence_number: 5, output_index: 0, item_id: reasoningId, summary_index: 0, text: "X reasoning." },
    { type: "response.reasoning_summary_part.done", sequence_number: 6, output_index: 0, item_id: reasoningId, summary_index: 0, part: { type: "summary_text", text: "X reasoning." } },
    { type: "response.output_item.done", sequence_number: 7, output_index: 0, item: initialReasoningDone },
    { type: "response.output_item.added", sequence_number: 8, output_index: 1, item: xSearchItem("in_progress", "") },
    { type: "response.custom_tool_call_input.delta", sequence_number: 9, output_index: 1, item_id: "x_fixture", delta: input },
    { type: "response.custom_tool_call_input.done", sequence_number: 10, output_index: 1, item_id: "x_fixture", input },
    { type: "response.output_item.done", sequence_number: 11, output_index: 1, item: xDone },
    { type: "response.output_item.added", sequence_number: 12, output_index: 2, item: reusedAdded },
    { type: "response.output_item.done", sequence_number: 13, output_index: 2, item: reusedDone },
    { type: "response.output_item.added", sequence_number: 14, output_index: 3, item: reusedAdded },
    { type: "response.output_item.done", sequence_number: 15, output_index: 3, item: reusedDoneAgain },
    { type: "response.output_item.added", sequence_number: 16, output_index: 4, item: { id: "msg_x_reused", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 17, output_index: 4, item_id: "msg_x_reused", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 18, output_index: 4, item_id: "msg_x_reused", content_index: 0, delta: "OK" },
    { type: "response.output_text.done", sequence_number: 19, output_index: 4, item_id: "msg_x_reused", content_index: 0, text: "OK" },
    { type: "response.content_part.done", sequence_number: 20, output_index: 4, item_id: "msg_x_reused", content_index: 0, part: { type: "output_text", text: "OK", annotations: [] } },
    { type: "response.output_item.done", sequence_number: 21, output_index: 4, item: messageDone },
    {
      type: "response.completed",
      sequence_number: 22,
      response: {
        status: "completed",
        output: [initialReasoningDone, xDone, reusedDone, reusedDoneAgain, messageDone],
        server_side_tool_usage: { SERVER_SIDE_TOOL_X_SEARCH: 1 },
        usage: { input_tokens: 8, output_tokens: 3 },
      },
    },
  ]

  const chunks = decodeResponsesEvents(events, { functionNames: [], serverTools: ["x_search"] })
  assert.equal(chunks.some((chunk) => chunk.type.includes("tool-call")), false)
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })
  assert.equal("replayState" in chunks.at(-1), false)
})

test("reused reasoning terminal snapshots and incomplete responses fail closed", () => {
  const terminalCases = [
    { label: "visible summary", patch: { summary: [{ type: "summary_text", text: "visible" }] } },
    { label: "visible raw content", patch: { content: [{ type: "reasoning_text", text: "visible" }] } },
    { label: "unknown key", patch: { future_field: true } },
    { label: "empty encrypted content", patch: { encrypted_content: "" } },
  ]
  for (const { label, patch } of terminalCases) {
    const decoder = createOpenReusedReasoning(`rs_reuse_terminal_${label.replaceAll(" ", "_")}`)
    assert.throws(() => decoder.push({
      type: "response.output_item.done",
      sequence_number: 14,
      output_index: 2,
      item: {
        id: `rs_reuse_terminal_${label.replaceAll(" ", "_")}`,
        type: "reasoning",
        status: "completed",
        summary: [],
        ...patch,
      },
    }), { name: "InvalidResponsesStreamError" }, label)
  }

  let summaryGetterCalls = 0
  const accessorTerminal = {
    id: "rs_reuse_terminal_accessor",
    type: "reasoning",
    status: "completed",
  }
  Object.defineProperty(accessorTerminal, "summary", {
    enumerable: true,
    get() {
      summaryGetterCalls += 1
      return []
    },
  })
  const accessorDecoder = createOpenReusedReasoning("rs_reuse_terminal_accessor")
  assert.throws(() => accessorDecoder.push({
    type: "response.output_item.done",
    sequence_number: 14,
    output_index: 2,
    item: accessorTerminal,
  }), { name: "InvalidResponsesStreamError" })
  assert.equal(summaryGetterCalls, 0)

  const incomplete = createOpenReusedReasoning("rs_reuse_incomplete")
  assert.throws(() => incomplete.push({
    type: "response.incomplete",
    sequence_number: 14,
    response: {
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      usage: { input_tokens: 8, output_tokens: 2 },
    },
  }), { name: "InvalidResponsesStreamError" })
})

test("a closed reused reasoning lifecycle permits a later max-token response", () => {
  const itemId = "rs_reuse_closed_before_incomplete"
  const decoder = createOpenReusedReasoning(itemId)
  decoder.push({
    type: "response.output_item.done",
    sequence_number: 14,
    output_index: 2,
    item: {
      id: itemId,
      type: "reasoning",
      status: "completed",
      summary: [],
    },
  })
  decoder.push({
    type: "response.output_item.added",
    sequence_number: 15,
    output_index: 3,
    item: {
      id: "msg_after_closed_reuse",
      type: "message",
      role: "assistant",
      status: "in_progress",
      content: [],
    },
  })
  decoder.push({
    type: "response.content_part.added",
    sequence_number: 16,
    output_index: 3,
    item_id: "msg_after_closed_reuse",
    content_index: 0,
    part: { type: "output_text", text: "", annotations: [] },
  })
  decoder.push({
    type: "response.output_text.delta",
    sequence_number: 17,
    output_index: 3,
    item_id: "msg_after_closed_reuse",
    content_index: 0,
    delta: "Partial",
  })
  assert.deepEqual(decoder.push({
    type: "response.incomplete",
    sequence_number: 18,
    response: {
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      usage: { input_tokens: 8, output_tokens: 2 },
    },
  }).slice(-2), [
    { type: "usage", usage: { inputTokens: 8, outputTokens: 2 } },
    { type: "finish", reason: { kind: "max-tokens" } },
  ])
  decoder.finish()
})

test("X Search custom tool input lifecycle emits no Harness tool-call chunks", () => {
  const input = '{"query":"xAI"}'
  const text = "X result"
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: xSearchItem("in_progress", "") },
    { type: "response.custom_tool_call_input.delta", sequence_number: 3, output_index: 0, item_id: "x_fixture", delta: '{"query":' },
    { type: "response.custom_tool_call_input.delta", sequence_number: 4, output_index: 0, item_id: "x_fixture", delta: '"xAI"}' },
    { type: "response.custom_tool_call_input.done", sequence_number: 5, output_index: 0, item_id: "x_fixture", input },
    { type: "response.output_item.done", sequence_number: 6, output_index: 0, item: xSearchItem("completed", input) },
    { type: "response.output_item.added", sequence_number: 7, output_index: 1, item: { id: "msg_x", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 8, output_index: 1, item_id: "msg_x", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 9, output_index: 1, item_id: "msg_x", content_index: 0, delta: text },
    { type: "response.output_text.done", sequence_number: 10, output_index: 1, item_id: "msg_x", content_index: 0, text },
    { type: "response.content_part.done", sequence_number: 11, output_index: 1, item_id: "msg_x", content_index: 0, part: { type: "output_text", text, annotations: [] } },
    { type: "response.output_item.done", sequence_number: 12, output_index: 1, item: { id: "msg_x", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] } },
    { type: "response.completed", sequence_number: 13, response: { status: "completed", server_side_tool_usage: { SERVER_SIDE_TOOL_X_SEARCH: 1 }, usage: { input_tokens: 8, output_tokens: 2 } } },
  ]

  const chunks = decodeResponsesEvents(events, {
    functionNames: [],
    serverTools: ["x_search"],
  })
  assert.deepEqual(chunks.map((chunk) => chunk.type), [
    "block-start",
    "text-delta",
    "block-end",
    "usage",
    "finish",
  ])
  assert.equal(chunks.some((chunk) => chunk.type.includes("tool-call")), false)
})

test("disabled, unknown, out-of-order, duplicate, and unfinished server tools fail closed", () => {
  const disabled = createRunningDecoder(EMPTY_RECEIPT)
  assert.throws(() => disabled.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: webSearchItem("in_progress", "", []),
  }), { name: "InvalidResponsesStreamError" })

  const unknownX = createRunningDecoder({ functionNames: [], serverTools: ["x_search"] })
  assert.throws(() => unknownX.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: { ...xSearchItem("in_progress", ""), name: "x_unknown_search" },
  }), { name: "InvalidResponsesStreamError" })

  const outOfOrder = createRunningDecoder({ functionNames: [], serverTools: ["web_search"] })
  outOfOrder.push({ type: "response.output_item.added", sequence_number: 2, output_index: 0, item: webSearchItem("in_progress", "", []) })
  assert.throws(() => outOfOrder.push({
    type: "response.web_search_call.searching",
    sequence_number: 3,
    output_index: 0,
    item_id: "ws_fixture",
  }), { name: "InvalidResponsesStreamError" })

  const duplicate = createRunningDecoder({ functionNames: [], serverTools: ["web_search"] })
  duplicate.push({ type: "response.output_item.added", sequence_number: 2, output_index: 0, item: webSearchItem("in_progress", "", []) })
  duplicate.push({ type: "response.web_search_call.in_progress", sequence_number: 3, output_index: 0, item_id: "ws_fixture" })
  assert.throws(() => duplicate.push({
    type: "response.web_search_call.in_progress",
    sequence_number: 4,
    output_index: 0,
    item_id: "ws_fixture",
  }), { name: "InvalidResponsesStreamError" })

  const unfinished = createRunningDecoder({ functionNames: [], serverTools: ["x_search"] })
  unfinished.push({ type: "response.output_item.added", sequence_number: 2, output_index: 0, item: xSearchItem("in_progress", "") })
  assert.throws(() => unfinished.push({
    type: "response.output_item.done",
    sequence_number: 3,
    output_index: 0,
    item: xSearchItem("completed", ""),
  }), { name: "InvalidResponsesStreamError" })

  const missingDelta = createRunningDecoder({ functionNames: [], serverTools: ["x_search"] })
  missingDelta.push({ type: "response.output_item.added", sequence_number: 2, output_index: 0, item: xSearchItem("in_progress", "") })
  assert.throws(() => missingDelta.push({
    type: "response.custom_tool_call_input.done",
    sequence_number: 3,
    output_index: 0,
    item_id: "x_fixture",
    input: "",
  }), { name: "InvalidResponsesStreamError" })

  const reusedIndex = createRunningDecoder({ functionNames: [], serverTools: ["web_search"] })
  reusedIndex.push({ type: "response.output_item.added", sequence_number: 2, output_index: 0, item: webSearchItem("in_progress", "", []) })
  reusedIndex.push({ type: "response.web_search_call.in_progress", sequence_number: 3, output_index: 0, item_id: "ws_fixture" })
  reusedIndex.push({ type: "response.web_search_call.searching", sequence_number: 4, output_index: 0, item_id: "ws_fixture" })
  reusedIndex.push({ type: "response.web_search_call.completed", sequence_number: 5, output_index: 0, item_id: "ws_fixture" })
  reusedIndex.push({ type: "response.output_item.done", sequence_number: 6, output_index: 0, item: webSearchItem("completed", "xAI", []) })
  assert.throws(() => reusedIndex.push({
    type: "response.output_item.added",
    sequence_number: 7,
    output_index: 0,
    item: { id: "msg_reused", type: "message", role: "assistant", status: "in_progress", content: [] },
  }), { name: "InvalidResponsesStreamError" })
})

test("a completed response containing only a closed server tool is rejected", () => {
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: webSearchItem("in_progress", "", []) },
    { type: "response.web_search_call.in_progress", sequence_number: 3, output_index: 0, item_id: "ws_fixture" },
    { type: "response.web_search_call.searching", sequence_number: 4, output_index: 0, item_id: "ws_fixture" },
    { type: "response.web_search_call.completed", sequence_number: 5, output_index: 0, item_id: "ws_fixture" },
    { type: "response.output_item.done", sequence_number: 6, output_index: 0, item: webSearchItem("completed", "xAI", []) },
    { type: "response.completed", sequence_number: 7, response: { status: "completed", usage: { input_tokens: 2, output_tokens: 0 } } },
  ]
  assert.throws(() => decodeResponsesEvents(events, {
    functionNames: [],
    serverTools: ["web_search"],
  }), { name: "InvalidResponsesStreamError" })

  const emptyMessageEvents = [
    ...events.slice(0, -1),
    { type: "response.output_item.added", sequence_number: 7, output_index: 1, item: { id: "msg_empty", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 8, output_index: 1, item_id: "msg_empty", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.done", sequence_number: 9, output_index: 1, item_id: "msg_empty", content_index: 0, text: "" },
    { type: "response.content_part.done", sequence_number: 10, output_index: 1, item_id: "msg_empty", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_item.done", sequence_number: 11, output_index: 1, item: { id: "msg_empty", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "", annotations: [] }] } },
    { type: "response.completed", sequence_number: 12, response: { status: "completed", usage: { input_tokens: 2, output_tokens: 0 } } },
  ]
  assert.throws(() => decodeResponsesEvents(emptyMessageEvents, {
    functionNames: [],
    serverTools: ["web_search"],
  }), { name: "InvalidResponsesStreamError" })
})

test("terminal Search evidence requires a matching completed server-tool lifecycle", () => {
  const terminalOutput = minimalTextEvents({
    text: "OK",
    completedResponse: {
      status: "completed",
      output: [webSearchItem("completed", "xAI", [])],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  })
  assert.throws(() => decodeResponsesEvents(terminalOutput, {
    functionNames: [],
    serverTools: ["web_search"],
  }), { name: "InvalidResponsesStreamError" })

  const terminalUsage = minimalTextEvents({
    text: "OK",
    completedResponse: {
      status: "completed",
      server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 },
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  })
  assert.throws(() => decodeResponsesEvents(terminalUsage, {
    functionNames: [],
    serverTools: ["web_search"],
  }), { name: "InvalidResponsesStreamError" })

  const structuredCitation = minimalTextEvents({
    text: "OK",
    annotation: citationAnnotation({ endIndex: 2 }),
  })
  assert.throws(() => decodeResponsesEvents(structuredCitation, {
    functionNames: [],
    serverTools: ["web_search"],
  }), { name: "InvalidResponsesStreamError" })
})

test("terminal response output rejects unknown items and message content parts", () => {
  const unknownItem = minimalTextEvents({
    text: "OK",
    completedResponse: {
      status: "completed",
      output: [{ id: "future", type: "future_search_call", status: "completed" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  })
  assert.throws(() => decodeResponsesEvents(unknownItem, EMPTY_RECEIPT), {
    name: "InvalidResponsesStreamError",
  })

  const unknownContentPart = minimalTextEvents({
    text: "OK",
    completedResponse: {
      status: "completed",
      output: [{
        id: "message_future",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "future_citation", url: "https://example.invalid" }],
      }],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  })
  assert.throws(() => decodeResponsesEvents(unknownContentPart, EMPTY_RECEIPT), {
    name: "InvalidResponsesStreamError",
  })
})

test("streamed citation annotations are capped at 1024", () => {
  const decoder = createRunningDecoder({ functionNames: [], serverTools: ["web_search"] })
  decoder.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: { id: "msg_many_annotations", type: "message", role: "assistant", status: "in_progress", content: [] },
  })
  decoder.push({
    type: "response.content_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "msg_many_annotations",
    content_index: 0,
    part: { type: "output_text", text: "", annotations: [] },
  })
  decoder.push({
    type: "response.output_text.delta",
    sequence_number: 4,
    output_index: 0,
    item_id: "msg_many_annotations",
    content_index: 0,
    delta: "A",
  })
  for (let annotationIndex = 0; annotationIndex < 1024; annotationIndex += 1) {
    decoder.push({
      type: "response.output_text.annotation.added",
      sequence_number: 5 + annotationIndex,
      output_index: 0,
      item_id: "msg_many_annotations",
      content_index: 0,
      annotation_index: annotationIndex,
      annotation: citationAnnotation({ endIndex: 1 }),
    })
  }
  assert.throws(() => decoder.push({
    type: "response.output_text.annotation.added",
    sequence_number: 1029,
    output_index: 0,
    item_id: "msg_many_annotations",
    content_index: 0,
    annotation_index: 1024,
    annotation: citationAnnotation({ endIndex: 1 }),
  }), { name: "InvalidResponsesStreamError" })
})

test("the streamed citation annotation cap applies across all text blocks", () => {
  const decoder = createRunningDecoder({ functionNames: [], serverTools: ["web_search"] })
  let sequenceNumber = 2
  const addTextBlock = (outputIndex, itemId) => {
    decoder.push({
      type: "response.output_item.added",
      sequence_number: sequenceNumber++,
      output_index: outputIndex,
      item: { id: itemId, type: "message", role: "assistant", status: "in_progress", content: [] },
    })
    decoder.push({
      type: "response.content_part.added",
      sequence_number: sequenceNumber++,
      output_index: outputIndex,
      item_id: itemId,
      content_index: 0,
      part: { type: "output_text", text: "", annotations: [] },
    })
    decoder.push({
      type: "response.output_text.delta",
      sequence_number: sequenceNumber++,
      output_index: outputIndex,
      item_id: itemId,
      content_index: 0,
      delta: "A",
    })
  }
  const addAnnotations = (outputIndex, itemId, count) => {
    for (let annotationIndex = 0; annotationIndex < count; annotationIndex += 1) {
      decoder.push({
        type: "response.output_text.annotation.added",
        sequence_number: sequenceNumber++,
        output_index: outputIndex,
        item_id: itemId,
        content_index: 0,
        annotation_index: annotationIndex,
        annotation: citationAnnotation({ endIndex: 1 }),
      })
    }
  }

  addTextBlock(0, "msg_annotations_a")
  addAnnotations(0, "msg_annotations_a", 512)
  addTextBlock(1, "msg_annotations_b")
  addAnnotations(1, "msg_annotations_b", 512)
  assert.throws(() => decoder.push({
    type: "response.output_text.annotation.added",
    sequence_number: sequenceNumber,
    output_index: 1,
    item_id: "msg_annotations_b",
    content_index: 0,
    annotation_index: 512,
    annotation: citationAnnotation({ endIndex: 1 }),
  }), { name: "InvalidResponsesStreamError" })
})

test("streamed citation annotations cannot arrive after output text is done", () => {
  const decoder = createRunningDecoder({ functionNames: [], serverTools: ["web_search"] })
  decoder.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: { id: "msg_late_annotation", type: "message", role: "assistant", status: "in_progress", content: [] },
  })
  decoder.push({
    type: "response.content_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: "msg_late_annotation",
    content_index: 0,
    part: { type: "output_text", text: "", annotations: [] },
  })
  decoder.push({
    type: "response.output_text.delta",
    sequence_number: 4,
    output_index: 0,
    item_id: "msg_late_annotation",
    content_index: 0,
    delta: "OK",
  })
  decoder.push({
    type: "response.output_text.done",
    sequence_number: 5,
    output_index: 0,
    item_id: "msg_late_annotation",
    content_index: 0,
    text: "OK",
  })

  assert.throws(() => decoder.push({
    type: "response.output_text.annotation.added",
    sequence_number: 6,
    output_index: 0,
    item_id: "msg_late_annotation",
    content_index: 0,
    annotation_index: 0,
    annotation: citationAnnotation({ endIndex: 2 }),
  }), { name: "InvalidResponsesStreamError" })
})

test("malformed content annotations and top-level citations are rejected", () => {
  const malformedAnnotation = citationAnnotation({ endIndex: 2 })
  delete malformedAnnotation.title
  const annotationEvents = minimalTextEvents({
    text: "OK",
    annotation: malformedAnnotation,
  })
  assert.throws(() => decodeResponsesEvents(annotationEvents, EMPTY_RECEIPT), {
    name: "InvalidResponsesStreamError",
  })

  const citationEvents = minimalTextEvents({
    text: "OK",
    completedResponse: {
      status: "completed",
      citations: [42],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  })
  assert.throws(() => decodeResponsesEvents(citationEvents, EMPTY_RECEIPT), {
    name: "InvalidResponsesStreamError",
  })
})

function createRunningDecoder(receipt) {
  const decoder = createResponsesEventDecoder(receipt)
  decoder.push({
    type: "response.created",
    sequence_number: 0,
    response: { status: "in_progress" },
  })
  decoder.push({
    type: "response.in_progress",
    sequence_number: 1,
    response: { status: "in_progress" },
  })
  return decoder
}

function createReasoningDecoder(itemId, receipt = EMPTY_RECEIPT) {
  const decoder = createRunningDecoder(receipt)
  decoder.push({
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: { id: itemId, type: "reasoning", status: "in_progress", summary: [] },
  })
  return decoder
}

function openRawReasoning(decoder, itemId) {
  decoder.push({
    type: "response.content_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: itemId,
    content_index: 0,
    part: { type: "reasoning_text", text: "" },
  })
}

function closeRawReasoningPart(decoder, itemId) {
  const text = "Raw reasoning."
  openRawReasoning(decoder, itemId)
  decoder.push({
    type: "response.reasoning_text.delta",
    sequence_number: 4,
    output_index: 0,
    item_id: itemId,
    content_index: 0,
    delta: text,
  })
  decoder.push({
    type: "response.reasoning_text.done",
    sequence_number: 5,
    output_index: 0,
    item_id: itemId,
    content_index: 0,
    text,
  })
  decoder.push({
    type: "response.content_part.done",
    sequence_number: 6,
    output_index: 0,
    item_id: itemId,
    content_index: 0,
    part: { type: "reasoning_text", text },
  })
}

function closeWebSearch(decoder) {
  decoder.push({
    type: "response.output_item.added",
    sequence_number: 8,
    output_index: 1,
    item: webSearchItem("in_progress", "", []),
  })
  decoder.push({
    type: "response.web_search_call.in_progress",
    sequence_number: 9,
    output_index: 1,
    item_id: "ws_fixture",
  })
  decoder.push({
    type: "response.web_search_call.searching",
    sequence_number: 10,
    output_index: 1,
    item_id: "ws_fixture",
  })
  decoder.push({
    type: "response.web_search_call.completed",
    sequence_number: 11,
    output_index: 1,
    item_id: "ws_fixture",
  })
  decoder.push({
    type: "response.output_item.done",
    sequence_number: 12,
    output_index: 1,
    item: webSearchItem("completed", "xAI", []),
  })
}

function createOpenReusedReasoning(itemId) {
  const decoder = createReasoningDecoder(itemId, {
    functionNames: [],
    serverTools: ["web_search"],
  })
  closeSummaryReasoning(decoder, itemId)
  closeWebSearch(decoder)
  decoder.push({
    type: "response.output_item.added",
    sequence_number: 13,
    output_index: 2,
    item: { id: itemId, type: "reasoning", status: "in_progress", summary: [] },
  })
  return decoder
}

function closeSummaryReasoning(decoder, itemId) {
  const text = "Reasoning."
  decoder.push({
    type: "response.reasoning_summary_part.added",
    sequence_number: 3,
    output_index: 0,
    item_id: itemId,
    summary_index: 0,
    part: { type: "summary_text", text: "" },
  })
  decoder.push({
    type: "response.reasoning_summary_text.delta",
    sequence_number: 4,
    output_index: 0,
    item_id: itemId,
    summary_index: 0,
    delta: text,
  })
  decoder.push({
    type: "response.reasoning_summary_text.done",
    sequence_number: 5,
    output_index: 0,
    item_id: itemId,
    summary_index: 0,
    text,
  })
  decoder.push({
    type: "response.reasoning_summary_part.done",
    sequence_number: 6,
    output_index: 0,
    item_id: itemId,
    summary_index: 0,
    part: { type: "summary_text", text },
  })
  decoder.push({
    type: "response.output_item.done",
    sequence_number: 7,
    output_index: 0,
    item: {
      id: itemId,
      type: "reasoning",
      status: "completed",
      encrypted_content: `sealed-${itemId}`,
      summary: [{ type: "summary_text", text }],
    },
  })
}

function functionCallItem(id, callId) {
  return {
    id,
    type: "function_call",
    status: "in_progress",
    call_id: callId,
    name: "fixture_tool",
    arguments: "",
  }
}

function webSearchItem(status, query, sources) {
  return {
    id: "ws_fixture",
    type: "web_search_call",
    status,
    action: { type: "search", query, sources },
  }
}

function webSearchItemWithAction(status, action) {
  return {
    id: "ws_fixture",
    type: "web_search_call",
    status,
    action,
  }
}

function webSearchCompletionEvents(streamedAction, terminalAction = streamedAction) {
  const streamedDone = webSearchItemWithAction("completed", streamedAction)
  const terminalDone = webSearchItemWithAction("completed", terminalAction)
  const messageDone = {
    id: "msg_web_action",
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: "OK", annotations: [] }],
  }
  return [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: webSearchItem("in_progress", "", []) },
    { type: "response.web_search_call.in_progress", sequence_number: 3, output_index: 0, item_id: "ws_fixture" },
    { type: "response.web_search_call.searching", sequence_number: 4, output_index: 0, item_id: "ws_fixture" },
    { type: "response.web_search_call.completed", sequence_number: 5, output_index: 0, item_id: "ws_fixture" },
    { type: "response.output_item.done", sequence_number: 6, output_index: 0, item: streamedDone },
    { type: "response.output_item.added", sequence_number: 7, output_index: 1, item: { id: "msg_web_action", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 8, output_index: 1, item_id: "msg_web_action", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 9, output_index: 1, item_id: "msg_web_action", content_index: 0, delta: "OK" },
    { type: "response.output_text.done", sequence_number: 10, output_index: 1, item_id: "msg_web_action", content_index: 0, text: "OK" },
    { type: "response.content_part.done", sequence_number: 11, output_index: 1, item_id: "msg_web_action", content_index: 0, part: { type: "output_text", text: "OK", annotations: [] } },
    { type: "response.output_item.done", sequence_number: 12, output_index: 1, item: messageDone },
    {
      type: "response.completed",
      sequence_number: 13,
      response: {
        status: "completed",
        output: [terminalDone, messageDone],
        server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 },
        usage: { input_tokens: 4, output_tokens: 2 },
      },
    },
  ]
}

function xSearchItem(status, input) {
  return {
    id: "x_fixture",
    type: "custom_tool_call",
    status,
    call_id: "x_call_fixture",
    name: "x_keyword_search",
    input,
  }
}

function xSearchCompletionEvents() {
  const input = '{"query":"xAI"}'
  const text = "X result"
  const xDone = xSearchItem("completed", input)
  const messageDone = {
    id: "msg_x",
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  }
  return [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: xSearchItem("in_progress", "") },
    { type: "response.custom_tool_call_input.delta", sequence_number: 3, output_index: 0, item_id: "x_fixture", delta: '{"query":' },
    { type: "response.custom_tool_call_input.delta", sequence_number: 4, output_index: 0, item_id: "x_fixture", delta: '"xAI"}' },
    { type: "response.custom_tool_call_input.done", sequence_number: 5, output_index: 0, item_id: "x_fixture", input },
    { type: "response.output_item.done", sequence_number: 6, output_index: 0, item: xDone },
    { type: "response.output_item.added", sequence_number: 7, output_index: 1, item: { id: "msg_x", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 8, output_index: 1, item_id: "msg_x", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 9, output_index: 1, item_id: "msg_x", content_index: 0, delta: text },
    { type: "response.output_text.done", sequence_number: 10, output_index: 1, item_id: "msg_x", content_index: 0, text },
    { type: "response.content_part.done", sequence_number: 11, output_index: 1, item_id: "msg_x", content_index: 0, part: { type: "output_text", text, annotations: [] } },
    { type: "response.output_item.done", sequence_number: 12, output_index: 1, item: messageDone },
    {
      type: "response.completed",
      sequence_number: 13,
      response: {
        status: "completed",
        output: [xDone, messageDone],
        server_side_tool_usage: { SERVER_SIDE_TOOL_X_SEARCH: 1 },
        usage: { input_tokens: 8, output_tokens: 2 },
      },
    },
  ]
}

function installSelfReplacingAccessor(target, key, value, onGet = () => {}) {
  let calls = 0
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      calls += 1
      onGet()
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      })
      return value
    },
  })
  return () => calls
}

function citationAnnotation({ endIndex }) {
  return {
    type: "url_citation",
    url: "https://example.com/source",
    title: "Example source",
    start_index: 0,
    end_index: endIndex,
  }
}

function minimalTextEvents({ text, annotation, completedResponse } = {}) {
  const annotations = annotation === undefined ? [] : [annotation]
  const events = [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "msg_minimal", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 3, output_index: 0, item_id: "msg_minimal", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 4, output_index: 0, item_id: "msg_minimal", content_index: 0, delta: text },
  ]
  let sequence = 5
  if (annotation !== undefined) {
    events.push({
      type: "response.output_text.annotation.added",
      sequence_number: sequence,
      output_index: 0,
      item_id: "msg_minimal",
      content_index: 0,
      annotation_index: 0,
      annotation,
    })
    sequence += 1
  }
  events.push(
    { type: "response.output_text.done", sequence_number: sequence, output_index: 0, item_id: "msg_minimal", content_index: 0, text },
    { type: "response.content_part.done", sequence_number: sequence + 1, output_index: 0, item_id: "msg_minimal", content_index: 0, part: { type: "output_text", text, annotations } },
    { type: "response.output_item.done", sequence_number: sequence + 2, output_index: 0, item: { id: "msg_minimal", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations }] } },
    {
      type: "response.completed",
      sequence_number: sequence + 3,
      response: completedResponse ?? { status: "completed", usage: { input_tokens: 1, output_tokens: 1 } },
    },
  )
  return events
}

import assert from "node:assert/strict"
import test from "node:test"

import {
  UnsupportedResponsesRequestError,
  createResponsesRequestEncoder,
  encodeResponsesRequest,
} from "../../../src/internal/responses-request.mjs"

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

test("the complete text wire remains byte-identical to the 0.1.3 encoder", () => {
  const request = encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    stop: [],
    system: "Be concise.",
    messages: [
      {
        id: "user-1",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Hi" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        source: {
          kind: "model",
          provider: "grok",
          model: "grok-4.6",
          replayState: {
            response: { version: 1 },
            blocks: [
              { type: "reasoning", id: "rs_1", encryptedContent: "sealed" },
              null,
              null,
            ],
          },
        },
        content: [
          { type: "reasoning", text: "Brief." },
          { type: "text", text: "Calling." },
          { type: "tool-call", id: "call_1", name: "lookup", arguments: '{"q":"x"}' },
        ],
      },
      {
        id: "tool-1",
        role: "user",
        source: { kind: "tool", callId: "call_1" },
        content: [{
          type: "tool-result",
          toolCallId: "call_1",
          content: [{ type: "text", text: "Done" }],
          isError: false,
        }],
      },
    ],
    tools: [{
      name: "lookup",
      description: "Look up",
      parameters: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"],
      },
    }],
    reasoningEffort: "high",
    temperature: 0.2,
    maxTokens: 512,
  })

  assert.equal(JSON.stringify(request), String.raw`{"model":"grok-4.6","input":[{"role":"user","content":"Hi"},{"type":"reasoning","id":"rs_1","encrypted_content":"sealed","summary":[{"type":"summary_text","text":"Brief."}]},{"role":"assistant","content":"Calling."},{"type":"function_call","call_id":"call_1","name":"lookup","arguments":"{\"q\":\"x\"}"},{"type":"function_call_output","call_id":"call_1","output":"Done"}],"instructions":"Be concise.","tools":[{"type":"function","name":"lookup","description":"Look up","parameters":{"type":"object","properties":{"q":{"type":"string"}},"required":["q"]}}],"reasoning":{"effort":"high"},"temperature":0.2,"max_output_tokens":512,"include":["reasoning.encrypted_content"],"stream":true,"store":false}`)
})

test("text-only user and system reasoning stays private while visible text is preserved", () => {
  const request = encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [
      {
        id: "user-reasoning",
        role: "user",
        source: { kind: "user" },
        content: [
          { type: "text", text: "User " },
          { type: "reasoning", text: "Private user reasoning." },
          { type: "text", text: "visible." },
        ],
      },
      {
        id: "system-reasoning",
        role: "system",
        content: [
          { type: "text", text: "System " },
          { type: "reasoning", text: "Private system reasoning." },
          { type: "text", text: "visible." },
        ],
      },
    ],
  })

  assert.deepEqual(request.input, [
    { role: "user", content: "User visible." },
    { role: "system", content: "System visible." },
  ])
})

test("omitted reasoning still obeys the closed text schema", () => {
  const invalidValues = [undefined, null, 42, "x".repeat(8 * 1024 * 1024 + 1)]
  for (const role of ["user", "system"]) {
    for (const text of invalidValues) {
      assert.throws(() => encodeResponsesRequest({
        provider: "grok",
        model: "grok-4.6",
        messages: [{
          id: `${role}-invalid-reasoning`,
          role,
          source: role === "user" ? { kind: "user" } : undefined,
          content: [
            { type: "text", text: "Visible." },
            { type: "reasoning", text },
          ],
        }],
      }), { name: "UnsupportedResponsesRequestError" })
    }
  }
})

test("foreign tool call IDs are mapped consistently when Grok cannot accept their characters", () => {
  const arkCallId = "toolu_ark1_fixture|fc_fixture"
  const request = encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [
      {
        id: "msg_assistant",
        role: "assistant",
        source: { kind: "model", provider: "ark-code-latest", model: "ark-code-latest" },
        content: [{ type: "tool-call", id: arkCallId, name: "bash", arguments: "{}" }],
      },
      {
        id: "msg_tool",
        role: "user",
        source: { kind: "tool", callId: arkCallId },
        content: [{
          type: "tool-result",
          toolCallId: arkCallId,
          content: [{ type: "text", text: "ok" }],
          isError: false,
        }],
      },
    ],
  })

  assert.equal(request.input[0].type, "function_call")
  assert.match(request.input[0].call_id, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
  assert.notEqual(request.input[0].call_id, arkCallId)
  assert.deepEqual(request.input[1], {
    type: "function_call_output",
    call_id: request.input[0].call_id,
    output: "ok",
  })
})

test("foreign tool call ID mapping remains bounded and rejects empty or oversized identifiers", () => {
  for (const callId of ["", "x".repeat(1025)]) {
    assert.throws(() => encodeResponsesRequest({
      provider: "grok",
      model: "grok-4.6",
      messages: [{
        id: "msg_assistant",
        role: "assistant",
        source: { kind: "model", provider: "foreign", model: "foreign" },
        content: [{ type: "tool-call", id: callId, name: "fixture", arguments: "{}" }],
      }],
    }), UnsupportedResponsesRequestError)
  }
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

test("a raw reasoning replay envelope is not mislabeled as a summary", () => {
  const request = encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "assistant-raw",
      role: "assistant",
      source: {
        kind: "model",
        provider: "grok",
        model: "grok-4.6",
        replayState: {
          response: { version: 1 },
          blocks: [{
            type: "reasoning",
            id: "rs_raw",
            encryptedContent: "sealed-raw",
            textType: "reasoning_text",
          }],
        },
      },
      content: [{ type: "reasoning", text: "Raw reasoning." }],
    }],
  })

  assert.deepEqual(request.input, [{
    type: "reasoning",
    id: "rs_raw",
    encrypted_content: "sealed-raw",
    summary: [],
  }])
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

test("misaligned replay blocks are ignored before key enumeration", () => {
  let ownKeyReads = 0
  const blocks = new Proxy(new Array(20_001), {
    ownKeys(array) {
      ownKeyReads += 1
      return Reflect.ownKeys(array)
    },
  })

  const request = encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      role: "assistant",
      source: {
        kind: "model",
        provider: "grok",
        model: "grok-4.6",
        replayState: {
          response: { version: 1 },
          blocks,
        },
      },
      content: [
        { type: "reasoning", text: "Private summary." },
        { type: "text", text: "Visible answer." },
      ],
    }],
  })

  assert.deepEqual(request.input, [{ role: "assistant", content: "Visible answer." }])
  assert.equal(ownKeyReads, 0)
})

test("a prepared encoder keeps validated static state private and immutable", () => {
  const options = {
    provider: "grok",
    model: "grok-4.6",
    system: "Original system",
    reasoningEffort: "low",
    tools: [{
      name: "fixture",
      description: "Fixture tool",
      parameters: { type: "object", properties: {} },
    }],
    messages: [{
      id: "user-envelope",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Hello" }],
    }],
  }
  const encode = createResponsesRequestEncoder(options)
  options.model = "forged-model"
  options.system = "Forged system"

  const request = encode({
    messages: [{
      id: "user-transient",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Transient" }],
    }],
  })

  assert.equal(Object.isFrozen(encode), true)
  assert.equal(request.model, "grok-4.6")
  assert.equal(request.instructions, "Original system")
  assert.deepEqual(request.input, [{ role: "user", content: "Transient" }])
  assert.throws(() => { request.reasoning.effort = "xhigh" }, TypeError)
  assert.throws(() => { request.tools[0].name = "forged" }, TypeError)
  assert.throws(() => { request.tools[0].parameters.properties.injected = {} }, TypeError)

  const repeated = encode()
  assert.equal(repeated.reasoning.effort, "low")
  assert.equal(repeated.tools[0].name, "fixture")
  assert.deepEqual(repeated.tools[0].parameters, { type: "object", properties: {} })
})

test("caller-owned tools array methods cannot inject provider server tools", () => {
  const tools = []
  let mapCalls = 0
  tools.map = () => {
    mapCalls += 1
    return [{ type: "web_search" }]
  }

  assert.throws(() => encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-tools-array",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Hello" }],
    }],
    tools,
  }), UnsupportedResponsesRequestError)
  assert.equal(mapCalls, 0)
})

test("accessor-backed message fields cannot split validation from the text wire", () => {
  let roleReads = 0
  const message = {
    source: { kind: "user" },
    content: [{ type: "text", text: "Hello" }],
  }
  Object.defineProperty(message, "role", {
    enumerable: true,
    get() {
      roleReads += 1
      return roleReads === 1 ? "user" : "developer"
    },
  })

  assert.throws(() => encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [message],
  }), UnsupportedResponsesRequestError)
  assert.equal(roleReads, 0)
})

test("accessor-backed tool fields cannot change after validation", () => {
  let nameReads = 0
  const tool = {
    description: "Fixture tool",
    parameters: { type: "object", properties: {} },
  }
  Object.defineProperty(tool, "name", {
    enumerable: true,
    get() {
      nameReads += 1
      return nameReads === 1 ? "fixture" : "invalid name"
    },
  })

  assert.throws(() => encodeResponsesRequest({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Hello" }],
    }],
    tools: [tool],
  }), UnsupportedResponsesRequestError)
  assert.equal(nameReads, 0)
})

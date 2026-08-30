import assert from "node:assert/strict"
import test from "node:test"

import { Context } from "@deepseek-ai/cordis"
import LlmRuntime from "@deepseek-ai/dsh-llm"

import { createGrokAdapter } from "../../../src/internal/grok-adapter.mjs"
import { GrokTransportError } from "../../../src/internal/grok-transport.mjs"
import { mapLlmError } from "../../../src/internal/llm-error.mjs"

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

test("the prepared adapter compiles attachments before starting the frozen transport", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = {
    attachmentId: `sha256:${"b".repeat(64)}`,
    mediaType: "image/png",
    bytes: data.byteLength,
    width: 1,
    height: 1,
  }
  const order = []
  let resolveRead
  const read = new Promise((resolve) => { resolveRead = resolve })
  let capturedRequest
  const generation = {
    id: 1,
    transport: {
      async listModels() { return catalog },
      async *streamResponses(request) {
        order.push("transport")
        capturedRequest = request
        yield * completedResponseEvents()
      },
    },
  }
  const adapter = createGrokAdapter({
    getGeneration: () => generation,
    getAttachmentStore: () => ({
      async readImageRequest(ref, policy, signal) {
        order.push("read")
        await read
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  const iterator = prepared.stream({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "u1",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "text", text: "Describe" },
        { type: "image", attachment },
      ],
    }],
  })[Symbol.asyncIterator]()

  const first = iterator.next()
  await Promise.resolve()
  assert.deepEqual(order, ["read"])
  resolveRead()
  await first
  for await (const _chunk of { [Symbol.asyncIterator]: () => iterator }) {}

  assert.deepEqual(order, ["read", "transport"])
  assert.equal(capturedRequest.input[0].content[1].type, "input_image")
})

test("the direct adapter stream resolves the route before compiling an image request", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = {
    attachmentId: `sha256:${"7".repeat(64)}`,
    mediaType: "image/png",
    bytes: data.byteLength,
    width: 1,
    height: 1,
  }
  let modelLookups = 0
  let reads = 0
  let capturedRequest
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() {
          modelLookups += 1
          return catalog
        },
        async *streamResponses(request) {
          capturedRequest = request
          yield * completedResponseEvents()
        },
      },
    }),
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        reads += 1
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  for await (const _chunk of adapter.stream({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "direct-image",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment }],
    }],
  })) {}

  assert.equal(modelLookups, 1)
  assert.equal(reads, 1)
  assert.equal(capturedRequest.input[0].content[0].type, "input_image")
  assert.equal(capturedRequest.input[0].content[0].detail, "high")
})

test("the direct adapter snapshots request options before catalog discovery awaits", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = {
    attachmentId: `sha256:${"6".repeat(64)}`,
    mediaType: "image/png",
    bytes: data.byteLength,
    width: 1,
    height: 1,
  }
  const originalSignal = new AbortController().signal
  let markCatalogStarted
  let releaseCatalog
  const catalogStarted = new Promise((resolve) => { markCatalogStarted = resolve })
  const catalogReleased = new Promise((resolve) => { releaseCatalog = resolve })
  let capturedRequest
  let transportSignal
  let readSignal
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels({ signal }) {
          assert.equal(signal, originalSignal)
          markCatalogStarted()
          await catalogReleased
          return catalog
        },
        async *streamResponses(request, { signal }) {
          capturedRequest = request
          transportSignal = signal
          yield * completedResponseEvents()
        },
      },
    }),
    getAttachmentStore: () => ({
      async readImageRequest(ref, _policy, signal) {
        readSignal = signal
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })
  const options = {
    provider: "grok",
    model: "grok-4.6",
    signal: originalSignal,
    messages: [{
      id: "direct-snapshot",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "text", text: "Before" },
        { type: "image", attachment },
      ],
    }],
  }
  const iterator = adapter.stream(options)[Symbol.asyncIterator]()
  const first = iterator.next()
  await catalogStarted
  options.provider = "foreign"
  options.model = "grok-4.5"
  options.signal = AbortSignal.abort()
  options.messages[0].content[0].text = "After"
  releaseCatalog()
  await first
  for await (const _chunk of { [Symbol.asyncIterator]: () => iterator }) {}

  assert.equal(capturedRequest.model, "grok-4.6")
  assert.equal(capturedRequest.input[0].content[0].text, "Before")
  assert.equal(readSignal, originalSignal)
  assert.equal(transportSignal, originalSignal)
})

test("the direct adapter rejects accessor-backed route identity before catalog discovery", () => {
  let modelReads = 0
  let modelLookups = 0
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() {
          modelLookups += 1
          return catalog
        },
        async *streamResponses() {},
      },
    }),
  })
  const options = {
    provider: "grok",
    messages: [{
      id: "direct-accessor-model",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Hello" }],
    }],
  }
  Object.defineProperty(options, "model", {
    enumerable: true,
    get() {
      modelReads += 1
      return modelReads === 2 ? "grok-4.5" : "grok-4.6"
    },
  })

  assert.throws(() => adapter.stream(options), (error) => (
    error?.name === "UnsupportedResponsesRequestError"
  ))
  assert.equal(modelReads, 0)
  assert.equal(modelLookups, 0)
})

test("missing attachment projection fails as unsupported content before the Responses POST", async () => {
  let transportCalls = 0
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses() { transportCalls += 1 },
      },
    }),
    getAttachmentStore: () => undefined,
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  const attachment = {
    attachmentId: `sha256:${"c".repeat(64)}`,
    mediaType: "image/png",
    bytes: 68,
    width: 1,
    height: 1,
  }

  await assert.rejects(async () => {
    for await (const _chunk of prepared.stream({
      provider: "grok",
      model: "grok-4.6",
      messages: [{
        id: "u1",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "image", attachment }],
      }],
    })) {}
  }, (error) => error?.code === "UNSUPPORTED_CONTENT")
  assert.equal(transportCalls, 0)
})

test("a custom abort reason maps to ABORTED before the Responses POST", async () => {
  let transportCalls = 0
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses() { transportCalls += 1 },
      },
    }),
    getAttachmentStore: () => {
      throw new Error("attachment storage must not be resolved after abort")
    },
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  const controller = new AbortController()
  controller.abort(new Error("custom cancellation reason"))

  await assert.rejects(async () => {
    for await (const _chunk of prepared.stream({
      provider: "grok",
      model: "grok-4.6",
      signal: controller.signal,
      messages: [{
        id: "u1",
        role: "user",
        source: { kind: "user" },
        content: [{
          type: "image",
          attachment: {
            attachmentId: `sha256:${"9".repeat(64)}`,
            mediaType: "image/png",
            bytes: 68,
            width: 1,
            height: 1,
          },
        }],
      }],
    })) {}
  }, (error) => error?.code === "ABORTED")
  assert.equal(transportCalls, 0)
})

test("a custom abort reason during attachment I/O maps to ABORTED before the Responses POST", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = {
    attachmentId: `sha256:${"8".repeat(64)}`,
    mediaType: "image/png",
    bytes: data.byteLength,
    width: 1,
    height: 1,
  }
  let transportCalls = 0
  let resolveRead
  let markReadStarted
  const readStarted = new Promise((resolve) => { markReadStarted = resolve })
  const read = new Promise((resolve) => { resolveRead = resolve })
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses() { transportCalls += 1 },
      },
    }),
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        markReadStarted()
        await read
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  const controller = new AbortController()
  const consume = async () => {
    for await (const _chunk of prepared.stream({
      provider: "grok",
      model: "grok-4.6",
      signal: controller.signal,
      messages: [{
        id: "u1",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "image", attachment }],
      }],
    })) {}
  }
  const outcome = consume()
  await readStarted
  controller.abort(new Error("custom mid-read cancellation"))
  resolveRead()

  await assert.rejects(outcome, (error) => error?.code === "ABORTED")
  assert.equal(transportCalls, 0)
})

test("the adapter compiles Web Search and decodes its server lifecycle through the final receipt", async () => {
  let capturedRequest
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses(request) {
          capturedRequest = request
          yield * encodeResponseEvents(webSearchResponseEvents())
        },
      },
    }),
    getSearchPolicy: () => Object.freeze({ webSearch: true, xSearch: false }),
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  const chunks = []
  for await (const chunk of prepared.stream({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "search-user",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Search official docs" }],
    }],
  })) chunks.push(chunk)

  assert.deepEqual(capturedRequest.tools, [{ type: "web_search" }])
  assert.equal(chunks.some((chunk) => chunk.type.startsWith("tool-call")), false)
  assert.equal(chunks.some((chunk) => chunk.type === "text-delta"), true)
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })
})

test("the adapter snapshots Search policy before model discovery and refreshes it for the next call", async () => {
  let searchPolicy = Object.freeze({ webSearch: true, xSearch: false })
  let releaseFirstCatalog
  let markFirstCatalogStarted
  let catalogReads = 0
  const firstCatalogStarted = new Promise((resolve) => { markFirstCatalogStarted = resolve })
  const firstCatalogRelease = new Promise((resolve) => { releaseFirstCatalog = resolve })
  const capturedRequests = []
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() {
          catalogReads += 1
          if (catalogReads === 1) {
            markFirstCatalogStarted()
            await firstCatalogRelease
          }
          return catalog
        },
        async *streamResponses(request) {
          capturedRequests.push(request)
          yield * completedResponseEvents()
        },
      },
    }),
    getSearchPolicy: () => searchPolicy,
    mapError: mapLlmError,
  })

  const firstPreparedPromise = adapter.prepareCall("grok", "grok-4.6")
  await firstCatalogStarted
  searchPolicy = Object.freeze({ webSearch: false, xSearch: true })
  releaseFirstCatalog()
  const firstPrepared = await firstPreparedPromise
  const secondPrepared = await adapter.prepareCall("grok", "grok-4.6")
  const options = (id) => ({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id,
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Search official docs" }],
    }],
  })

  for await (const _chunk of firstPrepared.stream(options("first-policy"))) {}
  for await (const _chunk of secondPrepared.stream(options("second-policy"))) {}

  assert.deepEqual(capturedRequests.map((request) => request.tools), [
    [{ type: "web_search" }],
    [{ type: "x_search" }],
  ])
})

test("the direct adapter stream snapshots Search policy before iteration starts", async () => {
  let searchPolicy = Object.freeze({ webSearch: true, xSearch: false })
  const capturedRequests = []
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses(request) {
          capturedRequests.push(request)
          yield * completedResponseEvents()
        },
      },
    }),
    getSearchPolicy: () => searchPolicy,
    mapError: mapLlmError,
  })
  const options = (id) => ({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id,
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Search official docs" }],
    }],
  })

  const firstStream = adapter.stream(options("first-direct-policy"))
  searchPolicy = Object.freeze({ webSearch: false, xSearch: true })

  for await (const _chunk of firstStream) {}
  for await (const _chunk of adapter.stream(options("second-direct-policy"))) {}

  assert.deepEqual(capturedRequests.map((request) => request.tools), [
    [{ type: "web_search" }],
    [{ type: "x_search" }],
  ])
})

test("the adapter compiles X Search and decodes its custom lifecycle through the final receipt", async () => {
  let capturedRequest
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses(request) {
          capturedRequest = request
          yield * encodeResponseEvents(xSearchResponseEvents())
        },
      },
    }),
    getSearchPolicy: () => Object.freeze({ webSearch: false, xSearch: true }),
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  const chunks = []
  for await (const chunk of prepared.stream({
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "x-search-user",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Search X" }],
    }],
  })) chunks.push(chunk)

  assert.deepEqual(capturedRequest.tools, [{ type: "x_search" }])
  assert.equal(chunks.some((chunk) => chunk.type.startsWith("tool-call")), false)
  assert.equal(chunks.some((chunk) => chunk.type === "text-delta"), true)
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "stop" } })
})

test("the adapter binds Web Search and Harness functions in one final receipt", async () => {
  let capturedRequest
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses(request) {
          capturedRequest = request
          yield * encodeResponseEvents(webAndFunctionResponseEvents())
        },
      },
    }),
    getSearchPolicy: () => Object.freeze({ webSearch: true, xSearch: false }),
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")
  const chunks = []
  for await (const chunk of prepared.stream({
    provider: "grok",
    model: "grok-4.6",
    tools: [{
      name: "fixture_tool",
      description: "Fixture function",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    }],
    messages: [{
      id: "mixed-search-user",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Search and call the fixture" }],
    }],
  })) chunks.push(chunk)

  assert.deepEqual(capturedRequest.tools.map((tool) => tool.type), ["function", "web_search"])
  assert.deepEqual(capturedRequest.tools[0], {
    type: "function",
    name: "fixture_tool",
    description: "Fixture function",
    parameters: { type: "object", properties: { query: { type: "string" } } },
  })
  assert.equal(chunks.filter((chunk) => chunk.type === "tool-call-delta").length, 2)
  assert.deepEqual(chunks.find((chunk) => chunk.type === "block-end")?.block, {
    type: "tool-call",
    id: "call_fixture",
    name: "fixture_tool",
    arguments: '{"query":"docs"}',
  })
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: { kind: "tool-calls" } })
})

test("an enabled Search setting fails unsupported routes before the Responses POST", async () => {
  let transportCalls = 0
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        streamResponses() {
          transportCalls += 1
          return (async function* emptyResponseStream() {})()
        },
      },
    }),
    getSearchPolicy: () => Object.freeze({ webSearch: true, xSearch: false }),
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.5")

  await assert.rejects(async () => {
    for await (const _chunk of prepared.stream({
      provider: "grok",
      model: "grok-4.5",
      messages: [{
        id: "unsupported-search",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Hello" }],
      }],
    })) {}
  }, (error) => error?.code === "UNSUPPORTED_CONTENT")
  assert.equal(transportCalls, 0)
})

test("a Responses HTTP 400 remains a provider error instead of an invalid stream", async () => {
  const sourceError = new GrokTransportError(400)
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses() { throw sourceError },
      },
    }),
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")

  await assert.rejects(async () => {
    for await (const _chunk of prepared.stream({
      provider: "grok",
      model: "grok-4.6",
      messages: [{
        id: "transport-400",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Hello" }],
      }],
    })) {}
  }, (error) => {
    assert.equal(error?.code, "PROVIDER_ERROR")
    assert.equal(error?.failure?.status, 400)
    assert.equal(error?.cause, sourceError)
    return true
  })
})

test("a background call rejects Search output because its compiled receipt contains no server tools", async () => {
  let capturedRequest
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return catalog },
        async *streamResponses(request) {
          capturedRequest = request
          yield * encodeResponseEvents(webSearchResponseEvents())
        },
      },
    }),
    getSearchPolicy: () => Object.freeze({ webSearch: true, xSearch: true }),
    mapError: mapLlmError,
  })
  const prepared = await adapter.prepareCall("grok", "grok-4.6")

  await assert.rejects(async () => {
    for await (const _chunk of prepared.stream({
      provider: "grok",
      model: "grok-4.6",
      purpose: "session-title",
      messages: [{
        id: "background-search",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Title this conversation" }],
      }],
    })) {}
  }, (error) => error?.code === "INVALID_RESPONSE")
  assert.equal(capturedRequest.tools, undefined)
})

test("the real LLM runtime preserves images only for the exact verified image route", async () => {
  const runtimeCatalog = JSON.stringify({
    ...JSON.parse(catalog),
    data: [
      ...JSON.parse(catalog).data,
      {
        id: "grok-future",
        name: "Grok Future",
        context_window: 500000,
        api_backend: "responses",
        supports_reasoning_effort: false,
      },
    ],
  })
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = {
    attachmentId: `sha256:${"f".repeat(64)}`,
    mediaType: "image/png",
    bytes: data.byteLength,
    width: 1,
    height: 1,
  }
  let reads = 0
  const requests = []
  const adapter = createGrokAdapter({
    getGeneration: () => ({
      id: 1,
      transport: {
        async listModels() { return runtimeCatalog },
        async *streamResponses(request) {
          requests.push(request)
          yield * completedResponseEvents()
        },
      },
    }),
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        reads += 1
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })
  const ctx = new Context()
  const llmFiber = ctx.plugin(LlmRuntime)
  await llmFiber
  const remove = ctx.llm.registerAdapter(["grok"], adapter)
  const options = (model) => ({
    provider: "grok",
    model,
    messages: [{
      id: "u1",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment }],
    }],
  })

  for await (const _chunk of ctx.llm.stream(options("grok-4.6"))) {}
  for await (const _chunk of ctx.llm.stream(options("grok-4.5"))) {}
  for await (const _chunk of ctx.llm.stream(options("grok-future"))) {}

  assert.equal(reads, 1)
  assert.equal(requests[0].input[0].content[0].type, "input_image")
  assert.match(requests[1].input[0].content, /^\[image omitted because this model accepts text only/u)
  assert.match(requests[2].input[0].content, /^\[image omitted because this model accepts text only/u)
  remove()
  await llmFiber.dispose()
})

async function* completedResponseEvents() {
  const encoder = new TextEncoder()
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
}

function webSearchResponseEvents() {
  const text = "Result [source](https://example.test)"
  const annotation = {
    type: "url_citation",
    url: "https://example.test",
    title: "Example",
    start_index: 7,
    end_index: 13,
  }
  const initialReasoningDone = {
    id: "rs_search",
    type: "reasoning",
    status: "completed",
    encrypted_content: "sealed-search-summary",
    summary: [{ type: "summary_text", text: "Search reasoning." }],
  }
  const webDone = {
    id: "ws_1",
    type: "web_search_call",
    status: "completed",
    action: { type: "search", query: "official docs", sources: [] },
  }
  const emptyReasoning = {
    id: "rs_empty_search",
    type: "reasoning",
    status: "completed",
    encrypted_content: "sealed-search-empty",
    summary: [],
  }
  const reusedReasoningAdded = {
    id: "rs_search",
    type: "reasoning",
    status: "in_progress",
    summary: [],
  }
  const reusedReasoningDone = {
    ...reusedReasoningAdded,
    status: "completed",
    encrypted_content: "sealed-search-reused",
  }
  const messageDone = {
    id: "msg_search",
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [annotation] }],
  }
  return [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "rs_search", type: "reasoning", status: "in_progress", summary: [] } },
    { type: "response.reasoning_summary_part.added", sequence_number: 3, output_index: 0, item_id: "rs_search", summary_index: 0, part: { type: "summary_text", text: "" } },
    { type: "response.reasoning_summary_text.delta", sequence_number: 4, output_index: 0, item_id: "rs_search", summary_index: 0, delta: "Search reasoning." },
    { type: "response.reasoning_summary_text.done", sequence_number: 5, output_index: 0, item_id: "rs_search", summary_index: 0, text: "Search reasoning." },
    { type: "response.reasoning_summary_part.done", sequence_number: 6, output_index: 0, item_id: "rs_search", summary_index: 0, part: { type: "summary_text", text: "Search reasoning." } },
    { type: "response.output_item.done", sequence_number: 7, output_index: 0, item: initialReasoningDone },
    { type: "response.output_item.added", sequence_number: 8, output_index: 1, item: { id: "ws_1", type: "web_search_call", status: "in_progress", action: { type: "search", query: "", sources: [] } } },
    { type: "response.web_search_call.in_progress", sequence_number: 9, output_index: 1, item_id: "ws_1" },
    { type: "response.web_search_call.searching", sequence_number: 10, output_index: 1, item_id: "ws_1" },
    { type: "response.web_search_call.completed", sequence_number: 11, output_index: 1, item_id: "ws_1" },
    { type: "response.output_item.done", sequence_number: 12, output_index: 1, item: webDone },
    { type: "response.output_item.added", sequence_number: 13, output_index: 2, item: emptyReasoning },
    { type: "response.output_item.done", sequence_number: 14, output_index: 2, item: emptyReasoning },
    { type: "response.output_item.added", sequence_number: 15, output_index: 3, item: reusedReasoningAdded },
    { type: "response.output_item.done", sequence_number: 16, output_index: 3, item: reusedReasoningDone },
    { type: "response.output_item.added", sequence_number: 17, output_index: 4, item: { id: "msg_search", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 18, output_index: 4, item_id: "msg_search", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 19, output_index: 4, item_id: "msg_search", content_index: 0, delta: text },
    { type: "response.output_text.annotation.added", sequence_number: 20, output_index: 4, item_id: "msg_search", content_index: 0, annotation_index: 0, annotation },
    { type: "response.output_text.done", sequence_number: 21, output_index: 4, item_id: "msg_search", content_index: 0, text },
    { type: "response.content_part.done", sequence_number: 22, output_index: 4, item_id: "msg_search", content_index: 0, part: { type: "output_text", text, annotations: [annotation] } },
    { type: "response.output_item.done", sequence_number: 23, output_index: 4, item: messageDone },
    {
      type: "response.completed",
      sequence_number: 24,
      response: {
        status: "completed",
        output: [initialReasoningDone, webDone, emptyReasoning, reusedReasoningDone, messageDone],
        citations: ["https://example.test"],
        server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 },
        usage: { input_tokens: 10, output_tokens: 4 },
      },
    },
  ]
}

function xSearchResponseEvents() {
  const input = '{"query":"official"}'
  const text = "X result"
  return [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "x_1", type: "custom_tool_call", status: "in_progress", call_id: "x_call_1", name: "x_keyword_search", input: "" } },
    { type: "response.custom_tool_call_input.delta", sequence_number: 3, output_index: 0, item_id: "x_1", delta: '{"query":' },
    { type: "response.custom_tool_call_input.delta", sequence_number: 4, output_index: 0, item_id: "x_1", delta: '"official"}' },
    { type: "response.custom_tool_call_input.done", sequence_number: 5, output_index: 0, item_id: "x_1", input },
    { type: "response.output_item.done", sequence_number: 6, output_index: 0, item: { id: "x_1", type: "custom_tool_call", status: "completed", call_id: "x_call_1", name: "x_keyword_search", input } },
    { type: "response.output_item.added", sequence_number: 7, output_index: 1, item: { id: "msg_x", type: "message", role: "assistant", status: "in_progress", content: [] } },
    { type: "response.content_part.added", sequence_number: 8, output_index: 1, item_id: "msg_x", content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", sequence_number: 9, output_index: 1, item_id: "msg_x", content_index: 0, delta: text },
    { type: "response.output_text.done", sequence_number: 10, output_index: 1, item_id: "msg_x", content_index: 0, text },
    { type: "response.content_part.done", sequence_number: 11, output_index: 1, item_id: "msg_x", content_index: 0, part: { type: "output_text", text, annotations: [] } },
    { type: "response.output_item.done", sequence_number: 12, output_index: 1, item: { id: "msg_x", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] } },
    { type: "response.completed", sequence_number: 13, response: { status: "completed", server_side_tool_usage: { SERVER_SIDE_TOOL_X_SEARCH: 1 }, usage: { input_tokens: 8, output_tokens: 2 } } },
  ]
}

function webAndFunctionResponseEvents() {
  const argumentsJson = '{"query":"docs"}'
  return [
    { type: "response.created", sequence_number: 0, response: { status: "in_progress" } },
    { type: "response.in_progress", sequence_number: 1, response: { status: "in_progress" } },
    { type: "response.output_item.added", sequence_number: 2, output_index: 0, item: { id: "ws_mixed", type: "web_search_call", status: "in_progress", action: { type: "search", query: "", sources: [] } } },
    { type: "response.web_search_call.in_progress", sequence_number: 3, output_index: 0, item_id: "ws_mixed" },
    { type: "response.web_search_call.searching", sequence_number: 4, output_index: 0, item_id: "ws_mixed" },
    { type: "response.web_search_call.completed", sequence_number: 5, output_index: 0, item_id: "ws_mixed" },
    { type: "response.output_item.done", sequence_number: 6, output_index: 0, item: { id: "ws_mixed", type: "web_search_call", status: "completed", action: { type: "search", query: "official docs", sources: [] } } },
    { type: "response.output_item.added", sequence_number: 7, output_index: 1, item: { id: "fc_mixed", type: "function_call", status: "in_progress", call_id: "call_fixture", name: "fixture_tool", arguments: "" } },
    { type: "response.function_call_arguments.delta", sequence_number: 8, output_index: 1, item_id: "fc_mixed", delta: '{"query":' },
    { type: "response.function_call_arguments.delta", sequence_number: 9, output_index: 1, item_id: "fc_mixed", delta: '"docs"}' },
    { type: "response.function_call_arguments.done", sequence_number: 10, output_index: 1, item_id: "fc_mixed", name: "fixture_tool", arguments: argumentsJson },
    { type: "response.output_item.done", sequence_number: 11, output_index: 1, item: { id: "fc_mixed", type: "function_call", status: "completed", call_id: "call_fixture", name: "fixture_tool", arguments: argumentsJson } },
    { type: "response.completed", sequence_number: 12, response: { status: "completed", server_side_tool_usage: { SERVER_SIDE_TOOL_WEB_SEARCH: 1 }, usage: { input_tokens: 12, output_tokens: 4 } } },
  ]
}

async function* encodeResponseEvents(events) {
  const encoder = new TextEncoder()
  for (const event of events) {
    yield encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  }
}

import assert from "node:assert/strict"
import test from "node:test"

import { Context } from "@deepseek-ai/cordis"
import LlmRuntime from "@deepseek-ai/dsh-llm"

import { createGrokAdapter } from "../../../src/internal/grok-adapter.mjs"
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

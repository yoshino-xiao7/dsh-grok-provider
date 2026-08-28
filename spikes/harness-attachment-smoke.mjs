import { readFile, realpath, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const RUNTIME_ENV = "DSH_HARNESS_ATTACHMENT_RUNTIME"
const EXPECTED_VERSIONS = Object.freeze({
  "@deepseek-ai/cordis": "4.0.1",
  "@deepseek-ai/dsh-attachment": "0.1.1-rc.2",
  "@deepseek-ai/dsh-attachment-local": "0.1.1-rc.2",
  "@deepseek-ai/dsh-llm": "0.1.1-rc.2",
  sharp: "0.35.3",
})
const TOOL_CALL_ID = "harness_attachment_smoke_call"
const TOOL_RESULT_PREFIX = "The verified attachment follows."
const TOOL_RESULT_SUFFIX = "Use the attachment above."

class HarnessAttachmentSmokeError extends Error {
  constructor(code) {
    super("The Harness attachment smoke failed")
    this.name = "HarnessAttachmentSmokeError"
    this.code = code
  }
}

async function main() {
  const runtime = process.env[RUNTIME_ENV]
  if (typeof runtime !== "string" || !path.isAbsolute(runtime)) fail("runtime-required")

  const repository = path.resolve(import.meta.dirname, "..")
  const runtimeRequire = createRequire(path.join(runtime, "package.json"))
  const repoRequire = createRequire(path.join(repository, "package.json"))
  await requireVersions(runtimeRequire, repoRequire)

  const [{ Context }, { LlmRuntime }, { LocalAttachmentStore }, { default: sharp }, { createGrokAdapter }] = await Promise.all([
    import(pathToFileURL(repoRequire.resolve("@deepseek-ai/cordis")).href),
    import(pathToFileURL(repoRequire.resolve("@deepseek-ai/dsh-llm")).href),
    import(pathToFileURL(runtimeRequire.resolve("@deepseek-ai/dsh-attachment-local")).href),
    import(pathToFileURL(runtimeRequire.resolve("sharp")).href),
    import(pathToFileURL(path.join(repository, "src/internal/grok-adapter.mjs")).href),
  ])

  const ctx = new Context()
  const dshHome = await import("node:fs/promises").then(({ mkdtemp }) => (
    mkdtemp(path.join(os.tmpdir(), "dsh-grok-harness-attachment-"))
  ))
  let removeAdapter
  try {
    await ctx.plugin(LocalAttachmentStore, { dshHome })
    const store = ctx.get("attachments")
    if (!(store instanceof LocalAttachmentStore)) fail("attachment-service-not-mounted")

    const source = await sharp({
      create: {
        width: 128,
        height: 64,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    }).png().toBuffer()
    const ref = await store.saveImage({
      data: source,
      mediaType: "image/png",
      name: "synthetic-solid-color.png",
    })
    const projection = await store.readImageRequest(ref, imageReadPolicy(), AbortSignal.timeout(30_000))
    validateProjection(ref, projection)
    const contentAddressed = /^sha256:[0-9a-f]{64}$/u.test(String(ref.attachmentId))
    const distinctVariant = typeof projection.variantId === "string" &&
      projection.variantId.length > 0 &&
      String(projection.variantId) !== String(ref.attachmentId)
    if (!contentAddressed || !distinctVariant) fail("attachment-identity-mismatch")

    const compiledRequests = []
    const adapter = createGrokAdapter({
      getGeneration: () => ({
        id: 1,
        transport: {
          async listModels() { return modelCatalog() },
          async *streamResponses(request) {
            compiledRequests.push(request)
            yield * completedResponseEvents()
          },
        },
      }),
      getAttachmentStore: () => ctx.get("attachments"),
    })
    await ctx.plugin(LlmRuntime)
    removeAdapter = ctx.llm.registerAdapter(["grok"], adapter)

    for (const model of ["grok-4.6", "grok-4.5", "grok-future"]) {
      for await (const _chunk of ctx.llm.stream(streamOptions(model, ref))) {}
    }
    for await (const _chunk of ctx.llm.stream(toolResultStreamOptions("grok-4.6", ref))) {}
    const expectedImageUrl = `data:image/png;base64,${Buffer.from(projection.data).toString("base64")}`
    const verifiedModelUsesImage = hasInlinePngInput(compiledRequests[0], expectedImageUrl)
    const grok45TextOnly = hasTextOnlyProjection(compiledRequests[1])
    const unknownModelTextOnly = hasTextOnlyProjection(compiledRequests[2])
    const toolResultUsesOrderedImage = hasOrderedToolResultPngInput(
      compiledRequests[3],
      expectedImageUrl,
    )
    if (
      !verifiedModelUsesImage ||
      !grok45TextOnly ||
      !unknownModelTextOnly ||
      !toolResultUsesOrderedImage ||
      compiledRequests.length !== 4
    ) {
      fail("runtime-modality-projection-mismatch")
    }

    writeRecord({
      kind: "harness-attachment-smoke",
      status: "passed",
      attachmentLocalVersion: EXPECTED_VERSIONS["@deepseek-ai/dsh-attachment-local"],
      llmVersion: EXPECTED_VERSIONS["@deepseek-ai/dsh-llm"],
      sourceBytes: source.byteLength,
      storedBytes: ref.bytes,
      requestBytes: projection.bytes,
      mediaType: projection.mediaType,
      width: projection.width,
      height: projection.height,
      depth: projection.depth,
      space: projection.space,
      contentAddressed,
      distinctVariant,
      verifiedModelUsesImage,
      grok45TextOnly,
      unknownModelTextOnly,
      toolResultUsesOrderedImage,
      compiledRequests: compiledRequests.length,
      networkRequests: 0,
    })
  } finally {
    try {
      removeAdapter?.()
    } finally {
      try {
        await ctx.fiber.dispose()
      } finally {
        await rm(dshHome, { force: true, recursive: true })
      }
    }
  }
}

async function requireVersions(runtimeRequire, repoRequire) {
  const sharpManifestPath = await realpath(path.resolve(
    path.dirname(runtimeRequire.resolve("sharp")),
    "..",
    "package.json",
  ))
  const runtimeRoot = path.resolve(path.dirname(sharpManifestPath), "..", "..")
  const sources = [
    [runtimeRequire, "@deepseek-ai/cordis", true, undefined],
    [runtimeRequire, "@deepseek-ai/dsh-attachment", true, undefined],
    [runtimeRequire, "@deepseek-ai/dsh-attachment-local", true, undefined],
    [runtimeRequire, "sharp", true, sharpManifestPath],
    [repoRequire, "@deepseek-ai/cordis", false, undefined],
    [repoRequire, "@deepseek-ai/dsh-llm", false, undefined],
  ]
  for (const [require, name, mustUseRuntime, knownManifestPath] of sources) {
    const manifestPath = knownManifestPath ?? await realpath(require.resolve(`${name}/package.json`))
    if (mustUseRuntime && !manifestPath.startsWith(`${runtimeRoot}${path.sep}`)) {
      fail("runtime-package-resolution-mismatch")
    }
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    if (manifest.name !== name || manifest.version !== EXPECTED_VERSIONS[name]) {
      fail("harness-version-mismatch")
    }
  }
  const localRequire = createRequire(runtimeRequire.resolve("@deepseek-ai/dsh-attachment-local"))
  for (const name of ["@deepseek-ai/cordis", "@deepseek-ai/dsh-attachment", "sharp"]) {
    const resolved = await realpath(localRequire.resolve(name))
    if (!resolved.startsWith(`${runtimeRoot}${path.sep}`)) fail("attachment-peer-resolution-mismatch")
  }
}

function streamOptions(model, ref) {
  return {
    provider: "grok",
    model,
    messages: [{
      id: "harness-image-smoke",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: ref }],
    }],
  }
}

function toolResultStreamOptions(model, ref) {
  return {
    provider: "grok",
    model,
    messages: [
      {
        id: "harness-tool-image-user",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Inspect the completed synthetic tool result." }],
      },
      {
        id: "harness-tool-image-assistant",
        role: "assistant",
        source: { kind: "model", provider: "grok", model },
        content: [{ type: "tool-call", id: TOOL_CALL_ID, name: "fixture_image", arguments: "{}" }],
      },
      {
        id: "harness-tool-image-result",
        role: "user",
        source: { kind: "tool", callId: TOOL_CALL_ID },
        content: [{
          type: "tool-result",
          toolCallId: TOOL_CALL_ID,
          isError: false,
          content: [
            { type: "text", text: TOOL_RESULT_PREFIX },
            { type: "image", attachment: ref },
            { type: "text", text: TOOL_RESULT_SUFFIX },
          ],
        }],
      },
    ],
  }
}

function imageReadPolicy() {
  return { maxBytes: 4 * 1024 * 1024, maxPixels: 16 * 1024 * 1024 }
}

function validateProjection(ref, projection) {
  if (
    projection?.attachment?.attachmentId !== ref.attachmentId ||
    !(projection.data instanceof Uint8Array) ||
    projection.bytes !== projection.data.byteLength ||
    projection.mediaType !== "image/png" ||
    projection.width !== 128 ||
    projection.height !== 64 ||
    projection.depth !== "uchar" ||
    projection.space !== "srgb" ||
    projection.hasAlpha !== false
  ) fail("request-image-projection-mismatch")
}

function hasInlinePngInput(request, expectedImageUrl) {
  const block = request?.input?.[0]?.content?.[0]
  return block?.type === "input_image" &&
    block.detail === "high" &&
    block.image_url === expectedImageUrl
}

function hasTextOnlyProjection(request) {
  const content = request?.input?.[0]?.content
  return typeof content === "string" &&
    content.startsWith("[image omitted because this model accepts text only")
}

function hasOrderedToolResultPngInput(request, expectedImageUrl) {
  const input = request?.input
  const call = input?.[1]
  const result = input?.[2]
  const output = result?.output
  return Array.isArray(input) &&
    input.length === 3 &&
    call?.type === "function_call" &&
    call.call_id === TOOL_CALL_ID &&
    call.name === "fixture_image" &&
    call.arguments === "{}" &&
    result?.type === "function_call_output" &&
    result.call_id === TOOL_CALL_ID &&
    Array.isArray(output) &&
    output.length === 3 &&
    output[0]?.type === "input_text" &&
    output[0].text === TOOL_RESULT_PREFIX &&
    output[1]?.type === "input_image" &&
    output[1].image_url === expectedImageUrl &&
    output[1].detail === "high" &&
    output[2]?.type === "input_text" &&
    output[2].text === TOOL_RESULT_SUFFIX
}

function modelCatalog() {
  return JSON.stringify({
    object: "list",
    data: ["grok-4.5", "grok-4.6", "grok-future"].map((id) => ({
      id,
      name: id,
      context_window: 500000,
      api_backend: "responses",
      supports_reasoning_effort: false,
    })),
  })
}

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

function writeRecord(record) {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}

function fail(code) {
  throw new HarnessAttachmentSmokeError(code)
}

main().catch((error) => {
  writeRecord({
    kind: "harness-attachment-smoke",
    status: "failed",
    errorCode: error instanceof HarnessAttachmentSmokeError ? error.code : "unexpected",
  })
  process.exitCode = 1
})

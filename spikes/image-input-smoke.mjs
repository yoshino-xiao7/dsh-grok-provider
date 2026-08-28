import { createHash } from "node:crypto"
import os from "node:os"
import path from "node:path"
import { deflateSync } from "node:zlib"

import { attributionHeaders } from "@deepseek-ai/dsh-llm"

import { GROK_PRODUCTION_OIDC_AUTH_CONTRACT, createCredentialSource } from "../src/internal/credential-source.mjs"
import { createGrokAdapter } from "../src/internal/grok-adapter.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"

const CONFIRMATION_ENV = "DSH_GROK_CONFIRM_REAL_IMAGE_SMOKE"
const CONFIRMATION_VALUE = "YES"
const PROXY_ORIGIN = "https://cli-chat-proxy.grok.com"
const MODEL_ID = "grok-4.6"
const USER_IMAGE_PREFIX = "Inspect this synthetic test image."
const USER_IMAGE_SUFFIX = "Identify the single solid color filling this image. Reply with exactly one lowercase basic color word and no punctuation."
const TOOL_USER_TEXT = "Read the completed synthetic tool result and identify the single solid color filling its image."
const TOOL_RESULT_PREFIX = "The synthetic image follows."
const TOOL_RESULT_SUFFIX = "Reply with exactly one lowercase basic color word and no punctuation."
const RESPONSE_CASE_COUNT = 4
const REQUEST_STATE = {
  expected: undefined,
  completedPosts: 0,
  startedPosts: 0,
  modelGets: 0,
  guardErrorCode: undefined,
  lastCompleted: undefined,
}
const ALLOWED_CHUNK_TYPES = new Set([
  "block-start",
  "reasoning-delta",
  "text-delta",
  "tool-call-delta",
  "block-end",
  "usage",
  "finish",
])

class ImageSmokeError extends Error {
  constructor(code, status) {
    super("The image-input smoke failed")
    this.name = "ImageSmokeError"
    this.code = code
    if (status !== undefined) this.status = status
  }
}

async function main() {
  if (process.platform !== "darwin") fail("unsupported-platform")
  if (process.env[CONFIRMATION_ENV] !== CONFIRMATION_VALUE) fail("confirmation-required")
  requireSafeDebugEnvironment()

  const fixtures = createSyntheticFixtures()
  const networkFetch = globalThis.fetch
  const transport = createGrokTransport({
    credentialSource: createCredentialSource({
      contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
      load: createOfficialCredentialLoader({
        authPath: path.join(os.homedir(), ".grok", "auth.json"),
        platform: "darwin",
      }),
      now: () => new Date(),
    }),
    fetch: createGuardedFetch(networkFetch, REQUEST_STATE),
    attributionHeaders,
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })
  const adapter = createGrokAdapter({
    getGeneration: () => ({ id: 1, transport }),
    getAttachmentStore: () => fixtures.store,
  })

  const prepared = await adapter.prepareCall("grok", MODEL_ID, AbortSignal.timeout(120_000))
  requireImageRoute(prepared.model, MODEL_ID)
  const reasoningEffort = chooseLowestEffort(prepared.model)
  const cases = [
    smokeCase("blue-red", "blue", "user-image", fixtures.blue),
    smokeCase("blue-red", "red", "tool-result-image", fixtures.red),
    smokeCase("red-blue", "red", "user-image", fixtures.red),
    smokeCase("red-blue", "blue", "tool-result-image", fixtures.blue),
  ]
  if (
    new Set(cases.map(({ fixture, name, round }) => `${round}:${name}:${fixture}`)).size !==
      RESPONSE_CASE_COUNT ||
    !cases.every(({ fixture, image }) => fixture === image.expectedColor)
  ) fail("invalid-case-matrix")

  for (const smoke of cases) {
    await runCase({
      adapter: prepared,
      image: smoke.image,
      model: MODEL_ID,
      reasoningEffort,
      name: smoke.name,
      requestState: REQUEST_STATE,
      messages: smoke.messages,
      fixture: smoke.fixture,
      round: smoke.round,
    })
  }

  if (
    REQUEST_STATE.expected !== undefined ||
    REQUEST_STATE.modelGets !== 1 ||
    REQUEST_STATE.startedPosts !== RESPONSE_CASE_COUNT ||
    REQUEST_STATE.completedPosts !== RESPONSE_CASE_COUNT
  ) {
    fail("request-count-mismatch")
  }
  writeRecord({
    kind: "image-input-smoke",
    status: "passed",
    modelGets: 1,
    responsePosts: RESPONSE_CASE_COUNT,
  })
}

function smokeCase(round, fixture, name, image) {
  return Object.freeze({
    fixture,
    image,
    messages: name === "user-image"
      ? userImageMessages(image.ref)
      : toolResultImageMessages(MODEL_ID, image.ref),
    name,
    round,
  })
}

async function runCase({
  adapter,
  fixture,
  image,
  model,
  reasoningEffort,
  name,
  requestState,
  messages,
  round,
}) {
  if (requestState.expected !== undefined) fail("request-overlap")
  requestState.expected = { fixture, image, model, name, round }
  const counts = Object.create(null)
  let responseText = ""
  let responseTextBytes = 0
  let finishReason
  const signal = AbortSignal.timeout(120_000)

  for await (const chunk of adapter.stream({
    provider: "grok",
    model,
    messages,
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    maxTokens: 256,
    signal,
  })) {
    if (!ALLOWED_CHUNK_TYPES.has(chunk.type)) fail("unexpected-chunk-type")
    counts[chunk.type] = (counts[chunk.type] ?? 0) + 1
    if (chunk.type === "text-delta") {
      responseTextBytes += Buffer.byteLength(chunk.text, "utf8")
      if (responseTextBytes > 16 * 1024) fail("response-text-too-large")
      responseText += chunk.text
    }
    if (chunk.type === "finish") finishReason = chunk.reason?.kind
  }

  if (requestState.expected !== undefined) fail("response-post-missing")
  if (counts.finish !== 1 || finishReason !== "stop") fail("response-not-completed")
  const normalized = responseText.trim().toLowerCase().replace(/\s+/gu, " ")
  const canonical = /^(red|blue)[.!]?$/u.exec(normalized)
  const canonicalShape = canonical !== null
  const semanticMatch = canonical?.[1] === image.expectedColor
  responseText = ""
  if (!semanticMatch) {
    writeRecord({
      kind: "image-input-semantic-gate",
      case: name,
      canonicalShape,
      fixture,
      model,
      round,
      textBytes: responseTextBytes,
      semanticMatch,
    })
    fail("semantic-mismatch")
  }

  const completed = requestState.lastCompleted
  if (
    !completed ||
    completed.model !== model ||
    completed.name !== name ||
    completed.fixture !== fixture ||
    completed.round !== round
  ) fail("response-metadata-mismatch")
  writeRecord({
    kind: "image-input-case",
    case: name,
    fixture,
    model,
    round,
    method: "POST",
    path: "/v1/responses",
    status: completed.status,
    contentType: completed.contentType,
    requestBytes: completed.requestBytes,
    imageBytes: image.data.byteLength,
    chunkCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
    textBytes: responseTextBytes,
    canonicalShape,
    counts: Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))),
    terminal: "completed",
    semanticMatch,
  })
}

function createGuardedFetch(networkFetch, requestState) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url)
    const method = String(init.method ?? (typeof input === "object" ? input.method : "GET") ?? "GET").toUpperCase()
    if (url.origin !== PROXY_ORIGIN || !["/v1/models", "/v1/responses"].includes(url.pathname)) {
      guardFail(requestState, "unexpected-origin")
    }
    if (init.redirect !== "error") guardFail(requestState, "redirect-policy-mismatch")

    if (url.pathname === "/v1/models") {
      if (method !== "GET" || init.body !== undefined) guardFail(requestState, "invalid-model-request")
      requestState.modelGets += 1
      if (requestState.modelGets > 1) guardFail(requestState, "model-request-limit")
      const response = await networkFetch(input, init)
      requireStatus(response.status, requestState)
      return response
    }

    if (method !== "POST" || requestState.expected === undefined || typeof init.body !== "string") {
      guardFail(requestState, "unexpected-response-request")
    }
    requestState.startedPosts += 1
    if (requestState.startedPosts > RESPONSE_CASE_COUNT) guardFail(requestState, "response-request-limit")
    const expected = requestState.expected
    const requestBytes = Buffer.byteLength(init.body, "utf8")
    let body
    try {
      body = JSON.parse(init.body)
    } catch {
      guardFail(requestState, "invalid-response-json")
    }
    try {
      validateWire(body, expected, expected.image)
    } catch (error) {
      if (error instanceof ImageSmokeError) requestState.guardErrorCode = error.code
      throw error
    }
    requestState.expected = undefined

    const response = await networkFetch(input, init)
    requireStatus(response.status, requestState)
    const contentType = classifyContentType(response.headers?.get?.("content-type"))
    requestState.completedPosts += 1
    requestState.lastCompleted = {
      model: expected.model,
      name: expected.name,
      fixture: expected.fixture,
      round: expected.round,
      status: response.status,
      contentType,
      requestBytes,
    }
    return response
  }
}

function validateWire(body, expected, image) {
  const allowedKeys = new Set([
    "include",
    "input",
    "max_output_tokens",
    "model",
    "reasoning",
    "store",
    "stream",
  ])
  if (
    !isPlainObject(body) ||
    Object.keys(body).length !== allowedKeys.size ||
    !Object.keys(body).every((key) => allowedKeys.has(key)) ||
    body.model !== expected.model ||
    body.stream !== true ||
    body.store !== false ||
    body.max_output_tokens !== 256 ||
    !Array.isArray(body.include) ||
    body.include.length !== 1 ||
    body.include[0] !== "reasoning.encrypted_content" ||
    !isPlainObject(body.reasoning) ||
    Object.keys(body.reasoning).length !== 1 ||
    body.reasoning.effort !== "low" ||
    !Array.isArray(body.input)
  ) fail("wire-envelope-mismatch")

  const imageUrl = `data:image/png;base64,${image.data.toString("base64")}`
  if (expected.name === "user-image") {
    const item = body.input[0]
    if (
      body.input.length !== 1 ||
      !hasExactKeys(item, ["content", "role"]) ||
      item.role !== "user" ||
      !Array.isArray(item.content) ||
      item.content.length !== 3 ||
      !hasExactKeys(item.content[0], ["text", "type"]) ||
      item.content[0]?.type !== "input_text" ||
      item.content[0]?.text !== USER_IMAGE_PREFIX ||
      !hasExactKeys(item.content[1], ["detail", "image_url", "type"]) ||
      item.content[1]?.type !== "input_image" ||
      item.content[1]?.image_url !== imageUrl ||
      item.content[1]?.detail !== "high" ||
      !hasExactKeys(item.content[2], ["text", "type"]) ||
      item.content[2]?.type !== "input_text" ||
      item.content[2]?.text !== USER_IMAGE_SUFFIX
    ) fail("user-image-wire-mismatch")
    return
  }

  if (expected.name !== "tool-result-image" || body.input.length !== 3) {
    fail("tool-image-wire-mismatch")
  }
  const [user, call, result] = body.input
  if (
    !hasExactKeys(user, ["content", "role"]) ||
    user.role !== "user" || user.content !== TOOL_USER_TEXT ||
    !hasExactKeys(call, ["arguments", "call_id", "name", "type"]) ||
    call.type !== "function_call" || call.call_id !== "image_smoke_call" ||
    call.name !== "fixture_image" || call.arguments !== "{}" ||
    !hasExactKeys(result, ["call_id", "output", "type"]) ||
    result.type !== "function_call_output" ||
    result.call_id !== "image_smoke_call" || !Array.isArray(result.output) ||
    result.output.length !== 3 ||
    !hasExactKeys(result.output[0], ["text", "type"]) ||
    result.output[0]?.type !== "input_text" ||
    result.output[0]?.text !== TOOL_RESULT_PREFIX ||
    !hasExactKeys(result.output[1], ["detail", "image_url", "type"]) ||
    result.output[1]?.type !== "input_image" || result.output[1]?.image_url !== imageUrl ||
    result.output[1]?.detail !== "high" ||
    !hasExactKeys(result.output[2], ["text", "type"]) ||
    result.output[2]?.type !== "input_text" ||
    result.output[2]?.text !== TOOL_RESULT_SUFFIX
  ) fail("tool-image-wire-mismatch")
}

function userImageMessages(ref) {
  return [{
    id: "image-smoke-user",
    role: "user",
    source: { kind: "user" },
    content: [
      { type: "text", text: USER_IMAGE_PREFIX },
      { type: "image", attachment: ref },
      { type: "text", text: USER_IMAGE_SUFFIX },
    ],
  }]
}

function toolResultImageMessages(model, ref) {
  return [
    {
      id: "tool-image-user",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: TOOL_USER_TEXT }],
    },
    {
      id: "tool-image-assistant",
      role: "assistant",
      source: { kind: "model", provider: "grok", model },
      content: [{ type: "tool-call", id: "image_smoke_call", name: "fixture_image", arguments: "{}" }],
    },
    {
      id: "tool-image-result",
      role: "user",
      source: { kind: "tool", callId: "image_smoke_call" },
      content: [{
        type: "tool-result",
        toolCallId: "image_smoke_call",
        isError: false,
        content: [
          { type: "text", text: TOOL_RESULT_PREFIX },
          { type: "image", attachment: ref },
          { type: "text", text: TOOL_RESULT_SUFFIX },
        ],
      }],
    },
  ]
}

function createSyntheticFixtures() {
  const blue = createSyntheticImage({ expectedColor: "blue", rgb: [0, 0, 255] })
  const red = createSyntheticImage({ expectedColor: "red", rgb: [255, 0, 0] })
  const images = new Map([[blue.ref.attachmentId, blue], [red.ref.attachmentId, red]])
  const store = Object.freeze({
    async readImageRequest(ref, policy, signal) {
      signal?.throwIfAborted()
      const image = images.get(ref?.attachmentId)
      if (
        image === undefined ||
        !isSameFixtureRef(ref, image.ref) ||
        policy?.maxBytes !== 4 * 1024 * 1024 ||
        policy?.maxPixels !== 16 * 1024 * 1024
      ) fail("attachment-policy-mismatch")
      return image.projection
    },
  })
  return Object.freeze({ blue, red, store })
}

function isSameFixtureRef(actual, expected) {
  return (
    hasExactKeys(actual, ["attachmentId", "bytes", "height", "mediaType", "name", "width"]) &&
    actual.attachmentId === expected.attachmentId &&
    actual.mediaType === expected.mediaType &&
    actual.bytes === expected.bytes &&
    actual.width === expected.width &&
    actual.height === expected.height &&
    actual.name === expected.name
  )
}

function createSyntheticImage({ expectedColor, rgb }) {
  const width = 128
  const height = 64
  const stride = 1 + width * 3
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * stride
    pixels[row] = 0
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3
      pixels.set(rgb, offset)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const data = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("sRGB", Buffer.from([0])),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
  const digest = createHash("sha256").update(data).digest("hex")
  const ref = Object.freeze({
    attachmentId: `sha256:${digest}`,
    mediaType: "image/png",
    bytes: data.byteLength,
    width,
    height,
    name: "synthetic-solid-color.png",
  })
  const projection = Object.freeze({
    variantId: `image-smoke:${digest}`,
    attachment: ref,
    data,
    mediaType: "image/png",
    bytes: data.byteLength,
    width,
    height,
    depth: "uchar",
    space: "srgb",
    hasAlpha: false,
  })
  return Object.freeze({ data, expectedColor, projection, ref })
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii")
  const chunk = Buffer.alloc(12 + data.byteLength)
  chunk.writeUInt32BE(data.byteLength, 0)
  typeBytes.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.byteLength)
  return chunk
}

function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function requireImageRoute(model, expectedId) {
  if (
    !isPlainObject(model) ||
    model.id !== expectedId ||
    !Array.isArray(model.inputModalities) ||
    model.inputModalities.length !== 2 ||
    model.inputModalities[0] !== "text" ||
    model.inputModalities[1] !== "image"
  ) fail("image-route-mismatch")
}

function chooseLowestEffort(model) {
  const efforts = model.reasoning?.efforts
  const low = Array.isArray(efforts) ? efforts.find((effort) => effort.id === "low") : undefined
  if (low === undefined) fail("low-reasoning-unavailable")
  return low.id
}

function requireSafeDebugEnvironment() {
  for (const name of ["DEBUG", "NODE_DEBUG", "NODE_OPTIONS", "UNDICI_DEBUG"]) {
    if (typeof process.env[name] === "string" && process.env[name].length > 0) {
      fail("unsafe-debug-environment")
    }
  }
}

function classifyContentType(value) {
  if (typeof value !== "string") return "other"
  const normalized = value.toLowerCase()
  if (normalized.startsWith("application/json")) return "application/json"
  if (normalized.startsWith("text/event-stream")) return "text/event-stream"
  return "other"
}

function requireStatus(status, requestState) {
  if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
    guardFail(requestState, "invalid-http-status")
  }
}

function writeRecord(record) {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}

function fail(code, status) {
  throw new ImageSmokeError(code, status)
}

function guardFail(requestState, code) {
  requestState.guardErrorCode = code
  fail(code)
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value).sort()
  return keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index])
}

main().catch((error) => {
  const known = error instanceof ImageSmokeError
  const transportStatus = error?.name === "GrokTransportError" && Number.isSafeInteger(error.status)
    ? error.status
    : undefined
  writeRecord({
    kind: "image-input-smoke",
    status: "failed",
    errorCode: REQUEST_STATE.guardErrorCode ?? (known ? error.code : sanitizeErrorName(error?.name)),
    ...(known && Number.isSafeInteger(error.status)
      ? { httpStatus: error.status }
      : transportStatus === undefined ? {} : { httpStatus: transportStatus }),
  })
  process.exitCode = 1
})

function sanitizeErrorName(name) {
  if (name === "GrokTransportError") return "transport-failed"
  if (
    name === "CredentialFileTooLargeError" ||
    name === "OfficialCredentialFileError" ||
    name === "UnsupportedCredentialError"
  ) return "credential-failed"
  if (name === "AbortError" || name === "TimeoutError") return "aborted"
  if (name === "InvalidResponsesStreamError") return "invalid-event-stream"
  return "unexpected"
}

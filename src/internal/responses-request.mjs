import { createHash } from "node:crypto"

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const MAX_CALL_ID_BYTES = 1024
const MAX_TEXT_LENGTH = 8 * 1024 * 1024
const MAX_REQUEST_BYTES = 16 * 1024 * 1024
const MAX_MESSAGES = 10_000
const MAX_TOOLS = 128

export class UnsupportedResponsesRequestError extends Error {
  constructor() {
    super("The Harness request contains content or options unsupported by Grok Responses")
    this.name = "UnsupportedResponsesRequestError"
  }
}

export class ResponsesRequestTooLargeError extends UnsupportedResponsesRequestError {
  constructor() {
    super()
    this.name = "ResponsesRequestTooLargeError"
  }
}

export function createResponsesRequestEncoder(options) {
  const captured = captureResponsesRequestOptions(options)
  if (
    captured.provider !== "grok" ||
    !isId(captured.model) ||
    !Array.isArray(captured.messages) ||
    captured.messages.length > MAX_MESSAGES
  ) {
    throw new UnsupportedResponsesRequestError()
  }
  if (captured.stop !== undefined && (!Array.isArray(captured.stop) || captured.stop.length > 0)) {
    throw new UnsupportedResponsesRequestError()
  }
  const messages = captureMessages(captured.messages, captured.model)

  const fields = freezeTree({
    ...(captured.system === undefined ? {} : { instructions: parseText(captured.system) }),
    ...(captured.tools === undefined ? {} : { tools: encodeTools(captured.tools) }),
    ...(captured.reasoningEffort === undefined
      ? {}
      : { reasoning: { effort: parseId(captured.reasoningEffort) } }),
    ...(captured.temperature === undefined
      ? {}
      : { temperature: parseTemperature(captured.temperature) }),
    ...(captured.maxTokens === undefined
      ? {}
      : { max_output_tokens: parseMaxTokens(captured.maxTokens) }),
  })
  const state = Object.freeze({
    defaultMessages: messages,
    fields,
    model: captured.model,
  })
  requireRequestFits(assembleRequest(state, []))

  return Object.freeze(({
    messages = state.defaultMessages,
    requestImages,
  } = {}) => {
    const capturedMessages = messages === state.defaultMessages
      ? messages
      : captureMessages(messages, state.model)
    const request = assembleRequest(
      state,
      encodeMessages(capturedMessages, state.model, requestImages),
    )
    requireRequestFits(request)
    return request
  })
}

export function captureResponsesRequestOptions(options) {
  if (!isPlainObject(options)) throw new UnsupportedResponsesRequestError()
  const messages = readOwnDataProperty(options, "messages")
  const tools = readOwnDataProperty(options, "tools")
  const stop = readOwnDataProperty(options, "stop")
  return Object.freeze({
    provider: readOwnDataProperty(options, "provider"),
    model: readOwnDataProperty(options, "model"),
    messages: captureDataArray(messages, MAX_MESSAGES),
    system: readOwnDataProperty(options, "system"),
    tools: tools === undefined ? undefined : captureDataArray(tools, MAX_TOOLS),
    reasoningEffort: readOwnDataProperty(options, "reasoningEffort"),
    temperature: readOwnDataProperty(options, "temperature"),
    maxTokens: readOwnDataProperty(options, "maxTokens"),
    stop: stop === undefined ? undefined : captureDataArray(stop, 0),
    signal: readOwnDataProperty(options, "signal"),
  })
}

export function captureResponsesRequestMessages(messages, targetModel, maxContentBlocks) {
  return captureMessages(messages, targetModel, maxContentBlocks)
}

export function encodeResponsesRequest(options, { requestImages } = {}) {
  return createResponsesRequestEncoder(options)({ requestImages })
}

function assembleRequest(state, input) {
  return {
    model: state.model,
    input,
    ...state.fields,
    include: ["reasoning.encrypted_content"],
    stream: true,
    store: false,
  }
}

function requireRequestFits(request) {
  let serialized
  try {
    serialized = JSON.stringify(request)
  } catch {
    throw new UnsupportedResponsesRequestError()
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) {
    throw new ResponsesRequestTooLargeError()
  }
}

function freezeTree(value) {
  const pending = [value]
  const seen = new WeakSet()
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === null || typeof current !== "object" || seen.has(current)) continue
    seen.add(current)
    for (const nested of Object.values(current)) pending.push(nested)
    Object.freeze(current)
  }
  return value
}

function encodeMessages(messages, targetModel, requestImages) {
  const input = []
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (!isPlainObject(message)) fail()
    const content = captureDataArray(message.content)
    if (message.source?.kind === "tool") {
      encodeToolResultMessage(message, content, input, requestImages)
      continue
    }
    if (message.role !== "user" && message.role !== "assistant" && message.role !== "system") fail()
    encodeOrdinaryMessage(message, content, input, targetModel, requestImages)
  }
  return input
}

function encodeOrdinaryMessage(message, content, input, targetModel, requestImages) {
  if (contentHasImage(content)) {
    encodeImageMessage(message, content, input, requestImages)
    return
  }
  const replayBlocks = readReplayBlocks(message, targetModel, content.length)
  let text = ""
  const flushText = () => {
    if (text.length === 0) return
    input.push({ role: message.role, content: text })
    text = ""
  }

  for (let position = 0; position < content.length; position += 1) {
    const block = content[position]
    if (!isPlainObject(block) || typeof block.type !== "string") fail()
    if (block.type === "text") {
      text += parseText(block.text)
      if (text.length > MAX_TEXT_LENGTH) fail()
      continue
    }
    if (block.type === "reasoning" && message.role === "assistant") {
      const replay = replayBlocks?.[position]
      if (isReasoningReplay(replay)) {
        flushText()
        input.push({
          type: "reasoning",
          id: replay.id,
          encrypted_content: replay.encryptedContent,
          summary: block.text.length === 0
            ? []
            : [{ type: "summary_text", text: parseText(block.text) }],
        })
      }
      continue
    }
    if (block.type === "tool-call" && message.role === "assistant") {
      flushText()
      if (!isId(block.name) || !isJsonObject(block.arguments)) fail()
      input.push({
        type: "function_call",
        call_id: encodeCallId(block.id),
        name: block.name,
        arguments: block.arguments,
      })
      continue
    }
    fail()
  }
  flushText()
}

function contentHasImage(content) {
  for (let index = 0; index < content.length; index += 1) {
    const block = content[index]
    if (isPlainObject(block) && block.type === "image") return true
  }
  return false
}

function encodeImageMessage(message, contentBlocks, input, requestImages) {
  if (message.role !== "user" || !(requestImages instanceof Map)) fail()
  const content = []
  let text = ""
  const flushText = () => {
    if (text.length === 0) return
    content.push({ type: "input_text", text })
    text = ""
  }

  for (let index = 0; index < contentBlocks.length; index += 1) {
    const block = contentBlocks[index]
    if (!isPlainObject(block) || typeof block.type !== "string") fail()
    if (block.type === "text") {
      text += parseText(block.text)
      if (text.length > MAX_TEXT_LENGTH) fail()
      continue
    }
    if (block.type !== "image" || !isPlainObject(block.attachment)) fail()
    flushText()
    content.push(encodeRequestImage(block, requestImages))
  }
  flushText()
  if (content.length === 0) fail()
  input.push({ role: "user", content })
}

function toBase64(data) {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("base64")
}

function readReplayBlocks(message, targetModel, contentLength) {
  const source = message.source
  if (
    !isPlainObject(source) ||
    source.kind !== "model" ||
    source.provider !== "grok" ||
    source.model !== targetModel ||
    !isPlainObject(source.replayState) ||
    !isPlainObject(source.replayState.response) ||
    source.replayState.response.version !== 1 ||
    !Array.isArray(source.replayState.blocks) ||
    source.replayState.blocks.length !== contentLength
  ) return undefined
  return source.replayState.blocks
}

function isReasoningReplay(value) {
  return isPlainObject(value) &&
    value.type === "reasoning" &&
    isId(value.id) &&
    typeof value.encryptedContent === "string" &&
    value.encryptedContent.length > 0 &&
    Buffer.byteLength(value.encryptedContent, "utf8") <= MAX_TEXT_LENGTH
}

function encodeToolResultMessage(message, messageContent, input, requestImages) {
  if (
    message.role !== "user" ||
    messageContent.length !== 1 ||
    !isPlainObject(messageContent[0]) ||
    messageContent[0].type !== "tool-result"
  ) fail()
  const result = messageContent[0]
  const resultContent = captureDataArray(result.content)
  if (
    result.toolCallId !== message.source.callId
  ) fail()

  const hasImage = contentHasImage(resultContent)
  if (hasImage) {
    if (!(requestImages instanceof Map)) fail()
    const output = []
    let text = ""
    const flushText = () => {
      if (text.length === 0) return
      output.push({ type: "input_text", text })
      text = ""
    }
    for (let index = 0; index < resultContent.length; index += 1) {
      const block = resultContent[index]
      if (!isPlainObject(block) || typeof block.type !== "string") fail()
      if (block.type === "text") {
        text += parseText(block.text)
        if (text.length > MAX_TEXT_LENGTH) fail()
        continue
      }
      if (block.type !== "image" || !isPlainObject(block.attachment)) fail()
      flushText()
      output.push(encodeRequestImage(block, requestImages))
    }
    flushText()
    if (output.length === 0) fail()
    input.push({
      type: "function_call_output",
      call_id: encodeCallId(result.toolCallId),
      output,
    })
    return
  }

  let output = ""
  for (let index = 0; index < resultContent.length; index += 1) {
    const block = resultContent[index]
    if (!isPlainObject(block) || block.type !== "text") fail()
    output += parseText(block.text)
    if (output.length > MAX_TEXT_LENGTH) fail()
  }
  input.push({ type: "function_call_output", call_id: encodeCallId(result.toolCallId), output })
}

function encodeRequestImage(block, requestImages) {
  const image = requestImages.get(block.attachment)
  if (!isPlainObject(image) || typeof image.mediaType !== "string" || !(image.data instanceof Uint8Array)) {
    fail()
  }
  return {
    type: "input_image",
    image_url: `data:${image.mediaType};base64,${toBase64(image.data)}`,
    detail: "high",
  }
}

function encodeCallId(value) {
  if (isId(value)) return value
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > MAX_CALL_ID_BYTES
  ) fail()
  const digest = createHash("sha256").update(value, "utf8").digest("base64url")
  return `dsh_call_${digest}`
}

function encodeTools(tools) {
  if (tools.length > MAX_TOOLS) fail()
  const names = new Set()
  const encoded = []
  for (let index = 0; index < tools.length; index += 1) {
    const tool = tools[index]
    if (!isPlainObject(tool)) fail()
    const name = readOwnDataProperty(tool, "name")
    const description = readOwnDataProperty(tool, "description")
    const parameters = readOwnDataProperty(tool, "parameters")
    if (
      !isId(name) ||
      names.has(name) ||
      typeof description !== "string" ||
      description.length > 4096 ||
      !isPlainObject(parameters)
    ) fail()
    names.add(name)
    encoded.push({
      type: "function",
      name,
      description,
      parameters: cloneJsonObject(parameters),
    })
  }
  return encoded
}

function captureMessages(messages, targetModel, maxContentBlocks) {
  const values = captureDataArray(messages, MAX_MESSAGES)
  const budget = maxContentBlocks === undefined
    ? undefined
    : { remaining: maxContentBlocks }
  const snapshots = new Array(values.length)
  for (let index = 0; index < values.length; index += 1) {
    const message = values[index]
    if (!isPlainObject(message)) fail()
    const content = captureContent(readOwnDataProperty(message, "content"), 0, budget)
    snapshots[index] = Object.freeze({
      role: readOwnDataProperty(message, "role"),
      source: captureMessageSource(
        readOwnDataProperty(message, "source"),
        targetModel,
        content.length,
      ),
      content,
    })
  }
  return Object.freeze(snapshots)
}

function captureContent(content, depth, budget) {
  const values = captureDataArray(content, budget?.remaining)
  if (budget !== undefined) budget.remaining -= values.length
  const snapshots = new Array(values.length)
  for (let index = 0; index < values.length; index += 1) {
    const block = values[index]
    if (!isPlainObject(block)) fail()
    const type = readOwnDataProperty(block, "type")
    if (type === "text" || type === "reasoning") {
      snapshots[index] = Object.freeze({
        type,
        text: readOwnDataProperty(block, "text"),
      })
    } else if (type === "image") {
      snapshots[index] = Object.freeze({
        type,
        attachment: readOwnDataProperty(block, "attachment"),
      })
    } else if (type === "tool-call") {
      snapshots[index] = Object.freeze({
        type,
        id: readOwnDataProperty(block, "id"),
        name: readOwnDataProperty(block, "name"),
        arguments: readOwnDataProperty(block, "arguments"),
      })
    } else if (type === "tool-result") {
      snapshots[index] = depth > 0
        ? Object.freeze({ type })
        : Object.freeze({
          type,
          toolCallId: readOwnDataProperty(block, "toolCallId"),
          content: captureContent(readOwnDataProperty(block, "content"), depth + 1, budget),
        })
    } else {
      snapshots[index] = Object.freeze({ type })
    }
  }
  return Object.freeze(snapshots)
}

function captureMessageSource(source, targetModel, contentLength) {
  if (!isPlainObject(source)) return Object.freeze({})
  const kind = readOwnDataProperty(source, "kind")
  const provider = readOwnDataProperty(source, "provider")
  const model = readOwnDataProperty(source, "model")
  const snapshot = {
    kind,
    callId: readOwnDataProperty(source, "callId"),
    provider,
    model,
  }
  if (kind === "model" && provider === "grok" && model === targetModel) {
    const replayState = captureReplayState(
      readOwnDataProperty(source, "replayState"),
      contentLength,
    )
    if (replayState !== undefined) snapshot.replayState = replayState
  }
  return Object.freeze(snapshot)
}

function captureReplayState(replayState, contentLength) {
  if (!isPlainObject(replayState)) return undefined
  const response = readOwnDataProperty(replayState, "response")
  const blocks = readOwnDataProperty(replayState, "blocks")
  if (
    !isPlainObject(response) ||
    !Array.isArray(blocks) ||
    readDataArrayLength(blocks) !== contentLength
  ) return undefined
  const blockValues = captureDataArray(blocks)
  const blockSnapshots = new Array(blockValues.length)
  for (let index = 0; index < blockValues.length; index += 1) {
    const block = blockValues[index]
    if (!isPlainObject(block)) {
      blockSnapshots[index] = Object.freeze({})
      continue
    }
    blockSnapshots[index] = Object.freeze({
      type: readOwnDataProperty(block, "type"),
      id: readOwnDataProperty(block, "id"),
      encryptedContent: readOwnDataProperty(block, "encryptedContent"),
    })
  }
  return Object.freeze({
    response: Object.freeze({ version: readOwnDataProperty(response, "version") }),
    blocks: Object.freeze(blockSnapshots),
  })
}

function cloneJsonObject(value) {
  let serialized
  let cloned
  try {
    serialized = JSON.stringify(value)
    if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > 1024 * 1024) fail()
    cloned = JSON.parse(serialized)
  } catch (error) {
    if (error instanceof UnsupportedResponsesRequestError) throw error
    fail()
  }
  if (!isPlainObject(cloned)) fail()
  return cloned
}

function parseText(value) {
  if (typeof value !== "string" || value.length > MAX_TEXT_LENGTH) fail()
  return value
}

function parseId(value) {
  if (!isId(value)) fail()
  return value
}

function parseTemperature(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 2) fail()
  return value
}

function parseMaxTokens(value) {
  if (!Number.isSafeInteger(value) || value <= 0) fail()
  return value
}

function isJsonObject(value) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 2 * 1024 * 1024) return false
  try {
    return isPlainObject(JSON.parse(value))
  } catch {
    return false
  }
}

function isId(value) {
  return typeof value === "string" && ID_PATTERN.test(value)
}

function fail() {
  throw new UnsupportedResponsesRequestError()
}

function readOwnDataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  if (descriptor === undefined) return undefined
  if (!("value" in descriptor)) fail()
  return descriptor.value
}

function captureDataArray(value, maxLength = Number.MAX_SAFE_INTEGER) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail()
  const length = readDataArrayLength(value)
  if (length > maxLength) fail()
  const keys = Reflect.ownKeys(value)
  if (keys.length !== length + 1) fail()
  const snapshot = new Array(length)
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || !("value" in descriptor)) fail()
    snapshot[index] = descriptor.value
  }
  return Object.freeze(snapshot)
}

function readDataArrayLength(value) {
  const descriptor = Object.getOwnPropertyDescriptor(value, "length")
  if (descriptor === undefined || !("value" in descriptor)) fail()
  return descriptor.value
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

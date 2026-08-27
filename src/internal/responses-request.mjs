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

export function encodeResponsesRequest(options) {
  if (
    !isPlainObject(options) ||
    options.provider !== "grok" ||
    !isId(options.model) ||
    !Array.isArray(options.messages) ||
    options.messages.length > MAX_MESSAGES
  ) {
    throw new UnsupportedResponsesRequestError()
  }
  if (options.stop !== undefined && (!Array.isArray(options.stop) || options.stop.length > 0)) {
    throw new UnsupportedResponsesRequestError()
  }

  const request = {
    model: options.model,
    input: encodeMessages(options.messages, options.model),
    ...(options.system === undefined ? {} : { instructions: parseText(options.system) }),
    ...(options.tools === undefined ? {} : { tools: encodeTools(options.tools) }),
    ...(options.reasoningEffort === undefined
      ? {}
      : { reasoning: { effort: parseId(options.reasoningEffort) } }),
    ...(options.temperature === undefined
      ? {}
      : { temperature: parseTemperature(options.temperature) }),
    ...(options.maxTokens === undefined
      ? {}
      : { max_output_tokens: parseMaxTokens(options.maxTokens) }),
    include: ["reasoning.encrypted_content"],
    stream: true,
    store: false,
  }

  let serialized
  try {
    serialized = JSON.stringify(request)
  } catch {
    throw new UnsupportedResponsesRequestError()
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) {
    throw new UnsupportedResponsesRequestError()
  }
  return request
}

function encodeMessages(messages, targetModel) {
  const input = []
  for (const message of messages) {
    if (!isPlainObject(message) || !Array.isArray(message.content)) fail()
    if (message.source?.kind === "tool") {
      encodeToolResultMessage(message, input)
      continue
    }
    if (message.role !== "user" && message.role !== "assistant" && message.role !== "system") fail()
    encodeOrdinaryMessage(message, input, targetModel)
  }
  return input
}

function encodeOrdinaryMessage(message, input, targetModel) {
  const replayBlocks = readReplayBlocks(message, targetModel)
  let text = ""
  const flushText = () => {
    if (text.length === 0) return
    input.push({ role: message.role, content: text })
    text = ""
  }

  for (const [position, block] of message.content.entries()) {
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

function readReplayBlocks(message, targetModel) {
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
    source.replayState.blocks.length !== message.content.length
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

function encodeToolResultMessage(message, input) {
  if (
    message.role !== "user" ||
    message.content.length !== 1 ||
    !isPlainObject(message.content[0]) ||
    message.content[0].type !== "tool-result"
  ) fail()
  const result = message.content[0]
  if (
    result.toolCallId !== message.source.callId ||
    !Array.isArray(result.content)
  ) fail()

  let output = ""
  for (const block of result.content) {
    if (!isPlainObject(block) || block.type !== "text") fail()
    output += parseText(block.text)
    if (output.length > MAX_TEXT_LENGTH) fail()
  }
  input.push({ type: "function_call_output", call_id: encodeCallId(result.toolCallId), output })
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
  if (!Array.isArray(tools) || tools.length > MAX_TOOLS) fail()
  const names = new Set()
  return tools.map((tool) => {
    if (
      !isPlainObject(tool) ||
      !isId(tool.name) ||
      names.has(tool.name) ||
      typeof tool.description !== "string" ||
      tool.description.length > 4096 ||
      !isPlainObject(tool.parameters)
    ) fail()
    names.add(tool.name)
    return {
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: cloneJsonObject(tool.parameters),
    }
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

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

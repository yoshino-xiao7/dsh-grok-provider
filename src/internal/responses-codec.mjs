const MAX_EVENTS = 100_000
const MAX_BLOCK_TEXT_BYTES = 8 * 1024 * 1024
const MAX_TOOL_ARGUMENT_BYTES = 2 * 1024 * 1024
const MAX_ENCRYPTED_REASONING_BYTES = 8 * 1024 * 1024

export class InvalidResponsesStreamError extends Error {
  constructor() {
    super("The Grok Responses stream is invalid or incomplete")
    this.name = "InvalidResponsesStreamError"
  }
}

export function decodeResponsesEvents(events) {
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS) {
    throw new InvalidResponsesStreamError()
  }

  const chunks = []
  const decoder = createResponsesEventDecoder()
  for (const event of events) chunks.push(...decoder.push(event))
  decoder.finish()
  return chunks
}

export function createResponsesEventDecoder() {
  const blocks = new Map()
  const replayBlocks = []
  let lastSequence = -1
  let created = false
  let inProgress = false
  let completed = false
  let sawToolCall = false
  let sawOutput = false
  let eventCount = 0

  return Object.freeze({
    push(event) {
      eventCount += 1
      if (eventCount > MAX_EVENTS || !isPlainObject(event) || typeof event.type !== "string") fail()
      if (!Number.isSafeInteger(event.sequence_number) || event.sequence_number <= lastSequence) fail()
      lastSequence = event.sequence_number
      if (completed) fail()
      const chunks = []

      switch (event.type) {
        case "response.created":
          if (created || !isResponseStatus(event.response, "in_progress")) fail()
          created = true
          break

        case "response.in_progress":
          if (!created || inProgress || !isResponseStatus(event.response, "in_progress")) fail()
          inProgress = true
          break

        case "response.output_item.added":
          requireRunning(created, inProgress)
          sawOutput = true
          if (addOutputItem(event, blocks, replayBlocks, chunks) === "tool-call") sawToolCall = true
          break

        case "response.reasoning_summary_part.added":
          requireBlock(event, blocks, "reasoning")
          if (!isPlainObject(event.part) || event.part.type !== "summary_text" || event.part.text !== "") fail()
          break

        case "response.reasoning_summary_text.delta": {
          const block = requireBlock(event, blocks, "reasoning")
          appendDelta(block, event.delta)
          chunks.push({ type: "reasoning-delta", index: event.output_index, text: event.delta })
          break
        }

        case "response.reasoning_summary_text.done": {
          const block = requireBlock(event, blocks, "reasoning")
          if (event.text !== block.text) fail()
          break
        }

        case "response.reasoning_summary_part.done": {
          const block = requireBlock(event, blocks, "reasoning")
          if (!isPlainObject(event.part) || event.part.type !== "summary_text" || event.part.text !== block.text) fail()
          break
        }

        case "response.content_part.added": {
          requireBlock(event, blocks, "text")
          if (!isPlainObject(event.part) || event.part.type !== "output_text" || event.part.text !== "") fail()
          break
        }

        case "response.output_text.delta": {
          const block = requireBlock(event, blocks, "text")
          appendDelta(block, event.delta)
          chunks.push({ type: "text-delta", index: event.output_index, text: event.delta })
          break
        }

        case "response.output_text.done": {
          const block = requireBlock(event, blocks, "text")
          if (event.text !== block.text) fail()
          break
        }

        case "response.function_call_arguments.delta": {
          const block = requireBlock(event, blocks, "tool-call")
          appendToolArguments(block, event.delta)
          chunks.push({
            type: "tool-call-delta",
            index: event.output_index,
            id: block.callId,
            ...(block.nameEmitted ? {} : { name: block.name }),
            argumentsDelta: event.delta,
          })
          block.nameEmitted = true
          break
        }

        case "response.function_call_arguments.done": {
          const block = requireBlock(event, blocks, "tool-call")
          if (event.name !== block.name || event.arguments !== block.arguments) fail()
          break
        }

        case "response.content_part.done": {
          const block = requireBlock(event, blocks, "text")
          if (!isPlainObject(event.part) || event.part.type !== "output_text" || event.part.text !== block.text) fail()
          break
        }

        case "response.output_item.done":
          closeOutputItem(event, blocks, replayBlocks, chunks)
          break

        case "response.completed":
          requireRunning(created, inProgress)
          if (!sawOutput || blocks.size !== 0 || !isResponseStatus(event.response, "completed")) fail()
          chunks.push({ type: "usage", usage: parseUsage(event.response.usage) })
          chunks.push({
            type: "finish",
            reason: { kind: sawToolCall ? "tool-calls" : "stop" },
            ...(replayBlocks.some((block) => block !== null)
              ? {
                replayState: {
                  response: { version: 1 },
                  blocks: replayBlocks,
                },
              }
              : {}),
          })
          completed = true
          break

        case "response.incomplete":
          requireRunning(created, inProgress)
          if (
            !sawOutput ||
            !isResponseStatus(event.response, "incomplete") ||
            !isPlainObject(event.response.incomplete_details) ||
            event.response.incomplete_details.reason !== "max_output_tokens"
          ) fail()
          for (const [index, block] of blocks) {
            if (block.type === "tool-call") fail()
            chunks.push({
              type: "block-end",
              index,
              block: { type: block.type, text: block.text },
            })
          }
          blocks.clear()
          chunks.push({ type: "usage", usage: parseUsage(event.response.usage) })
          chunks.push({ type: "finish", reason: { kind: "max-tokens" } })
          completed = true
          break

        default:
          fail()
      }
      return chunks
    },

    finish() {
      if (!completed || blocks.size !== 0) fail()
    },
  })
}

function addOutputItem(event, blocks, replayBlocks, chunks) {
  const index = parseIndex(event.output_index)
  if (blocks.has(index) || !isPlainObject(event.item) || !isBoundedString(event.item.id, 256)) fail()

  let type
  let block
  if (event.item.type === "reasoning") {
    type = "reasoning"
    block = { id: event.item.id, type, text: "" }
  } else if (event.item.type === "message" && event.item.role === "assistant") {
    type = "text"
    block = { id: event.item.id, type, text: "" }
  } else if (
    event.item.type === "function_call" &&
    event.item.status === "in_progress" &&
    event.item.arguments === "" &&
    isBoundedString(event.item.call_id, 256) &&
    isBoundedString(event.item.name, 128)
  ) {
    type = "tool-call"
    block = {
      id: event.item.id,
      type,
      callId: event.item.call_id,
      name: event.item.name,
      nameEmitted: false,
      arguments: "",
    }
  }
  else fail()

  block.replayPosition = replayBlocks.length
  replayBlocks.push(null)
  blocks.set(index, block)
  chunks.push({ type: "block-start", index, blockType: type })
  return type
}

function closeOutputItem(event, blocks, replayBlocks, chunks) {
  const block = requireBlock(event, blocks)
  if (
    !isPlainObject(event.item) ||
    event.item.id !== block.id ||
    event.item.status !== "completed"
  ) fail()
  if (block.type === "reasoning") {
    if (
      event.item.type !== "reasoning" ||
      !Array.isArray(event.item.summary) ||
      event.item.summary.length !== 1 ||
      !isPlainObject(event.item.summary[0]) ||
      event.item.summary[0].type !== "summary_text" ||
      event.item.summary[0].text !== block.text
    ) fail()
    if (event.item.encrypted_content !== undefined) {
      if (!isBoundedUtf8String(event.item.encrypted_content, MAX_ENCRYPTED_REASONING_BYTES)) fail()
      replayBlocks[block.replayPosition] = {
        type: "reasoning",
        id: block.id,
        encryptedContent: event.item.encrypted_content,
      }
    }
  }
  if (block.type === "text" && (event.item.type !== "message" || event.item.role !== "assistant")) fail()
  if (block.type === "tool-call" && (
    event.item.type !== "function_call" ||
    event.item.call_id !== block.callId ||
    event.item.name !== block.name ||
    event.item.arguments !== block.arguments ||
    !isJsonObject(block.arguments)
  )) fail()

  chunks.push({
    type: "block-end",
    index: event.output_index,
    block: block.type === "tool-call"
      ? { type: "tool-call", id: block.callId, name: block.name, arguments: block.arguments }
      : { type: block.type, text: block.text },
  })
  blocks.delete(event.output_index)
}

function appendToolArguments(block, delta) {
  if (typeof delta !== "string" || delta.length === 0) fail()
  block.arguments += delta
  if (Buffer.byteLength(block.arguments, "utf8") > MAX_TOOL_ARGUMENT_BYTES) fail()
}

function requireBlock(event, blocks, expectedType) {
  const index = parseIndex(event.output_index)
  const block = blocks.get(index)
  if (!block || (expectedType !== undefined && block.type !== expectedType)) fail()
  if (event.item_id !== undefined && event.item_id !== block.id) fail()
  return block
}

function appendDelta(block, delta) {
  if (typeof delta !== "string" || delta.length === 0) fail()
  block.text += delta
  if (Buffer.byteLength(block.text, "utf8") > MAX_BLOCK_TEXT_BYTES) fail()
}

function parseUsage(usage) {
  if (!isPlainObject(usage)) fail()
  const inputTokens = parseCount(usage.input_tokens)
  const outputTokens = parseCount(usage.output_tokens)
  const cachedTokens = usage.input_tokens_details === undefined
    ? 0
    : parseCountFrom(usage.input_tokens_details, "cached_tokens")
  const reasoningTokens = usage.output_tokens_details === undefined
    ? 0
    : parseCountFrom(usage.output_tokens_details, "reasoning_tokens")
  if (cachedTokens > inputTokens) fail()

  return {
    inputTokens: inputTokens - cachedTokens,
    outputTokens,
    ...(cachedTokens === 0 ? {} : { cacheReadTokens: cachedTokens }),
    ...(reasoningTokens === 0 ? {} : { reasoningTokens }),
  }
}

function parseCountFrom(value, field) {
  if (!isPlainObject(value)) fail()
  return parseCount(value[field] ?? 0)
}

function parseCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail()
  return value
}

function parseIndex(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail()
  return value
}

function isResponseStatus(value, status) {
  return isPlainObject(value) && value.status === status
}

function isBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
}

function isBoundedUtf8String(value, maxBytes) {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= maxBytes
}

function isJsonObject(value) {
  try {
    return isPlainObject(JSON.parse(value))
  } catch {
    return false
  }
}

function requireRunning(created, inProgress) {
  if (!created || !inProgress) fail()
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function fail() {
  throw new InvalidResponsesStreamError()
}

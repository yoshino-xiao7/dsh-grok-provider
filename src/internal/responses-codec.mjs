const MAX_EVENTS = 100_000
const MAX_BLOCK_TEXT_BYTES = 8 * 1024 * 1024
const MAX_TOOL_ARGUMENT_BYTES = 2 * 1024 * 1024
const MAX_ENCRYPTED_REASONING_BYTES = 8 * 1024 * 1024
const MAX_ANNOTATIONS = 1_024
const MAX_CITATIONS = 1_024
const MAX_CITATION_URL_BYTES = 16 * 1024
const MAX_CITATION_TITLE_BYTES = 8 * 1024
const MAX_SEARCH_QUERY_BYTES = 256 * 1024
const MAX_SEARCH_SOURCES = 256
const MAX_DISCARDED_SOURCE_BYTES = 512 * 1024
const MAX_DISCARDED_SOURCE_NODES = 4_096
const MAX_DISCARDED_SOURCE_KEYS = 32
const MAX_DISCARDED_SOURCE_ARRAY_ITEMS = 256
const MAX_DISCARDED_SOURCE_DEPTH = 4
const MAX_DISCARDED_STRING_BYTES = 16 * 1024
const MAX_FUNCTION_NAMES = 128
const FUNCTION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SERVER_TOOL_NAMES = new Set(["web_search", "x_search"])
const X_SEARCH_FUNCTION_NAMES = new Set([
  "x_user_search",
  "x_keyword_search",
  "x_semantic_search",
  "x_thread_fetch",
])

export class InvalidResponsesStreamError extends Error {
  constructor() {
    super("The Grok Responses stream is invalid or incomplete")
    this.name = "InvalidResponsesStreamError"
  }
}

export function decodeResponsesEvents(events, receipt) {
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS) {
    throw new InvalidResponsesStreamError()
  }

  const chunks = []
  const decoder = createResponsesEventDecoder(receipt)
  for (const event of events) chunks.push(...decoder.push(event))
  decoder.finish()
  return chunks
}

export function createResponsesEventDecoder(receipt) {
  const responsePolicy = captureResponseReceipt(receipt)
  const blocks = new Map()
  const serverCalls = new Map()
  const completedServerCalls = []
  const outputIndexes = new Set()
  const itemLifecycles = new Map()
  const callIds = new Set()
  const replayBlocks = []
  let nextOutputIndex = 0
  let lastSequence = -1
  let responseId
  let created = false
  let inProgress = false
  let completed = false
  let sawFunctionCall = false
  let sawVisibleOutput = false
  let sawServerTool = false
  let streamedAnnotationCount = 0
  let eventCount = 0

  return Object.freeze({
    push(event) {
      eventCount += 1
      if (eventCount > MAX_EVENTS || !isPlainObject(event) || typeof event.type !== "string") fail()
      if (
        !Number.isSafeInteger(event.sequence_number) ||
        event.sequence_number !== lastSequence + 1
      ) fail()
      lastSequence = event.sequence_number
      if (completed) fail()
      const chunks = []

      switch (event.type) {
        case "response.created":
          if (created || !isResponseStatus(event.response, "in_progress")) fail()
          responseId = captureResponseId(event.response)
          if (validateResponseMetadata(event.response, responsePolicy)) fail()
          created = true
          break

        case "response.in_progress":
          if (!created || inProgress || !isResponseStatus(event.response, "in_progress")) fail()
          requireResponseId(event.response, responseId)
          if (validateResponseMetadata(event.response, responsePolicy)) fail()
          inProgress = true
          break

        case "response.output_item.added": {
          requireRunning(created, inProgress)
          const outputIndex = parseIndex(event.output_index)
          if (outputIndex !== nextOutputIndex || outputIndexes.has(outputIndex)) fail()
          outputIndexes.add(outputIndex)
          const type = addOutputItem(
            event,
            blocks,
            serverCalls,
            completedServerCalls,
            itemLifecycles,
            callIds,
            replayBlocks,
            chunks,
            responsePolicy,
          )
          nextOutputIndex += 1
          if (type === "tool-call") sawFunctionCall = true
          if (type === "web-search" || type === "x-search") sawServerTool = true
          break
        }

        case "response.reasoning_summary_part.added": {
          const block = requireBlock(event, blocks, "reasoning")
          if (
            block.reusedReasoning ||
            block.reasoningAddedStatus !== "in_progress" ||
            block.reasoningMode !== undefined ||
            block.summaryStarted ||
            block.summaryTextDone ||
            block.summaryDone
          ) fail()
          if (!isPlainObject(event.part) || event.part.type !== "summary_text" || event.part.text !== "") fail()
          block.reasoningMode = "summary"
          block.summaryStarted = true
          break
        }

        case "response.reasoning_summary_text.delta": {
          const block = requireBlock(event, blocks, "reasoning")
          if (
            block.reasoningMode !== "summary" ||
            !block.summaryStarted ||
            block.summaryTextDone ||
            block.summaryDone
          ) fail()
          appendDelta(block, event.delta)
          sawVisibleOutput = true
          chunks.push({ type: "reasoning-delta", index: event.output_index, text: event.delta })
          break
        }

        case "response.reasoning_summary_text.done": {
          const block = requireBlock(event, blocks, "reasoning")
          if (
            block.reasoningMode !== "summary" ||
            !block.summaryStarted ||
            block.summaryTextDone ||
            block.summaryDone ||
            event.text !== block.text
          ) fail()
          block.summaryTextDone = true
          break
        }

        case "response.reasoning_summary_part.done": {
          const block = requireBlock(event, blocks, "reasoning")
          if (
            block.reasoningMode !== "summary" ||
            !block.summaryStarted ||
            !block.summaryTextDone ||
            block.summaryDone ||
            !isPlainObject(event.part) ||
            event.part.type !== "summary_text" ||
            event.part.text !== block.text
          ) fail()
          block.summaryDone = true
          break
        }

        case "response.content_part.added": {
          const block = requireBlock(event, blocks)
          if (block.contentStarted) fail()
          if (block.type === "reasoning") {
            if (
              block.reusedReasoning ||
              block.reasoningAddedStatus !== "in_progress" ||
              block.reasoningMode !== undefined
            ) fail()
            requireRawContentLocation(event, block)
            validateReasoningTextPart(event.part, "")
            block.reasoningMode = "raw"
          } else if (block.type === "text") {
            validateTextPart(event.part, "", [])
          } else fail()
          block.contentStarted = true
          block.contentIndex = parseOptionalIndex(event.content_index, 0)
          break
        }

        case "response.reasoning_text.delta": {
          const block = requireBlock(event, blocks, "reasoning")
          if (
            block.reasoningMode !== "raw" ||
            !block.contentStarted ||
            block.textDone ||
            block.contentDone
          ) fail()
          requireRawContentLocation(event, block)
          appendDelta(block, event.delta)
          sawVisibleOutput = true
          chunks.push({ type: "reasoning-delta", index: event.output_index, text: event.delta })
          break
        }

        case "response.reasoning_text.done": {
          const block = requireBlock(event, blocks, "reasoning")
          if (
            block.reasoningMode !== "raw" ||
            !block.contentStarted ||
            block.textDone ||
            block.contentDone
          ) fail()
          requireRawContentLocation(event, block)
          if (event.text !== block.text) fail()
          block.textDone = true
          break
        }

        case "response.output_text.delta": {
          const block = requireBlock(event, blocks, "text")
          if (!block.contentStarted || block.textDone || block.contentDone) fail()
          requireContentIndex(event, block)
          appendDelta(block, event.delta)
          sawVisibleOutput = true
          chunks.push({ type: "text-delta", index: event.output_index, text: event.delta })
          break
        }

        case "response.output_text.annotation.added": {
          const block = requireBlock(event, blocks, "text")
          if (!block.contentStarted || block.textDone || block.contentDone) fail()
          requireExactDataKeys(event, [
            "annotation",
            "annotation_index",
            "content_index",
            "item_id",
            "output_index",
            "sequence_number",
            "type",
          ])
          requireContentIndex(event, block)
          if (
            streamedAnnotationCount >= MAX_ANNOTATIONS ||
            event.annotation_index !== block.annotations.length
          ) fail()
          const annotation = captureAnnotation(event.annotation)
          if (annotation.endIndex > block.text.length) fail()
          block.annotations.push(annotation)
          streamedAnnotationCount += 1
          sawServerTool = true
          break
        }

        case "response.output_text.done": {
          const block = requireBlock(event, blocks, "text")
          if (!block.contentStarted || block.textDone || block.contentDone) fail()
          requireContentIndex(event, block)
          if (event.text !== block.text) fail()
          block.textDone = true
          break
        }

        case "response.function_call_arguments.delta": {
          const block = requireBlock(event, blocks, "tool-call")
          if (block.argumentsDone) fail()
          appendToolArguments(block, event.delta)
          sawVisibleOutput = true
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
          if (block.argumentsDone || event.name !== block.name || event.arguments !== block.arguments) fail()
          block.argumentsDone = true
          break
        }

        case "response.custom_tool_call_input.delta": {
          const call = requireServerCall(event, serverCalls, "x-search")
          requireExactDataKeys(event, ["delta", "item_id", "output_index", "sequence_number", "type"])
          if (call.inputDone) fail()
          appendCustomToolInput(call, event.delta)
          call.sawInputDelta = true
          break
        }

        case "response.custom_tool_call_input.done": {
          const call = requireServerCall(event, serverCalls, "x-search")
          requireExactDataKeys(event, ["input", "item_id", "output_index", "sequence_number", "type"])
          if (call.inputDone || !call.sawInputDelta || event.input !== call.input) fail()
          call.inputDone = true
          break
        }

        case "response.web_search_call.in_progress":
          advanceWebSearch(event, serverCalls, "added", "in-progress")
          break

        case "response.web_search_call.searching":
          advanceWebSearch(event, serverCalls, "in-progress", "searching")
          break

        case "response.web_search_call.completed":
          advanceWebSearch(event, serverCalls, "searching", "completed")
          break

        case "response.content_part.done": {
          const block = requireBlock(event, blocks)
          if (!block.textDone || block.contentDone) fail()
          requireContentIndex(event, block)
          if (block.type === "reasoning") {
            if (block.reasoningMode !== "raw") fail()
            requireRawContentLocation(event, block)
            validateReasoningTextPart(event.part, block.text)
          } else if (block.type === "text") {
            validateTextPart(event.part, block.text, block.annotations)
          } else fail()
          block.contentDone = true
          break
        }

        case "response.output_item.done":
          closeOutputItem(
            event,
            blocks,
            serverCalls,
            completedServerCalls,
            replayBlocks,
            chunks,
          )
          markOutputItemClosed(event, itemLifecycles)
          break

        case "response.completed":
          requireRunning(created, inProgress)
          if (
            !sawVisibleOutput ||
            blocks.size !== 0 ||
            serverCalls.size !== 0 ||
            !isResponseStatus(event.response, "completed")
          ) fail()
          requireResponseId(event.response, responseId)
          if (validateResponseMetadata(event.response, responsePolicy, completedServerCalls)) {
            sawServerTool = true
          }
          if (sawServerTool && completedServerCalls.length === 0) fail()
          chunks.push({ type: "usage", usage: parseUsage(event.response.usage) })
          chunks.push({
            type: "finish",
            reason: { kind: sawFunctionCall ? "tool-calls" : "stop" },
            ...(!sawServerTool && replayBlocks.some((block) => block !== null)
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
            !sawVisibleOutput ||
            serverCalls.size !== 0 ||
            !isResponseStatus(event.response, "incomplete") ||
            !isPlainObject(event.response.incomplete_details) ||
            event.response.incomplete_details.reason !== "max_output_tokens"
          ) fail()
          requireResponseId(event.response, responseId)
          if (validateResponseMetadata(event.response, responsePolicy, completedServerCalls)) {
            sawServerTool = true
          }
          if (sawServerTool && completedServerCalls.length === 0) fail()
          for (const [index, block] of blocks) {
            if (block.type === "tool-call" || block.reusedReasoning) fail()
            if (block.type === "text") validateAnnotationPositions(block.annotations, block.text.length)
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
      if (!completed || blocks.size !== 0 || serverCalls.size !== 0) fail()
    },
  })
}

function captureResponseReceipt(receipt) {
  requireExactDataKeys(receipt, ["functionNames", "serverTools"])
  const functionValues = captureDataArray(receipt.functionNames, MAX_FUNCTION_NAMES)
  const serverValues = captureDataArray(receipt.serverTools, SERVER_TOOL_NAMES.size)
  if (functionValues.length + serverValues.length > MAX_FUNCTION_NAMES) fail()
  const functionNames = new Set()
  for (const name of functionValues) {
    if (typeof name !== "string" || !FUNCTION_NAME_PATTERN.test(name) || functionNames.has(name)) fail()
    functionNames.add(name)
  }
  const serverTools = new Set()
  let sawXSearch = false
  for (const name of serverValues) {
    if (
      !SERVER_TOOL_NAMES.has(name) ||
      serverTools.has(name) ||
      (name === "web_search" && sawXSearch)
    ) fail()
    serverTools.add(name)
    if (name === "x_search") sawXSearch = true
  }
  return Object.freeze({ functionNames, serverTools })
}

function addOutputItem(
  event,
  blocks,
  serverCalls,
  completedServerCalls,
  itemLifecycles,
  callIds,
  replayBlocks,
  chunks,
  responsePolicy,
) {
  const index = parseIndex(event.output_index)
  if (
    blocks.has(index) ||
    serverCalls.has(index) ||
    !isPlainObject(event.item) ||
    !isBoundedString(captureOwnDataValue(event.item, "id"), 256)
  ) fail()
  const itemId = captureOwnDataValue(event.item, "id")
  const itemType = captureOwnDataValue(event.item, "type")
  const reusedReasoning = registerOutputItem(
    event.item,
    itemId,
    itemType,
    index,
    itemLifecycles,
    completedServerCalls,
  )

  if (itemType === "web_search_call") {
    if (!responsePolicy.serverTools.has("web_search")) fail()
    validateWebSearchItem(event.item, "in_progress")
    serverCalls.set(index, {
      id: event.item.id,
      type: "web-search",
      state: "added",
    })
    return "web-search"
  }

  if (itemType === "custom_tool_call") {
    if (!responsePolicy.serverTools.has("x_search")) fail()
    validateXSearchItem(event.item, "in_progress", "")
    if (callIds.has(event.item.call_id)) fail()
    callIds.add(event.item.call_id)
    serverCalls.set(index, {
      id: event.item.id,
      type: "x-search",
      callId: event.item.call_id,
      name: event.item.name,
      input: "",
      inputDone: false,
      sawInputDelta: false,
    })
    return "x-search"
  }

  let type
  let block
  if (itemType === "reasoning") {
    validateReasoningItemStart(event.item)
    type = "reasoning"
    block = {
      id: event.item.id,
      type,
      reusedReasoning,
      reasoningAddedStatus: event.item.status,
      text: "",
      reasoningMode: undefined,
      summaryStarted: false,
      summaryTextDone: false,
      summaryDone: false,
      contentStarted: false,
      contentIndex: 0,
      textDone: false,
      contentDone: false,
    }
  } else if (itemType === "message" && event.item.role === "assistant") {
    type = "text"
    block = {
      id: event.item.id,
      type,
      text: "",
      annotations: [],
      contentStarted: false,
      contentIndex: 0,
      textDone: false,
      contentDone: false,
    }
  } else if (
    itemType === "function_call" &&
    event.item.status === "in_progress" &&
    event.item.arguments === "" &&
    isBoundedString(event.item.call_id, 256) &&
    isBoundedString(event.item.name, 128) &&
    responsePolicy.functionNames.has(event.item.name)
  ) {
    type = "tool-call"
    if (callIds.has(event.item.call_id)) fail()
    callIds.add(event.item.call_id)
    block = {
      id: event.item.id,
      type,
      callId: event.item.call_id,
      name: event.item.name,
      nameEmitted: false,
      arguments: "",
      argumentsDone: false,
    }
  }
  else fail()

  block.replayPosition = replayBlocks.length
  replayBlocks.push(null)
  blocks.set(index, block)
  chunks.push({ type: "block-start", index, blockType: type })
  return type
}

function registerOutputItem(item, itemId, itemType, outputIndex, itemLifecycles, completedServerCalls) {
  const previous = itemLifecycles.get(itemId)
  if (previous === undefined) {
    itemLifecycles.set(itemId, {
      type: itemType,
      outputIndex,
      closed: false,
      searchBacked: false,
    })
    return false
  }

  // The first reuse is proven by a completed Web/X Search in logical output order.
  // Once proven, the same id may recur only as another strict empty placeholder.
  const completedSearchBetweenItems = completedServerCalls.some((call) => (
    call.outputIndex > previous.outputIndex && call.outputIndex < outputIndex
  ))
  requireExactDataKeys(item, ["id", "status", "summary", "type"])
  if (
    previous.type !== "reasoning" ||
    !previous.closed ||
    (!previous.searchBacked && !completedSearchBetweenItems) ||
    itemType !== "reasoning" ||
    item.status !== "in_progress" ||
    !Array.isArray(item.summary) ||
    item.summary.length !== 0
  ) fail()
  itemLifecycles.set(itemId, {
    type: "reasoning",
    outputIndex,
    closed: false,
    searchBacked: true,
  })
  return true
}

function markOutputItemClosed(event, itemLifecycles) {
  const index = parseIndex(event.output_index)
  if (!isPlainObject(event.item)) fail()
  const itemId = captureOwnDataValue(event.item, "id")
  if (!isBoundedString(itemId, 256)) fail()
  const lifecycle = itemLifecycles.get(itemId)
  if (lifecycle === undefined || lifecycle.outputIndex !== index || lifecycle.closed) fail()
  itemLifecycles.set(itemId, { ...lifecycle, closed: true })
}

function closeOutputItem(
  event,
  blocks,
  serverCalls,
  completedServerCalls,
  replayBlocks,
  chunks,
) {
  const index = parseIndex(event.output_index)
  const serverCall = serverCalls.get(index)
  if (serverCall !== undefined) {
    completedServerCalls.push({
      outputIndex: index,
      ...closeServerCall(event, serverCall),
    })
    serverCalls.delete(index)
    return
  }

  const block = requireBlock(event, blocks)
  if (block.type === "reasoning" && block.reusedReasoning) {
    validateReusedReasoningItem(event.item, block)
  }
  if (
    !isPlainObject(event.item) ||
    event.item.id !== block.id ||
    event.item.status !== "completed"
  ) fail()
  if (block.type === "reasoning") {
    if (event.item.type !== "reasoning") fail()
    if (block.reasoningMode === "summary") {
      if (
        !block.summaryDone ||
        !Array.isArray(event.item.summary) ||
        event.item.summary.length !== 1 ||
        !isPlainObject(event.item.summary[0]) ||
        event.item.summary[0].type !== "summary_text" ||
        event.item.summary[0].text !== block.text
      ) fail()
    } else if (block.reasoningMode === "raw") {
      validateCompletedReasoningContent(event.item, block)
    } else if (block.reasoningMode === undefined) {
      validateEmptyReasoningItem(event.item, block)
    } else fail()
    if (event.item.encrypted_content !== undefined) {
      if (!isBoundedUtf8String(event.item.encrypted_content, MAX_ENCRYPTED_REASONING_BYTES)) fail()
      replayBlocks[block.replayPosition] = {
        type: "reasoning",
        id: block.id,
        encryptedContent: event.item.encrypted_content,
        ...(block.reasoningMode === "raw" ? { textType: "reasoning_text" } : {}),
      }
    }
  }
  if (block.type === "text") {
    if (event.item.type !== "message" || event.item.role !== "assistant" || !block.contentDone) fail()
    validateCompletedMessageContent(event.item.content, block)
  }
  if (block.type === "tool-call" && (
    event.item.type !== "function_call" ||
    event.item.call_id !== block.callId ||
    event.item.name !== block.name ||
    event.item.arguments !== block.arguments ||
    !block.argumentsDone ||
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

function closeServerCall(event, call) {
  if (!isPlainObject(event.item) || event.item.id !== call.id) fail()
  if (call.type === "web-search") {
    if (call.state !== "completed") fail()
    const action = validateWebSearchItem(event.item, "completed")
    return {
      type: "web_search",
      id: call.id,
      action,
    }
  }
  if (call.type !== "x-search" || !call.inputDone) fail()
  validateXSearchItem(event.item, "completed", call.input)
  if (event.item.call_id !== call.callId || event.item.name !== call.name) fail()
  return {
    type: "x_search",
    id: call.id,
    callId: call.callId,
    name: call.name,
  }
}

function advanceWebSearch(event, serverCalls, expectedState, nextState) {
  requireExactDataKeys(event, ["item_id", "output_index", "sequence_number", "type"])
  const call = requireServerCall(event, serverCalls, "web-search")
  if (call.state !== expectedState) fail()
  call.state = nextState
}

function requireServerCall(event, serverCalls, expectedType) {
  const index = parseIndex(event.output_index)
  const call = serverCalls.get(index)
  if (!call || call.type !== expectedType || event.item_id !== call.id) fail()
  return call
}

function validateWebSearchItem(item, status) {
  requireExactDataKeys(item, ["action", "id", "status", "type"])
  if (
    item.type !== "web_search_call" ||
    item.status !== status ||
    !isBoundedString(item.id, 256)
  ) fail()
  return validateWebSearchAction(item.action, status)
}

function validateWebSearchAction(action, status) {
  if (!isPlainObject(action)) fail()
  const type = captureOwnDataValue(action, "type")
  if (status === "completed" && type === "open_page") {
    requireExactDataKeys(action, ["type", "url"])
    if (!isBoundedUtf8String(action.url, MAX_CITATION_URL_BYTES)) fail()
    return Object.freeze({ type, url: action.url })
  }
  requireExactDataKeys(action, ["query", "sources", "type"])
  if (
    type !== "search" ||
    typeof action.query !== "string" ||
    (status === "completed" && action.query.length === 0) ||
    Buffer.byteLength(action.query, "utf8") > MAX_SEARCH_QUERY_BYTES
  ) fail()
  const sources = captureDataArray(action.sources, MAX_SEARCH_SOURCES)
  const budget = {
    bytes: MAX_DISCARDED_SOURCE_BYTES,
    nodes: MAX_DISCARDED_SOURCE_NODES,
  }
  for (const source of sources) {
    if (!isPlainObject(source)) fail()
    validateBoundedDiscardedJson(source, budget, 0)
  }
  return Object.freeze({ type })
}

function validateXSearchItem(item, status, input) {
  requireExactDataKeys(item, ["call_id", "id", "input", "name", "status", "type"])
  if (
    item.type !== "custom_tool_call" ||
    item.status !== status ||
    !isBoundedString(item.id, 256) ||
    !isBoundedString(item.call_id, 256) ||
    !X_SEARCH_FUNCTION_NAMES.has(item.name) ||
    item.input !== input
  ) fail()
}

function appendCustomToolInput(call, delta) {
  if (typeof delta !== "string" || delta.length === 0) fail()
  call.input += delta
  if (Buffer.byteLength(call.input, "utf8") > MAX_TOOL_ARGUMENT_BYTES) fail()
}

function validateBoundedDiscardedJson(value, budget, depth) {
  budget.nodes -= 1
  if (budget.nodes < 0 || depth > MAX_DISCARDED_SOURCE_DEPTH) fail()
  if (value === null || typeof value === "boolean") return
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail()
    return
  }
  if (typeof value === "string") {
    consumeDiscardedBytes(budget, value, MAX_DISCARDED_STRING_BYTES)
    return
  }
  if (Array.isArray(value)) {
    const values = captureDataArray(value, MAX_DISCARDED_SOURCE_ARRAY_ITEMS)
    for (const nested of values) validateBoundedDiscardedJson(nested, budget, depth + 1)
    return
  }
  if (!isPlainObject(value)) fail()
  const keys = Reflect.ownKeys(value)
  if (keys.length > MAX_DISCARDED_SOURCE_KEYS) fail()
  for (const key of keys) {
    if (typeof key !== "string") fail()
    consumeDiscardedBytes(budget, key, 256)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !("value" in descriptor)) fail()
    validateBoundedDiscardedJson(descriptor.value, budget, depth + 1)
  }
}

function consumeDiscardedBytes(budget, value, perValueLimit) {
  const bytes = Buffer.byteLength(value, "utf8")
  if (bytes > perValueLimit) fail()
  budget.bytes -= bytes
  if (budget.bytes < 0) fail()
}

function validateTextPart(part, text, annotations) {
  if (!isPlainObject(part) || part.type !== "output_text" || part.text !== text) fail()
  const captured = part.annotations === undefined ? [] : captureAnnotations(part.annotations)
  if (!sameAnnotations(captured, annotations)) fail()
  validateAnnotationPositions(captured, text.length)
}

function validateCompletedMessageContent(content, block) {
  if (content === undefined) return
  const parts = captureDataArray(content, 1)
  if (parts.length !== 1) fail()
  validateTextPart(parts[0], block.text, block.annotations)
}

function validateReasoningTextPart(part, text) {
  if (!isPlainObject(part) || part.type !== "reasoning_text" || part.text !== text) fail()
}

function validateReasoningItemStart(item) {
  if (item.status !== "in_progress" && item.status !== "completed") fail()
  const summary = captureDataArray(item.summary, 0)
  if (summary.length !== 0) fail()
  if (item.content !== undefined) {
    const content = captureDataArray(item.content, 0)
    if (content.length !== 0) fail()
  }
  if (
    item.encrypted_content !== undefined &&
    !isBoundedUtf8String(item.encrypted_content, MAX_ENCRYPTED_REASONING_BYTES)
  ) fail()
}

function validateCompletedReasoningContent(item, block) {
  if (!block.contentDone) fail()
  const summary = captureDataArray(item.summary, 0)
  if (summary.length !== 0) fail()
  const content = captureDataArray(item.content, 1)
  if (content.length !== 1) fail()
  validateReasoningTextPart(content[0], block.text)
}

function validateEmptyReasoningItem(item, block) {
  if (
    block.text !== "" ||
    block.summaryStarted ||
    block.summaryTextDone ||
    block.summaryDone ||
    block.contentStarted ||
    block.textDone ||
    block.contentDone
  ) fail()
  const summary = captureDataArray(item.summary, 0)
  if (summary.length !== 0) fail()
  if (item.content !== undefined) {
    const content = captureDataArray(item.content, 0)
    if (content.length !== 0) fail()
  }
}

function validateReusedReasoningItem(item, block) {
  requireRequiredAndOptionalDataKeys(
    item,
    ["id", "status", "summary", "type"],
    ["content", "encrypted_content"],
  )
  validateEmptyReasoningItem(item, block)
  if (Object.hasOwn(item, "content")) captureDataArray(item.content, 0)
  if (
    Object.hasOwn(item, "encrypted_content") &&
    !isBoundedUtf8String(item.encrypted_content, MAX_ENCRYPTED_REASONING_BYTES)
  ) fail()
}

function captureAnnotations(value) {
  const values = captureDataArray(value, MAX_ANNOTATIONS)
  return values.map(captureAnnotation)
}

function captureAnnotation(annotation) {
  requireExactDataKeys(annotation, ["end_index", "start_index", "title", "type", "url"])
  if (
    annotation.type !== "url_citation" ||
    !Number.isSafeInteger(annotation.start_index) ||
    annotation.start_index < 0 ||
    !Number.isSafeInteger(annotation.end_index) ||
    annotation.end_index < annotation.start_index ||
    !isBoundedUtf8String(annotation.url, MAX_CITATION_URL_BYTES) ||
    typeof annotation.title !== "string" ||
    Buffer.byteLength(annotation.title, "utf8") > MAX_CITATION_TITLE_BYTES
  ) fail()
  return Object.freeze({
    type: annotation.type,
    url: annotation.url,
    title: annotation.title,
    startIndex: annotation.start_index,
    endIndex: annotation.end_index,
  })
}

function validateAnnotationPositions(annotations, textLength) {
  for (const annotation of annotations) {
    if (annotation.endIndex > textLength) fail()
  }
}

function sameAnnotations(left, right) {
  if (left.length !== right.length) return false
  return left.every((annotation, index) => {
    const expected = right[index]
    return annotation.type === expected.type &&
      annotation.url === expected.url &&
      annotation.title === expected.title &&
      annotation.startIndex === expected.startIndex &&
      annotation.endIndex === expected.endIndex
  })
}

function validateResponseMetadata(response, responsePolicy, completedServerCalls) {
  if (!isPlainObject(response)) fail()
  let sawSearchEvidence = false
  if (response.citations !== undefined) {
    if (validateCitations(response.citations)) sawSearchEvidence = true
  }
  let outputServerCalls
  if (response.output !== undefined) {
    const output = validateResponseOutput(response.output, responsePolicy)
    outputServerCalls = output.serverCalls
    if (output.sawCitation || outputServerCalls.length > 0) sawSearchEvidence = true
  }
  let serverSideToolUsage
  if (response.server_side_tool_usage !== undefined) {
    serverSideToolUsage = validateServerSideToolUsage(
      response.server_side_tool_usage,
      responsePolicy,
    )
    if (serverSideToolUsage.sawSearch) sawSearchEvidence = true
  }
  if (completedServerCalls !== undefined) {
    reconcileTerminalServerTools({
      completedServerCalls,
      outputServerCalls,
      serverSideToolUsage,
      sawSearchEvidence,
    })
  }
  return sawSearchEvidence
}

function validateCitations(citations) {
  const values = captureDataArray(citations, MAX_CITATIONS)
  let bytes = 0
  for (const citation of values) {
    if (!isBoundedUtf8String(citation, MAX_CITATION_URL_BYTES)) fail()
    bytes += Buffer.byteLength(citation, "utf8")
    if (bytes > MAX_CITATIONS * MAX_CITATION_URL_BYTES) fail()
  }
  return values.length > 0
}

function validateResponseOutput(output, responsePolicy) {
  const items = captureDataArray(output, MAX_EVENTS)
  const serverCalls = []
  let sawCitation = false
  for (let outputIndex = 0; outputIndex < items.length; outputIndex += 1) {
    const item = items[outputIndex]
    if (!isPlainObject(item)) fail()
    if (item.type === "web_search_call") {
      if (!responsePolicy.serverTools.has("web_search")) fail()
      const action = validateWebSearchItem(item, "completed")
      serverCalls.push({ type: "web_search", id: item.id, outputIndex, action })
      continue
    }
    if (item.type === "custom_tool_call") {
      if (
        !responsePolicy.serverTools.has("x_search") ||
        typeof item.input !== "string" ||
        Buffer.byteLength(item.input, "utf8") > MAX_TOOL_ARGUMENT_BYTES
      ) fail()
      validateXSearchItem(item, "completed", item.input)
      serverCalls.push({
        type: "x_search",
        id: item.id,
        callId: item.call_id,
        name: item.name,
        outputIndex,
      })
      continue
    }
    if (item.type === "reasoning" || item.type === "function_call") continue
    if (item.type !== "message") fail()
    if (item.content === undefined) continue
    const content = captureDataArray(item.content, MAX_ANNOTATIONS)
    for (const part of content) {
      if (!isPlainObject(part)) fail()
      if (part.type !== "output_text") fail()
      if (part.annotations === undefined) continue
      if (typeof part.text !== "string" || Buffer.byteLength(part.text, "utf8") > MAX_BLOCK_TEXT_BYTES) fail()
      const annotations = captureAnnotations(part.annotations)
      validateAnnotationPositions(annotations, part.text.length)
      if (annotations.length > 0) sawCitation = true
    }
  }
  return { serverCalls, sawCitation }
}

function validateServerSideToolUsage(usage, responsePolicy) {
  if (!isPlainObject(usage)) fail()
  const counts = {
    webSearch: undefined,
    xSearch: undefined,
    sawSearch: false,
  }
  for (const key of Reflect.ownKeys(usage)) {
    if (typeof key !== "string") fail()
    const descriptor = Object.getOwnPropertyDescriptor(usage, key)
    if (!descriptor || !("value" in descriptor)) fail()
    if (!Number.isSafeInteger(descriptor.value) || descriptor.value < 0) fail()
    if (key === "SERVER_SIDE_TOOL_WEB_SEARCH") {
      if (!responsePolicy.serverTools.has("web_search")) fail()
      counts.webSearch = descriptor.value
    } else if (key === "SERVER_SIDE_TOOL_X_SEARCH") {
      if (!responsePolicy.serverTools.has("x_search")) fail()
      counts.xSearch = descriptor.value
    } else fail()
    if (descriptor.value > 0) counts.sawSearch = true
  }
  return counts
}

function reconcileTerminalServerTools({
  completedServerCalls,
  outputServerCalls,
  serverSideToolUsage,
  sawSearchEvidence,
}) {
  if (sawSearchEvidence && completedServerCalls.length === 0) fail()

  if (outputServerCalls !== undefined) {
    const unmatched = new Set(completedServerCalls.map((_, index) => index))
    for (const outputCall of outputServerCalls) {
      let matchedIndex
      for (const index of unmatched) {
        if (sameServerCall(outputCall, completedServerCalls[index])) {
          matchedIndex = index
          break
        }
      }
      if (matchedIndex === undefined) fail()
      unmatched.delete(matchedIndex)
    }
    if (unmatched.size !== 0) fail()
  }

  if (serverSideToolUsage !== undefined) {
    const completedWeb = completedServerCalls.filter(
      (call) => call.type === "web_search",
    ).length
    const completedX = completedServerCalls.filter(
      (call) => call.type === "x_search",
    ).length
    if (
      (serverSideToolUsage.webSearch ?? 0) !== completedWeb ||
      (serverSideToolUsage.xSearch ?? 0) !== completedX
    ) fail()
  }
}

function sameServerCall(left, right) {
  return left.type === right.type &&
    left.id === right.id &&
    left.outputIndex === right.outputIndex &&
    (left.type !== "web_search" || sameWebSearchAction(left.action, right.action)) &&
    (left.type !== "x_search" || (
      left.callId === right.callId &&
      left.name === right.name
    ))
}

function sameWebSearchAction(left, right) {
  return left.type === right.type &&
    (left.type !== "open_page" || left.url === right.url)
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

function requireContentIndex(event, block) {
  if (parseOptionalIndex(event.content_index, block.contentIndex) !== block.contentIndex) fail()
}

function requireRawContentLocation(event, block) {
  if (
    event.item_id !== block.id ||
    parseIndex(event.content_index) !== block.contentIndex
  ) fail()
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

function parseOptionalIndex(value, fallback) {
  return value === undefined ? fallback : parseIndex(value)
}

function captureResponseId(response) {
  const descriptor = Object.getOwnPropertyDescriptor(response, "id")
  if (descriptor === undefined) return undefined
  if (!("value" in descriptor) || !isBoundedString(descriptor.value, 256)) fail()
  return descriptor.value
}

function requireResponseId(response, expected) {
  if (captureResponseId(response) !== expected) fail()
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

function captureDataArray(value, maxLength) {
  if (!Array.isArray(value) || value.length > maxLength) fail()
  const values = new Array(value.length)
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !("value" in descriptor)) fail()
    values[index] = descriptor.value
  }
  return values
}

function requireExactDataKeys(value, expectedKeys) {
  if (!isPlainObject(value)) fail()
  const keys = Reflect.ownKeys(value)
  if (keys.length !== expectedKeys.length) fail()
  const expected = new Set(expectedKeys)
  for (const key of keys) {
    if (typeof key !== "string" || !expected.has(key)) fail()
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !("value" in descriptor)) fail()
  }
}

function requireRequiredAndOptionalDataKeys(value, requiredKeys, optionalKeys) {
  if (!isPlainObject(value)) fail()
  const required = new Set(requiredKeys)
  const optional = new Set(optionalKeys)
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== "string" ||
      (!required.has(key) && !optional.has(key))
    ) fail()
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !("value" in descriptor)) fail()
    required.delete(key)
  }
  if (required.size !== 0) fail()
}

function captureOwnDataValue(value, key) {
  if (!isPlainObject(value)) fail()
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !("value" in descriptor)) fail()
  return descriptor.value
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

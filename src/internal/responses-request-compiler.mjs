import { offloadRequestImagesWithPolicy } from "@deepseek-ai/dsh-llm"

import {
  ResponsesRequestTooLargeError,
  UnsupportedResponsesRequestError,
  captureResponsesRequestMessages,
  captureResponsesRequestOptions,
  createResponsesRequestEncoder,
} from "./responses-request.mjs"

const MAX_CONTENT_BLOCKS = 20_000
const FUNCTION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SEARCH_MODEL_ID = "grok-4.6"
const CAPTURE_IMAGE_POLICY = Object.freeze({
  mediaTypes: Object.freeze(["image/jpeg", "image/png"]),
})
const EMPTY_SERVER_TOOLS = Object.freeze([])
const DEFAULT_SEARCH_POLICY = Object.freeze({
  webSearch: false,
  xSearch: false,
})
const EMPTY_REQUEST_IMAGE = new Uint8Array(0)
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype)
const getTypedArrayBuffer = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get
const getTypedArrayByteLength = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get
const getTypedArrayByteOffset = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteOffset").get

export class UnsupportedImageInputError extends UnsupportedResponsesRequestError {
  constructor() {
    super()
    this.name = "UnsupportedImageInputError"
  }
}

export class UnsupportedSearchCapabilityError extends UnsupportedResponsesRequestError {
  constructor() {
    super()
    this.name = "UnsupportedSearchCapabilityError"
  }
}

export class InvalidRequestImageProjectionError extends Error {
  constructor() {
    super("The attachment service returned an invalid request image projection")
    this.name = "InvalidRequestImageProjectionError"
  }
}

export function createResponsesRequestCompiler({
  getAttachmentStore = () => undefined,
  searchPolicy,
} = {}) {
  if (typeof getAttachmentStore !== "function") {
    throw new TypeError("Invalid Grok attachment store source")
  }
  const capturedSearchPolicy = captureSearchPolicy(searchPolicy)

  const prepare = (options) => {
    const captured = captureResponsesRequestOptions(options)
    const serverTools = captureCallServerTools(options, capturedSearchPolicy)
    const signal = captured.signal
    signal?.throwIfAborted()
    const provider = captured.provider
    const model = captured.model
    const reasoningEffort = captured.reasoningEffort
    const hasImage = contentTreesHaveImage(captured.messages)
    const messages = captureResponsesRequestMessages(
      captured.messages,
      model,
      hasImage ? MAX_CONTENT_BLOCKS : undefined,
    )
    const encodeRequest = createResponsesRequestEncoder(
      { ...captured, messages },
      { serverTools },
    )

    if (!hasImage) {
      const request = encodeRequest()
      return Object.freeze({
        model,
        provider,
        reasoningEffort,
        signal,
        async compile(route) {
          if (!isMatchingRoute({ model, provider }, route)) {
            throw new UnsupportedResponsesRequestError()
          }
          validateSearchRoute(route, serverTools, model)
          return createCompiledRequest(request)
        },
      })
    }

    validateContentTrees(messages)
    validateImagePlacements(messages)
    const imageMessages = snapshotImageRequestMessages(messages, model)
    const blocks = collectImageBlocks(imageMessages)
    const refs = indexUniqueImageRefs(blocks, CAPTURE_IMAGE_POLICY)
    encodeRequest({ messages: imageMessages, requestImages: placeholderRequestImages(blocks) })

    return Object.freeze({
      model,
      provider,
      reasoningEffort,
      signal,
      compile: (route) => compileImageRequest({
        encodeRequest,
        getAttachmentStore,
        messages: imageMessages,
        model,
        provider,
        refs,
        route,
        serverTools,
        signal,
      }),
    })
  }

  return Object.freeze({
    prepare,
    async compile(options, route) {
      return prepare(options).compile(route)
    },
  })
}

async function compileImageRequest({
  encodeRequest,
  getAttachmentStore,
  messages: capturedMessages,
  model,
  provider,
  refs: capturedRefs,
  route,
  serverTools,
  signal,
}) {
  if (!isMatchingRoute({ model, provider }, route)) throw new UnsupportedResponsesRequestError()
  validateSearchRoute(route, serverTools, model)
  signal?.throwIfAborted()
  const policy = parseImagePolicy(route)
  for (const ref of capturedRefs.values()) validateImageRef(ref, policy)
  let messages = offloadRequestImagesWithPolicy(capturedMessages, {
    representation: "raw",
    maxImages: policy.maxImages,
  })
  const blocks = collectImageBlocks(messages)
  const refs = indexUniqueImageRefs(blocks, policy)
  const store = getAttachmentStore()
  if (!store || typeof store.readImageRequest !== "function") {
    throw new UnsupportedImageInputError()
  }

  const versionsById = new Map()
  await Promise.all([...refs.entries()].map(async ([attachmentId, ref]) => {
    const returned = await store.readImageRequest(ref, policy.readPolicy, signal)
    signal?.throwIfAborted()
    const version = captureRequestImage(returned, policy)
    validateRequestImage(version, ref, policy)
    versionsById.set(attachmentId, version)
  }))

  const requestImages = new Map(blocks.map((block) => [
    block.attachment,
    versionsById.get(String(block.attachment.attachmentId)),
  ]))
  messages = offloadRequestImagesWithPolicy(messages, {
    representation: "raw",
    maxBytes: policy.maxTotalBytes,
    byteLength: (ref) => versionsById.get(String(ref.attachmentId)).bytes,
  })

  while (true) {
    try {
      return createCompiledRequest(encodeRequest({ messages, requestImages }))
    } catch (error) {
      if (!(error instanceof ResponsesRequestTooLargeError)) throw error
      const imageCount = collectImageBlocks(messages).length
      if (imageCount === 0) throw error
      messages = offloadRequestImagesWithPolicy(messages, {
        representation: "raw",
        maxImages: imageCount - 1,
      })
    }
  }
}

function captureSearchPolicy(searchPolicy) {
  if (searchPolicy === undefined) return DEFAULT_SEARCH_POLICY
  if (!isPlainObject(searchPolicy)) throw new TypeError("Invalid Grok Search policy")
  const keys = Reflect.ownKeys(searchPolicy)
  if (
    keys.length !== 2 ||
    !keys.includes("webSearch") ||
    !keys.includes("xSearch")
  ) throw new TypeError("Invalid Grok Search policy")

  const webSearch = readSearchPolicyProperty(searchPolicy, "webSearch")
  const xSearch = readSearchPolicyProperty(searchPolicy, "xSearch")
  if (typeof webSearch !== "boolean" || typeof xSearch !== "boolean") {
    throw new TypeError("Invalid Grok Search policy")
  }
  return Object.freeze({ webSearch, xSearch })
}

function readSearchPolicyProperty(searchPolicy, key) {
  const descriptor = Object.getOwnPropertyDescriptor(searchPolicy, key)
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError("Invalid Grok Search policy")
  }
  return descriptor.value
}

function captureCallServerTools(options, searchPolicy) {
  if (!searchPolicy.webSearch && !searchPolicy.xSearch) return EMPTY_SERVER_TOOLS
  const purpose = readOwnRequestProperty(options, "purpose")
  if (purpose !== undefined) {
    if (typeof purpose !== "string" || purpose.length === 0) {
      throw new UnsupportedResponsesRequestError()
    }
    return EMPTY_SERVER_TOOLS
  }

  return Object.freeze([
    ...(searchPolicy.webSearch ? ["web_search"] : []),
    ...(searchPolicy.xSearch ? ["x_search"] : []),
  ])
}

function validateSearchRoute(route, requestedServerTools, model) {
  if (requestedServerTools.length === 0) return
  if (model !== SEARCH_MODEL_ID) throw new UnsupportedSearchCapabilityError()
  const descriptor = Object.getOwnPropertyDescriptor(route, "serverTools")
  if (descriptor === undefined || ("value" in descriptor && descriptor.value === undefined)) {
    throw new UnsupportedSearchCapabilityError()
  }
  if (!("value" in descriptor)) throw new UnsupportedResponsesRequestError()

  const supportedServerTools = captureDataArray(descriptor.value)
  const seen = new Set()
  let sawXSearch = false
  for (let index = 0; index < supportedServerTools.length; index += 1) {
    const kind = supportedServerTools[index]
    if (
      (kind !== "web_search" && kind !== "x_search") ||
      seen.has(kind) ||
      (kind === "web_search" && sawXSearch)
    ) throw new UnsupportedResponsesRequestError()
    seen.add(kind)
    if (kind === "x_search") sawXSearch = true
  }
  if (!requestedServerTools.every((kind) => seen.has(kind))) {
    throw new UnsupportedSearchCapabilityError()
  }
}

function createCompiledRequest(request) {
  freezeTree(request)
  return Object.freeze({
    request,
    receipt: deriveReceipt(request),
  })
}

function deriveReceipt(request) {
  const tools = readOwnRequestProperty(request, "tools")
  const functionNames = []
  const serverTools = []
  if (tools !== undefined) {
    const toolValues = captureDataArray(tools)
    let sawServerTool = false
    let sawXSearch = false
    for (let index = 0; index < toolValues.length; index += 1) {
      const tool = toolValues[index]
      if (!isPlainObject(tool)) throw new UnsupportedResponsesRequestError()
      const type = readOwnRequestProperty(tool, "type")
      if (type === "function") {
        const name = readOwnRequestProperty(tool, "name")
        if (sawServerTool || typeof name !== "string" || !FUNCTION_NAME_PATTERN.test(name)) {
          throw new UnsupportedResponsesRequestError()
        }
        functionNames.push(name)
        continue
      }
      if (type !== "web_search" && type !== "x_search") {
        throw new UnsupportedResponsesRequestError()
      }
      if (
        Reflect.ownKeys(tool).length !== 1 ||
        serverTools.includes(type) ||
        (type === "web_search" && sawXSearch)
      ) throw new UnsupportedResponsesRequestError()
      sawServerTool = true
      if (type === "x_search") sawXSearch = true
      serverTools.push(type)
    }
  }
  return Object.freeze({
    functionNames: Object.freeze(functionNames),
    serverTools: Object.freeze(serverTools),
  })
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

function snapshotImageRequestMessages(messages, targetModel) {
  const messageValues = captureDataArray(messages)
  const snapshots = new Array(messageValues.length)
  for (let index = 0; index < messageValues.length; index += 1) {
    const message = messageValues[index]
    const content = snapshotContent(message.content)
    snapshots[index] = Object.freeze({
      role: message.role,
      source: snapshotMessageSource(message.source, targetModel, content.length),
      content,
    })
  }
  const snapshot = Object.freeze(snapshots)
  validateContentTrees(snapshot)
  validateImagePlacements(snapshot)
  return snapshot
}

function snapshotContent(content) {
  const values = captureDataArray(content)
  const snapshots = new Array(values.length)
  for (let index = 0; index < values.length; index += 1) {
    const block = values[index]
    if (block.type === "text" || block.type === "reasoning") {
      snapshots[index] = Object.freeze({ type: block.type, text: block.text })
    } else if (block.type === "image") {
      snapshots[index] = Object.freeze({
        type: "image",
        attachment: snapshotImageRef(block.attachment),
      })
    } else if (block.type === "tool-call") {
      snapshots[index] = Object.freeze({
        type: "tool-call",
        id: block.id,
        name: block.name,
        arguments: block.arguments,
      })
    } else if (block.type === "tool-result") {
      snapshots[index] = Object.freeze({
        type: "tool-result",
        toolCallId: block.toolCallId,
        content: snapshotContent(block.content),
      })
    } else {
      snapshots[index] = Object.freeze({ type: block.type })
    }
  }
  return Object.freeze(snapshots)
}

function snapshotImageRef(ref) {
  if (!isPlainObject(ref)) throw new UnsupportedImageInputError()
  const attachmentId = readOwnImageRefProperty(ref, "attachmentId")
  const mediaType = readOwnImageRefProperty(ref, "mediaType")
  const bytes = readOwnImageRefProperty(ref, "bytes")
  const width = readOwnImageRefProperty(ref, "width")
  const height = readOwnImageRefProperty(ref, "height")
  const name = readOwnImageRefProperty(ref, "name")
  const originalDimensions = readOwnImageRefProperty(ref, "originalDimensions")
  const snapshot = {
    attachmentId,
    mediaType,
    bytes,
    width,
    height,
  }
  if (name !== undefined) {
    if (typeof name !== "string") throw new UnsupportedImageInputError()
    snapshot.name = name
  }
  if (originalDimensions !== undefined) {
    if (!isPlainObject(originalDimensions)) throw new UnsupportedImageInputError()
    snapshot.originalDimensions = Object.freeze({
      width: readOwnImageRefProperty(originalDimensions, "width"),
      height: readOwnImageRefProperty(originalDimensions, "height"),
    })
  }
  validateImageRef(snapshot, CAPTURE_IMAGE_POLICY)
  return Object.freeze(snapshot)
}

function snapshotMessageSource(source, targetModel, contentLength) {
  const kind = source?.kind
  if (kind === "tool") {
    return Object.freeze({ kind: "tool", callId: source.callId })
  }
  if (!isPlainObject(source)) return Object.freeze({})

  const snapshot = {
    kind,
    provider: source.provider,
    model: source.model,
  }
  const replayState = snapshotReplayState(source, targetModel, contentLength)
  if (replayState !== undefined) snapshot.replayState = replayState
  return Object.freeze(snapshot)
}

function snapshotReplayState(source, targetModel, contentLength) {
  const replayState = source.replayState
  if (
    source.kind !== "model" ||
    source.provider !== "grok" ||
    source.model !== targetModel ||
    !isPlainObject(replayState)
  ) return undefined
  const response = replayState.response
  const blocks = replayState.blocks
  if (
    !isPlainObject(response) ||
    response.version !== 1 ||
    !Array.isArray(blocks) ||
    blocks.length !== contentLength
  ) return undefined

  const blockValues = captureDataArray(blocks)
  const blockSnapshots = new Array(blockValues.length)
  for (let index = 0; index < blockValues.length; index += 1) {
    const block = blockValues[index]
    blockSnapshots[index] = !isPlainObject(block)
      ? Object.freeze({})
      : Object.freeze({
        type: block.type,
        id: block.id,
        encryptedContent: block.encryptedContent,
      })
  }
  return Object.freeze({
    response: Object.freeze({ version: 1 }),
    blocks: Object.freeze(blockSnapshots),
  })
}

function placeholderRequestImages(blocks) {
  const images = new Map()
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    images.set(
      block.attachment,
      Object.freeze({ mediaType: block.attachment.mediaType, data: EMPTY_REQUEST_IMAGE }),
    )
  }
  return images
}

function validateContentTrees(messages) {
  const messageValues = captureDataArray(messages)
  let blockCount = 0
  for (let messageIndex = 0; messageIndex < messageValues.length; messageIndex += 1) {
    const message = messageValues[messageIndex]
    if (!isPlainObject(message)) {
      throw new UnsupportedResponsesRequestError()
    }
    const pending = [{ content: captureDataArray(message.content), depth: 0 }]
    while (pending.length > 0) {
      const { content, depth } = pending.pop()
      for (let blockIndex = 0; blockIndex < content.length; blockIndex += 1) {
        const block = content[blockIndex]
        blockCount += 1
        if (blockCount > MAX_CONTENT_BLOCKS || !isPlainObject(block)) {
          throw new UnsupportedResponsesRequestError()
        }
        if (block.type === "tool-result") {
          if (depth > 0) throw new UnsupportedResponsesRequestError()
          pending.push({ content: captureDataArray(block.content), depth: depth + 1 })
        }
      }
    }
  }
}

function contentTreesHaveImage(messages) {
  const pending = []
  const seen = new WeakSet()
  const messageLength = readDataArrayLength(messages)
  for (let index = 0; index < messageLength; index += 1) {
    const message = readDataArrayValue(messages, index)
    if (!isPlainObject(message)) throw new UnsupportedResponsesRequestError()
    pending.push({
      content: readOwnRequestProperty(message, "content"),
      depth: 0,
    })
  }
  while (pending.length > 0) {
    const { content: sourceContent, depth } = pending.pop()
    const contentLength = readDataArrayLength(sourceContent)
    if (seen.has(sourceContent)) continue
    seen.add(sourceContent)
    for (let index = 0; index < contentLength; index += 1) {
      const block = readDataArrayValue(sourceContent, index)
      if (!isPlainObject(block)) throw new UnsupportedResponsesRequestError()
      const type = readOwnRequestProperty(block, "type")
      if (type === "image") return true
      if (type === "tool-result" && depth === 0) {
        pending.push({
          content: readOwnRequestProperty(block, "content"),
          depth: depth + 1,
        })
      }
    }
  }
  return false
}

function validateImagePlacements(messages) {
  const messageValues = captureDataArray(messages)
  for (let index = 0; index < messageValues.length; index += 1) {
    const message = messageValues[index]
    if (!messageHasImage(message)) continue
    const content = captureDataArray(message.content)
    if (message.source?.kind === "tool") {
      const result = content[0]
      if (
        message.role !== "user" ||
        content.length !== 1 ||
        !isPlainObject(result) ||
        result.type !== "tool-result" ||
        result.toolCallId !== message.source.callId
      ) {
        throw new UnsupportedImageInputError()
      }
      if (!contentAllowsImages(captureDataArray(result.content))) {
        throw new UnsupportedResponsesRequestError()
      }
      continue
    }
    if (
      message.role !== "user" ||
      !contentAllowsImages(content, { allowReasoning: true })
    ) {
      throw new UnsupportedImageInputError()
    }
  }
}

function messageHasImage(message) {
  const content = captureDataArray(message.content)
  for (let index = 0; index < content.length; index += 1) {
    const block = content[index]
    if (block.type === "image") return true
    if (block.type !== "tool-result") continue
    const nested = captureDataArray(block.content)
    for (let nestedIndex = 0; nestedIndex < nested.length; nestedIndex += 1) {
      if (nested[nestedIndex].type === "image") return true
    }
  }
  return false
}

function contentAllowsImages(content, { allowReasoning = false } = {}) {
  for (let index = 0; index < content.length; index += 1) {
    const type = content[index].type
    if (allowReasoning && type === "reasoning") continue
    if (type !== "text" && type !== "image") return false
  }
  return true
}

function parseImagePolicy(route) {
  const policy = route.imageInput
  if (
    !Array.isArray(route.resolvedModelInfo.inputModalities) ||
    !route.resolvedModelInfo.inputModalities.includes("image") ||
    !isPlainObject(policy) ||
    !isPlainObject(policy.readPolicy) ||
    !isPositiveSafeInteger(policy.readPolicy.maxBytes) ||
    !isPositiveSafeInteger(policy.readPolicy.maxPixels) ||
    !isPositiveSafeInteger(policy.maxDimension) ||
    !isPositiveSafeInteger(policy.maxImages) ||
    !isPositiveSafeInteger(policy.maxTotalBytes) ||
    !Array.isArray(policy.mediaTypes) ||
    policy.mediaTypes.length === 0 ||
    !policy.mediaTypes.every((mediaType) => mediaType === "image/jpeg" || mediaType === "image/png")
  ) {
    throw new UnsupportedImageInputError()
  }
  return policy
}

function collectImageBlocks(messages) {
  const blocks = []
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === "image") blocks.push(block)
      if (block.type === "tool-result") {
        for (const nested of block.content) if (nested.type === "image") blocks.push(nested)
      }
    }
  }
  return blocks
}

function indexUniqueImageRefs(blocks, policy) {
  const refs = new Map()
  for (const block of blocks) {
    validateImageRef(block.attachment, policy)
    const attachmentId = String(block.attachment.attachmentId)
    const existing = refs.get(attachmentId)
    if (existing !== undefined && !sameImageRef(existing, block.attachment)) {
      throw new UnsupportedImageInputError()
    }
    refs.set(attachmentId, block.attachment)
  }
  return refs
}

function validateImageRef(ref, policy) {
  if (
    !isPlainObject(ref) ||
    typeof ref.attachmentId !== "string" ||
    ref.attachmentId.length === 0 ||
    !policy.mediaTypes.includes(ref.mediaType) ||
    !isPositiveSafeInteger(ref.bytes) ||
    !isPositiveSafeInteger(ref.width) ||
    !isPositiveSafeInteger(ref.height) ||
    (ref.originalDimensions !== undefined && (
      !isPlainObject(ref.originalDimensions) ||
      !isPositiveSafeInteger(ref.originalDimensions.width) ||
      !isPositiveSafeInteger(ref.originalDimensions.height)
    ))
  ) {
    throw new UnsupportedImageInputError()
  }
}

function validateRequestImage(version, ref, policy) {
  if (
    !isPlainObject(version) ||
    typeof version.variantId !== "string" ||
    version.variantId.length === 0 ||
    !isPlainObject(version.attachment) ||
    !sameImageRef(version.attachment, ref) ||
    !(version.data instanceof Uint8Array) ||
    !policy.mediaTypes.includes(version.mediaType) ||
    !isPositiveSafeInteger(version.bytes) ||
    version.bytes !== version.data.byteLength ||
    version.bytes > policy.readPolicy.maxBytes ||
    !isPositiveSafeInteger(version.width) ||
    !isPositiveSafeInteger(version.height) ||
    version.width > policy.maxDimension ||
    version.height > policy.maxDimension ||
    version.width * version.height > policy.readPolicy.maxPixels ||
    version.depth !== "uchar" ||
    version.space !== "srgb" ||
    typeof version.hasAlpha !== "boolean" ||
    !hasExpectedMagic(version.data, version.mediaType)
  ) {
    throw new InvalidRequestImageProjectionError()
  }
}

function captureRequestImage(version, policy) {
  if (!isPlainObject(version)) throw new InvalidRequestImageProjectionError()
  const captured = {
    variantId: readOwnProjectionProperty(version, "variantId"),
    attachment: captureProjectionAttachment(
      readOwnProjectionProperty(version, "attachment"),
    ),
    data: readOwnProjectionProperty(version, "data"),
    mediaType: readOwnProjectionProperty(version, "mediaType"),
    bytes: readOwnProjectionProperty(version, "bytes"),
    width: readOwnProjectionProperty(version, "width"),
    height: readOwnProjectionProperty(version, "height"),
    depth: readOwnProjectionProperty(version, "depth"),
    space: readOwnProjectionProperty(version, "space"),
    hasAlpha: readOwnProjectionProperty(version, "hasAlpha"),
  }
  captured.data = copyRequestImageData(captured.data, policy.readPolicy.maxBytes)
  return Object.freeze(captured)
}

function captureProjectionAttachment(attachment) {
  if (!isPlainObject(attachment)) throw new InvalidRequestImageProjectionError()
  const originalDimensions = readOptionalOwnProjectionProperty(attachment, "originalDimensions")
  return Object.freeze({
    attachmentId: readOwnProjectionProperty(attachment, "attachmentId"),
    mediaType: readOwnProjectionProperty(attachment, "mediaType"),
    bytes: readOwnProjectionProperty(attachment, "bytes"),
    width: readOwnProjectionProperty(attachment, "width"),
    height: readOwnProjectionProperty(attachment, "height"),
    ...(originalDimensions === undefined
      ? {}
      : { originalDimensions: captureProjectionOriginalDimensions(originalDimensions) }),
  })
}

function captureProjectionOriginalDimensions(dimensions) {
  if (!isPlainObject(dimensions)) throw new InvalidRequestImageProjectionError()
  return Object.freeze({
    width: readOwnProjectionProperty(dimensions, "width"),
    height: readOwnProjectionProperty(dimensions, "height"),
  })
}

function copyRequestImageData(data, maxBytes) {
  if (!(data instanceof Uint8Array)) throw new InvalidRequestImageProjectionError()
  try {
    const byteLength = getTypedArrayByteLength.call(data)
    if (byteLength <= 0 || byteLength > maxBytes) {
      throw new InvalidRequestImageProjectionError()
    }
    const source = new Uint8Array(
      getTypedArrayBuffer.call(data),
      getTypedArrayByteOffset.call(data),
      byteLength,
    )
    const copy = new Uint8Array(byteLength)
    copy.set(source)
    return copy
  } catch (error) {
    if (error instanceof InvalidRequestImageProjectionError) throw error
    throw new InvalidRequestImageProjectionError()
  }
}

function readOwnProjectionProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new InvalidRequestImageProjectionError()
  }
  return descriptor.value
}

function readOptionalOwnProjectionProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  if (descriptor === undefined) return undefined
  if (!("value" in descriptor)) throw new InvalidRequestImageProjectionError()
  return descriptor.value
}

function sameImageRef(left, right) {
  return left.attachmentId === right.attachmentId &&
    left.mediaType === right.mediaType &&
    left.bytes === right.bytes &&
    left.width === right.width &&
    left.height === right.height &&
    sameOriginalDimensions(left.originalDimensions, right.originalDimensions)
}

function sameOriginalDimensions(left, right) {
  if (left === undefined || right === undefined) return left === right
  return isPlainObject(left) && isPlainObject(right) &&
    left.width === right.width && left.height === right.height
}

function hasExpectedMagic(data, mediaType) {
  if (mediaType === "image/jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  }
  return data.length >= 8 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
    data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function isMatchingRoute(options, route) {
  return isPlainObject(options) &&
    isPlainObject(route) &&
    route.backend === "responses" &&
    isPlainObject(route.resolvedModelInfo) &&
    route.resolvedModelInfo.provider === options.provider &&
    route.resolvedModelInfo.id === options.model
}

function captureDataArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new UnsupportedResponsesRequestError()
  }
  const length = readDataArrayLength(value)
  const keys = Reflect.ownKeys(value)
  if (keys.length !== length + 1) throw new UnsupportedResponsesRequestError()
  const snapshot = new Array(length)
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new UnsupportedResponsesRequestError()
    }
    snapshot[index] = descriptor.value
  }
  return Object.freeze(snapshot)
}

function readDataArrayLength(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new UnsupportedResponsesRequestError()
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, "length")
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new UnsupportedResponsesRequestError()
  }
  return descriptor.value
}

function readDataArrayValue(value, index) {
  const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new UnsupportedResponsesRequestError()
  }
  return descriptor.value
}

function readOwnRequestProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  if (descriptor === undefined) return undefined
  if (!("value" in descriptor)) throw new UnsupportedResponsesRequestError()
  return descriptor.value
}

function readOwnImageRefProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  if (descriptor === undefined) return undefined
  if (!("value" in descriptor)) throw new UnsupportedImageInputError()
  return descriptor.value
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

import { GrokTransportError } from "./grok-transport.mjs"
import { PrematureResponsesStreamError } from "./responses-codec.mjs"

const MAX_TRACKED_TEXT_BYTES = 8 * 1024 * 1024
const RECOVERY_NOTICE = "⚠️ Grok 回复连接在完成前中断。上方已收到的内容已保留；为避免重复输出或工具副作用，本插件没有重放请求。请发送“继续”恢复任务。 / The Grok response connection ended before completion. Received content was preserved and the request was not replayed; send ‘continue’ to resume."

export async function* preserveSafePartialResponse(stream) {
  const tracker = createChunkTracker()
  try {
    for await (const chunk of stream) {
      tracker.push(chunk)
      yield chunk
    }
  } catch (error) {
    if (!isRecoverableInterruption(error) || !tracker.canRecover()) throw error
    yield * tracker.finish()
  }
}

function isRecoverableInterruption(error) {
  return (
    (error instanceof GrokTransportError && error.status === undefined) ||
    error instanceof PrematureResponsesStreamError
  )
}

function createChunkTracker() {
  const openBlocks = new Map()
  let maxIndex = -1
  let recoverable = true
  let sawContent = false
  let sawFinish = false

  const observeIndex = (index) => {
    if (!Number.isSafeInteger(index) || index < 0) {
      recoverable = false
      return false
    }
    maxIndex = Math.max(maxIndex, index)
    return true
  }

  return Object.freeze({
    push(chunk) {
      if (!isPlainObject(chunk) || typeof chunk.type !== "string") {
        recoverable = false
        return
      }
      switch (chunk.type) {
        case "block-start": {
          if (!observeIndex(chunk.index) || openBlocks.has(chunk.index)) {
            recoverable = false
            return
          }
          if (chunk.blockType !== "text" && chunk.blockType !== "reasoning") {
            recoverable = false
            return
          }
          openBlocks.set(chunk.index, { type: chunk.blockType, text: "", bytes: 0 })
          break
        }
        case "text-delta":
        case "reasoning-delta": {
          if (!observeIndex(chunk.index) || typeof chunk.text !== "string") {
            recoverable = false
            return
          }
          const block = openBlocks.get(chunk.index)
          const expected = chunk.type === "text-delta" ? "text" : "reasoning"
          if (block?.type !== expected) {
            recoverable = false
            return
          }
          block.bytes += Buffer.byteLength(chunk.text, "utf8")
          if (block.bytes > MAX_TRACKED_TEXT_BYTES) {
            recoverable = false
            return
          }
          block.text += chunk.text
          if (chunk.text.length > 0) sawContent = true
          break
        }
        case "tool-call-delta":
          observeIndex(chunk.index)
          recoverable = false
          break
        case "block-end":
          if (!observeIndex(chunk.index) || !isPlainObject(chunk.block)) {
            recoverable = false
            return
          }
          if (chunk.block.type === "tool-call") recoverable = false
          openBlocks.delete(chunk.index)
          break
        case "usage":
          break
        case "finish":
          sawFinish = true
          break
        default:
          recoverable = false
      }
    },
    canRecover() {
      return recoverable && sawContent && !sawFinish
    },
    *finish() {
      for (const [index, block] of openBlocks) {
        yield { type: "block-end", index, block: { type: block.type, text: block.text } }
      }
      const noticeIndex = maxIndex + 1
      yield { type: "block-start", index: noticeIndex, blockType: "text" }
      yield { type: "text-delta", index: noticeIndex, text: RECOVERY_NOTICE }
      yield {
        type: "block-end",
        index: noticeIndex,
        block: { type: "text", text: RECOVERY_NOTICE },
      }
      yield { type: "finish", reason: { kind: "stop" } }
    },
  })
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

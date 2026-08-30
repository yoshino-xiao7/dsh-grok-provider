const MAX_EVENT_BYTES = 2 * 1024 * 1024
const MAX_STREAM_BYTES = 128 * 1024 * 1024
const MAX_EVENTS = 100_000

export class InvalidResponsesSseError extends Error {
  constructor() {
    super("The Grok Responses event stream is invalid")
    this.name = "InvalidResponsesSseError"
  }
}

class ResponsesSseSourceError {
  constructor(sourceError) {
    this.sourceError = sourceError
  }
}

export async function* parseResponsesSse(source) {
  if (source === null || source === undefined || typeof source[Symbol.asyncIterator] !== "function") {
    throw new TypeError("Responses SSE source must be an async iterable")
  }

  const decoder = new TextDecoder("utf-8", { fatal: true })
  let buffer = ""
  let totalBytes = 0
  let eventBytes = 0
  let eventName
  let dataLines = []
  let eventCount = 0
  let done = false

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = undefined
      eventBytes = 0
      return undefined
    }
    const data = dataLines.join("\n")
    dataLines = []
    eventBytes = 0
    if (data === "[DONE]") {
      if (eventName !== undefined) fail()
      done = true
      return undefined
    }
    if (done) fail()

    let value
    try {
      value = JSON.parse(data)
    } catch {
      fail()
    }
    if (!isPlainObject(value) || typeof value.type !== "string") fail()
    if (eventName !== undefined && eventName !== value.type) fail()
    eventName = undefined
    eventCount += 1
    if (eventCount > MAX_EVENTS) fail()
    return value
  }

  const consumeLine = (rawLine) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
    if (line === "") return dispatch()
    if (line.startsWith(":")) return undefined
    if (done) fail()

    const colon = line.indexOf(":")
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? "" : line.slice(colon + 1)
    if (value.startsWith(" ")) value = value.slice(1)
    eventBytes += Buffer.byteLength(line, "utf8") + 1
    if (eventBytes > MAX_EVENT_BYTES) fail()

    if (field === "event") {
      if (eventName !== undefined || value.length === 0 || value.length > 256) fail()
      eventName = value
    } else if (field === "data") {
      dataLines.push(value)
    } else if (field !== "id") {
      fail()
    }
    return undefined
  }

  try {
    for await (const chunk of preserveSourceErrors(source)) {
      if (!(chunk instanceof Uint8Array)) fail()
      totalBytes += chunk.byteLength
      if (totalBytes > MAX_STREAM_BYTES) fail()
      buffer += decoder.decode(chunk, { stream: true })
      if (Buffer.byteLength(buffer, "utf8") > MAX_EVENT_BYTES) fail()

      let newline
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const value = consumeLine(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        if (value !== undefined) yield value
      }
    }
    buffer += decoder.decode()
    if (buffer.length > 0) {
      const value = consumeLine(buffer)
      if (value !== undefined) yield value
    }
    if (dataLines.length > 0 || eventName !== undefined) {
      const value = dispatch()
      if (value !== undefined) yield value
    }
  } catch (error) {
    if (error instanceof ResponsesSseSourceError) throw error.sourceError
    if (error instanceof InvalidResponsesSseError || error instanceof TypeError) throw error
    if (error?.name === "AbortError") throw error
    throw new InvalidResponsesSseError()
  } finally {
    buffer = ""
    dataLines = []
    eventName = undefined
  }
}

async function* preserveSourceErrors(source) {
  try {
    for await (const chunk of source) yield chunk
  } catch (error) {
    throw new ResponsesSseSourceError(error)
  }
}

function fail() {
  throw new InvalidResponsesSseError()
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

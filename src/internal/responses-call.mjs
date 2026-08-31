import {
  InvalidResponsesStreamError,
  PrematureResponsesStreamError,
  createResponsesEventDecoder,
} from "./responses-codec.mjs"
import { createResponsesRequestCompiler } from "./responses-request-compiler.mjs"
import { parseResponsesSse } from "./responses-sse.mjs"

export function createResponsesCallProtocol({
  getAttachmentStore = () => undefined,
  searchPolicy,
} = {}) {
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore,
    searchPolicy,
  })

  return Object.freeze({
    prepare(options) {
      const requestPlan = compiler.prepare(options)
      return Object.freeze({
        provider: requestPlan.provider,
        model: requestPlan.model,
        reasoningEffort: requestPlan.reasoningEffort,
        signal: requestPlan.signal,
        stream({ route, transport }) {
          if (
            !isPlainObject(route) ||
            !transport ||
            typeof transport.streamResponses !== "function"
          ) {
            throw new TypeError("Invalid Grok Responses call target")
          }
          return streamPreparedCall({ requestPlan, route, transport })
        },
      })
    },
  })
}

async function* streamPreparedCall({ requestPlan, route, transport }) {
  const compiled = await requestPlan.compile(route)
  if (
    !isPlainObject(compiled) ||
    !isPlainObject(compiled.request) ||
    !isPlainObject(compiled.receipt)
  ) {
    throw new TypeError("Invalid compiled Grok Responses call")
  }

  const decoder = createResponsesEventDecoder(compiled.receipt)
  for await (const event of parseResponsesSse(
    transport.streamResponses(compiled.request, { signal: requestPlan.signal }),
  )) {
    for (const chunk of decoder.push(event)) yield chunk
  }
  try {
    decoder.finish()
  } catch (error) {
    if (error instanceof InvalidResponsesStreamError) throw new PrematureResponsesStreamError()
    throw error
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

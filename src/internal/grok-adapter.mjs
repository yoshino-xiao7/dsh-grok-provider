import { parseModelCatalogResponse } from "./model-catalog.mjs"
import { createResponsesEventDecoder } from "./responses-codec.mjs"
import { encodeResponsesRequest } from "./responses-request.mjs"
import { parseResponsesSse } from "./responses-sse.mjs"

export class GrokAdapterError extends Error {
  constructor() {
    super("The requested Grok model or adapter generation is unavailable")
    this.name = "GrokAdapterError"
  }
}

export function createGrokAdapter({ getGeneration, mapError = (error) => error }) {
  if (typeof getGeneration !== "function") {
    throw new TypeError("A Grok adapter generation source is required")
  }
  if (typeof mapError !== "function") throw new TypeError("Invalid Grok adapter error mapper")

  const captureGeneration = () => {
    const generation = getGeneration()
    if (
      !isPlainObject(generation) ||
      !generation.transport ||
      typeof generation.transport.listModels !== "function" ||
      typeof generation.transport.streamResponses !== "function"
    ) {
      throw new GrokAdapterError()
    }
    return generation
  }

  const resolveWithGeneration = async (generation, provider, model, signal) => {
    try {
      requireProvider(provider)
      if (typeof model !== "string" || model.length === 0) throw new GrokAdapterError()
      const entries = await discover(generation, provider, signal)
      const match = entries.find((entry) => entry.resolvedModelInfo.id === model)
      if (match === undefined) throw new GrokAdapterError()
      return match.resolvedModelInfo
    } catch (error) {
      throw mapError(error)
    }
  }

  return Object.freeze({
    providerInfo(provider) {
      requireProvider(provider)
      return Object.freeze({ id: "grok", name: "Grok Build" })
    },

    providerRetryPolicy(provider) {
      requireProvider(provider)
      return undefined
    },

    async listModels(provider) {
      try {
        requireProvider(provider)
        const entries = await discover(captureGeneration(), provider)
        return Object.freeze(entries.map((entry) => entry.resolvedModelInfo))
      } catch (error) {
        throw mapError(error)
      }
    },

    async resolveModel(provider, model, signal) {
      return resolveWithGeneration(captureGeneration(), provider, model, signal)
    },

    async prepareCall(provider, model, signal) {
      const generation = captureGeneration()
      const resolvedModel = await resolveWithGeneration(generation, provider, model, signal)
      return Object.freeze({
        model: resolvedModel,
        stream(options) {
          try {
            validatePreparedOptions(options, resolvedModel)
            return streamWithGeneration(generation, options, mapError)
          } catch (error) {
            throw mapError(error)
          }
        },
      })
    },

    stream(options) {
      try {
        return streamWithGeneration(captureGeneration(), options, mapError)
      } catch (error) {
        throw mapError(error)
      }
    },
  })
}

async function discover(generation, provider, signal) {
  const raw = await generation.transport.listModels({ signal })
  return parseModelCatalogResponse(raw, { provider }).map((entry) => Object.freeze({
    backend: entry.backend,
    resolvedModelInfo: freezeModel(entry.resolvedModelInfo),
  }))
}

async function* streamWithGeneration(generation, options, mapError) {
  try {
    requireProvider(options?.provider)
    const request = encodeResponsesRequest(options)
    const decoder = createResponsesEventDecoder()
    for await (const event of parseResponsesSse(
      generation.transport.streamResponses(request, { signal: options.signal }),
    )) {
      for (const chunk of decoder.push(event)) yield chunk
    }
    decoder.finish()
  } catch (error) {
    throw mapError(error)
  }
}

function validatePreparedOptions(options, resolvedModel) {
  if (!isPlainObject(options) || options.provider !== "grok" || options.model !== resolvedModel.id) {
    throw new GrokAdapterError()
  }
  if (options.reasoningEffort !== undefined) {
    const efforts = resolvedModel.reasoning?.efforts
    if (!Array.isArray(efforts) || !efforts.some((effort) => effort.id === options.reasoningEffort)) {
      throw new GrokAdapterError()
    }
  }
}

function freezeModel(model) {
  const frozen = {
    ...model,
    inputModalities: model.inputModalities === undefined
      ? undefined
      : Object.freeze([...model.inputModalities]),
    context: model.context === undefined ? undefined : Object.freeze({ ...model.context }),
    reasoning: model.reasoning === undefined
      ? undefined
      : Object.freeze({
        ...model.reasoning,
        efforts: Object.freeze(model.reasoning.efforts.map((effort) => Object.freeze({ ...effort }))),
      }),
  }
  if (frozen.inputModalities === undefined) delete frozen.inputModalities
  if (frozen.context === undefined) delete frozen.context
  if (frozen.reasoning === undefined) delete frozen.reasoning
  return Object.freeze(frozen)
}

function requireProvider(provider) {
  if (provider !== "grok") throw new GrokAdapterError()
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

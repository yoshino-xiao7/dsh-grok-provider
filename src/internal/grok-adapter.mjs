import { parseModelCatalogResponse } from "./model-catalog.mjs"
import { createResponsesEventDecoder } from "./responses-codec.mjs"
import { createResponsesRequestCompiler } from "./responses-request-compiler.mjs"
import { parseResponsesSse } from "./responses-sse.mjs"

export class GrokAdapterError extends Error {
  constructor() {
    super("The requested Grok model or adapter generation is unavailable")
    this.name = "GrokAdapterError"
  }
}

export function createGrokAdapter({
  getGeneration,
  getAttachmentStore = () => undefined,
  mapError = (error) => error,
}) {
  if (typeof getGeneration !== "function") {
    throw new TypeError("A Grok adapter generation source is required")
  }
  if (typeof mapError !== "function") throw new TypeError("Invalid Grok adapter error mapper")
  const requestCompiler = createResponsesRequestCompiler({ getAttachmentStore })

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

  const resolveRouteWithGeneration = async (generation, provider, model, signal) => {
    requireProvider(provider)
    if (typeof model !== "string" || model.length === 0) throw new GrokAdapterError()
    const entries = await discover(generation, provider, signal)
    const match = entries.find((entry) => entry.resolvedModelInfo.id === model)
    if (match === undefined) throw new GrokAdapterError()
    return match
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
      try {
        const route = await resolveRouteWithGeneration(captureGeneration(), provider, model, signal)
        return route.resolvedModelInfo
      } catch (error) {
        throw mapError(error, signal)
      }
    },

    async prepareCall(provider, model, signal) {
      try {
        const generation = captureGeneration()
        const route = await resolveRouteWithGeneration(generation, provider, model, signal)
        return Object.freeze({
          model: route.resolvedModelInfo,
          stream(options) {
            let requestPlan
            try {
              requestPlan = requestCompiler.prepare(options)
              validatePreparedRequestPlan(requestPlan, route.resolvedModelInfo)
              return streamWithGeneration(generation, route, requestPlan, mapError)
            } catch (error) {
              throw mapError(error, requestPlan?.signal ?? readOwnDataSignal(options))
            }
          },
        })
      } catch (error) {
        throw mapError(error, signal)
      }
    },

    stream(options) {
      let requestPlan
      try {
        requestPlan = requestCompiler.prepare(options)
        return streamWithGeneration(captureGeneration(), undefined, requestPlan, mapError)
      } catch (error) {
        throw mapError(error, requestPlan?.signal ?? readOwnDataSignal(options))
      }
    },
  })
}

async function discover(generation, provider, signal) {
  const raw = await generation.transport.listModels({ signal })
  return parseModelCatalogResponse(raw, { provider }).map((entry) => Object.freeze({
    backend: entry.backend,
    resolvedModelInfo: freezeModel(entry.resolvedModelInfo),
    ...(entry.imageInput === undefined ? {} : { imageInput: entry.imageInput }),
  }))
}

async function* streamWithGeneration(generation, preparedRoute, requestPlan, mapError) {
  try {
    requireProvider(requestPlan.provider)
    const route = preparedRoute ?? await resolveRoute(generation, requestPlan)
    const request = await requestPlan.compile(route)
    const decoder = createResponsesEventDecoder()
    for await (const event of parseResponsesSse(
      generation.transport.streamResponses(request, { signal: requestPlan.signal }),
    )) {
      for (const chunk of decoder.push(event)) yield chunk
    }
    decoder.finish()
  } catch (error) {
    throw mapError(error, requestPlan.signal)
  }
}

async function resolveRoute(generation, options) {
  if (typeof options?.model !== "string" || options.model.length === 0) {
    throw new GrokAdapterError()
  }
  const entries = await discover(generation, options.provider, options.signal)
  const route = entries.find((entry) => entry.resolvedModelInfo.id === options.model)
  if (route === undefined) throw new GrokAdapterError()
  return route
}

function validatePreparedRequestPlan(requestPlan, resolvedModel) {
  if (
    !isPlainObject(requestPlan) ||
    requestPlan.provider !== "grok" ||
    requestPlan.model !== resolvedModel.id
  ) {
    throw new GrokAdapterError()
  }
  if (requestPlan.reasoningEffort !== undefined) {
    const efforts = resolvedModel.reasoning?.efforts
    if (
      !Array.isArray(efforts) ||
      !efforts.some((effort) => effort.id === requestPlan.reasoningEffort)
    ) {
      throw new GrokAdapterError()
    }
  }
}

function readOwnDataSignal(options) {
  try {
    if (!isPlainObject(options)) return undefined
    const descriptor = Object.getOwnPropertyDescriptor(options, "signal")
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined
  } catch {
    return undefined
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

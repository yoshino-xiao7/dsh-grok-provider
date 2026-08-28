const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const MAX_CATALOG_BYTES = 256 * 1024
const MAX_MODELS = 256
const MAX_REASONING_EFFORTS = 16
const IMAGE_INPUT_MODEL_IDS = new Set(["grok-4.6"])
const IMAGE_INPUT_PROFILE = Object.freeze({
  readPolicy: Object.freeze({
    maxBytes: 4 * 1024 * 1024,
    maxPixels: 16 * 1024 * 1024,
  }),
  maxDimension: 8192,
  maxImages: 8,
  maxTotalBytes: 8 * 1024 * 1024,
  mediaTypes: Object.freeze(["image/jpeg", "image/png"]),
})

export class InvalidModelCatalogError extends Error {
  constructor() {
    super("The Grok model catalog response is invalid or unsupported")
    this.name = "InvalidModelCatalogError"
  }
}

export function parseModelCatalogResponse(raw, { provider }) {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > MAX_CATALOG_BYTES) {
    throw new InvalidModelCatalogError()
  }
  if (typeof provider !== "string" || provider.length === 0) {
    throw new TypeError("A provider id is required")
  }

  let value
  try {
    value = JSON.parse(raw)
  } catch {
    throw new InvalidModelCatalogError()
  }

  if (!isPlainObject(value) || value.object !== "list" || !Array.isArray(value.data)) {
    throw new InvalidModelCatalogError()
  }
  if (value.data.length > MAX_MODELS) throw new InvalidModelCatalogError()

  const seen = new Set()
  return value.data.map((model) => {
    const entry = parseModel(model, provider)
    if (seen.has(entry.resolvedModelInfo.id)) throw new InvalidModelCatalogError()
    seen.add(entry.resolvedModelInfo.id)
    return entry
  })
}

function parseModel(model, provider) {
  if (
    !isPlainObject(model) ||
    typeof model.id !== "string" ||
    !MODEL_ID_PATTERN.test(model.id) ||
    typeof model.name !== "string" ||
    model.name.length === 0 ||
    model.name.length > 128 ||
    (model.description !== undefined && (
      typeof model.description !== "string" ||
      model.description.length > 1024
    )) ||
    !Number.isSafeInteger(model.context_window) ||
    model.context_window <= 0 ||
    model.context_window > 10_000_000 ||
    model.api_backend !== "responses"
  ) {
    throw new InvalidModelCatalogError()
  }

  const imageInput = IMAGE_INPUT_MODEL_IDS.has(model.id) ? IMAGE_INPUT_PROFILE : undefined
  const resolvedModelInfo = {
    provider,
    id: model.id,
    name: model.name,
    ...(model.description === undefined ? {} : { description: model.description }),
    inputModalities: imageInput === undefined ? ["text"] : ["text", "image"],
    context: { contextWindow: model.context_window },
    ...parseReasoning(model),
  }

  return {
    backend: model.api_backend,
    resolvedModelInfo,
    ...(imageInput === undefined ? {} : { imageInput }),
  }
}

function parseReasoning(model) {
  if (model.supports_reasoning_effort !== true) return {}
  if (!Array.isArray(model.reasoning_efforts)) throw new InvalidModelCatalogError()
  if (
    model.reasoning_efforts.length === 0 ||
    model.reasoning_efforts.length > MAX_REASONING_EFFORTS
  ) {
    throw new InvalidModelCatalogError()
  }

  const seen = new Set()
  let defaultEffort
  const efforts = model.reasoning_efforts.map((effort) => {
    if (
      !isPlainObject(effort) ||
      typeof effort.id !== "string" ||
      !MODEL_ID_PATTERN.test(effort.id) ||
      effort.value !== effort.id ||
      typeof effort.label !== "string" ||
      effort.label.length === 0 ||
      effort.label.length > 128 ||
      (effort.description !== undefined && (
        typeof effort.description !== "string" ||
        effort.description.length > 512
      )) ||
      typeof effort.default !== "boolean" ||
      seen.has(effort.id)
    ) {
      throw new InvalidModelCatalogError()
    }
    seen.add(effort.id)
    if (effort.default) {
      if (defaultEffort !== undefined) throw new InvalidModelCatalogError()
      defaultEffort = effort.id
    }
    return {
      id: effort.id,
      name: effort.label,
      ...(effort.description === undefined ? {} : { description: effort.description }),
    }
  })

  if (model.reasoning_effort !== undefined) {
    if (typeof model.reasoning_effort !== "string" || !seen.has(model.reasoning_effort)) {
      throw new InvalidModelCatalogError()
    }
    if (defaultEffort !== undefined && defaultEffort !== model.reasoning_effort) {
      throw new InvalidModelCatalogError()
    }
    defaultEffort = model.reasoning_effort
  }

  return {
    reasoning: {
      efforts,
      ...(defaultEffort === undefined ? {} : { defaultEffort }),
    },
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

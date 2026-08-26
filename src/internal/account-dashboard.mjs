import { parseBillingSummary } from "./billing-summary.mjs"

export function createAccountDashboard({ listModels, getBilling, now }) {
  if (typeof listModels !== "function" || typeof getBilling !== "function" || typeof now !== "function") {
    throw new TypeError("Invalid Grok account dashboard dependencies")
  }

  return async function getAccountDashboard({ signal } = {}) {
    const [modelResult, quotaResult] = await Promise.allSettled([
      Promise.resolve().then(() => listModels({ signal })).then((models) => models.map(projectModel)),
      Promise.resolve().then(() => getBilling({ signal })).then(parseBillingSummary),
    ])
    const currentTime = now()
    if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
      throw new TypeError("Invalid Grok account dashboard clock")
    }
    return Object.freeze({
      fetchedAt: currentTime.toISOString(),
      models: modelResult.status === "fulfilled"
        ? Object.freeze({ state: "ready", items: Object.freeze(modelResult.value) })
        : Object.freeze({ state: "unavailable", items: Object.freeze([]) }),
      quota: quotaResult.status === "fulfilled"
        ? quotaResult.value
        : Object.freeze({ state: "unavailable" }),
    })
  }
}

function projectModel(model) {
  if (
    !isPlainObject(model) ||
    typeof model.id !== "string" ||
    typeof model.name !== "string" ||
    !isPlainObject(model.context) ||
    !Number.isSafeInteger(model.context.contextWindow)
  ) throw new TypeError("Invalid Grok dashboard model")
  return Object.freeze({
    id: model.id,
    name: model.name,
    ...(typeof model.description === "string" ? { description: model.description } : {}),
    contextWindow: model.context.contextWindow,
    ...(model.reasoning === undefined ? {} : { reasoning: projectReasoning(model.reasoning) }),
    capabilities: Object.freeze({ textInput: true, streaming: true, functionTools: true }),
  })
}

function projectReasoning(reasoning) {
  if (!isPlainObject(reasoning) || !Array.isArray(reasoning.efforts)) {
    throw new TypeError("Invalid Grok dashboard reasoning capability")
  }
  const efforts = reasoning.efforts.map((effort) => {
    if (!isPlainObject(effort) || typeof effort.id !== "string" || typeof effort.name !== "string") {
      throw new TypeError("Invalid Grok dashboard reasoning effort")
    }
    return Object.freeze({ id: effort.id, name: effort.name })
  })
  return Object.freeze({
    efforts: Object.freeze(efforts),
    ...(typeof reasoning.defaultEffort === "string" ? { defaultEffort: reasoning.defaultEffort } : {}),
  })
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

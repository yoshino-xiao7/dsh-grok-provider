const CLI_STATES = new Set(["missing", "invalid", "unavailable"])

export function createRuntimeDiagnostics({ pluginVersion, getCliInspector }) {
  if (!isSafeVersion(pluginVersion) || typeof getCliInspector !== "function") {
    throw new TypeError("Invalid Grok runtime diagnostics dependencies")
  }

  let active

  async function read({ signal } = {}) {
    signal?.throwIfAborted()
    const inspector = getCliInspector()
    if (inspector === undefined) {
      return frozenDiagnostics(pluginVersion, { state: "unavailable" })
    }
    if (typeof inspector !== "function") {
      throw new TypeError("Invalid Grok CLI diagnostics inspector")
    }
    if (active !== undefined && active.inspector !== inspector) {
      return frozenDiagnostics(pluginVersion, { state: "unavailable" })
    }
    const operation = active ?? startInspection(inspector)
    const cli = normalizeCliDiagnostic(await waitForInspection(operation, signal))
    signal?.throwIfAborted()
    return frozenDiagnostics(pluginVersion, cli)
  }

  function startInspection(inspector) {
    const controller = new AbortController()
    const operation = {
      inspector,
      controller,
      completion: undefined,
      waiters: 0,
    }
    operation.completion = Promise.resolve().then(() => inspector({ signal: controller.signal })).finally(() => {
      if (active === operation) active = undefined
    })
    active = operation
    return operation
  }

  async function disposeInspector(inspector) {
    if (typeof inspector !== "function") {
      throw new TypeError("Invalid Grok CLI diagnostics inspector")
    }
    const operation = active
    if (operation === undefined || operation.inspector !== inspector) return false
    operation.controller.abort(new DOMException("Grok CLI diagnostics disposed", "AbortError"))
    try {
      await operation.completion
    } catch (error) {
      if (error?.name !== "AbortError") throw error
    }
    return true
  }

  return Object.freeze({ read, disposeInspector })
}

export function normalizeRuntimeDiagnostics(value) {
  if (!hasExactKeys(value, ["pluginVersion", "cli"]) || !isSafeVersion(value.pluginVersion)) {
    throw new TypeError("Invalid Grok runtime diagnostics")
  }
  return frozenDiagnostics(value.pluginVersion, normalizeCliDiagnostic(value.cli))
}

function normalizeCliDiagnostic(value) {
  if (!isPlainObject(value)) throw new TypeError("Invalid Grok CLI diagnostic")
  if (value.state === "ready") {
    if (!hasExactKeys(value, ["state", "version"]) || !isSafeVersion(value.version)) {
      throw new TypeError("Invalid Grok CLI diagnostic")
    }
    return Object.freeze({ state: "ready", version: value.version })
  }
  if (!CLI_STATES.has(value.state) || !hasExactKeys(value, ["state"])) {
    throw new TypeError("Invalid Grok CLI diagnostic")
  }
  return Object.freeze({ state: value.state })
}

function frozenDiagnostics(pluginVersion, cli) {
  return Object.freeze({ pluginVersion, cli: Object.freeze({ ...cli }) })
}

async function waitForInspection(operation, signal) {
  signal?.throwIfAborted()
  operation.waiters += 1
  if (signal === undefined) {
    try {
      return await operation.completion
    } finally {
      operation.waiters -= 1
    }
  }
  let onAbort
  let callerAborted = false
  const aborted = new Promise((_, reject) => {
    onAbort = () => {
      callerAborted = true
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
  try {
    return await Promise.race([operation.completion, aborted])
  } finally {
    signal.removeEventListener("abort", onAbort)
    operation.waiters -= 1
    if (callerAborted && operation.waiters === 0) {
      operation.controller.abort(signal.reason ?? new DOMException("Aborted", "AbortError"))
    }
  }
}

function isSafeVersion(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 64 &&
    /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/u.test(value)
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index])
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

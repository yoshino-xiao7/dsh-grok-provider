import { createAuthRegistry } from "./auth-registry.mjs"

export function installProviderRuntime({
  llm,
  officialSource,
  createTransport,
  createAdapter,
}) {
  if (
    !llm ||
    typeof llm.registerAdapter !== "function" ||
    typeof llm.registerConfigurableProviders !== "function" ||
    !officialSource ||
    typeof createTransport !== "function" ||
    typeof createAdapter !== "function"
  ) {
    throw new TypeError("Invalid Grok provider runtime dependencies")
  }

  const auth = createAuthRegistry({ createTransport })
  const removeOfficial = auth.install(officialSource)
  let adapter
  try {
    adapter = createAdapter({ getGeneration: () => auth.getGeneration() })
  } catch (error) {
    rollbackInstall(error, [removeOfficial])
  }
  let removeAdapter
  try {
    removeAdapter = llm.registerAdapter(["grok"], adapter)
  } catch (error) {
    rollbackInstall(error, [removeOfficial])
  }
  let removeDirectory
  try {
    removeDirectory = llm.registerConfigurableProviders([{
      provider: "grok",
      displayName: "Grok Build",
      settingsNs: "llm-grok",
      settingsPath: [],
    }])
  } catch (error) {
    rollbackInstall(error, [removeAdapter, removeOfficial])
  }
  let disposed = false

  return Object.freeze({
    adapter,
    auth,
    dispose() {
      if (disposed) return
      disposed = true
      disposeAll([removeDirectory, removeAdapter, removeOfficial])
    },
  })
}

function disposeAll(disposers) {
  const failures = runDisposers(disposers)
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, "Grok provider runtime disposal failed")
  }
}

function rollbackInstall(error, disposers) {
  const failures = runDisposers(disposers)
  if (failures.length === 0) throw error
  throw new AggregateError(
    [error, ...failures],
    "Grok provider runtime installation and rollback failed",
  )
}

function runDisposers(disposers) {
  const failures = []
  for (const dispose of disposers) {
    try {
      dispose()
    } catch (error) {
      failures.push(error)
    }
  }
  return failures
}

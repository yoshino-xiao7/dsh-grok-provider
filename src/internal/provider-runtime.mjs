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
  const adapter = createAdapter({ getGeneration: () => auth.getGeneration() })
  const removeAdapter = llm.registerAdapter(["grok"], adapter)
  const removeDirectory = llm.registerConfigurableProviders([{
    provider: "grok",
    displayName: "Grok Build",
    settingsNs: "llm-grok",
    settingsPath: [],
  }])
  let disposed = false

  return Object.freeze({
    adapter,
    auth,
    dispose() {
      if (disposed) return
      disposed = true
      removeDirectory()
      removeAdapter()
      removeOfficial()
    },
  })
}

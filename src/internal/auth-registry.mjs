const MODES = new Set(["official-cli", "managed-device"])

export class AuthModeUnavailableError extends Error {
  constructor() {
    super("The selected Grok authentication mode is unavailable")
    this.name = "AuthModeUnavailableError"
  }
}

export function createAuthRegistry({ initialMode, createTransport }) {
  requireMode(initialMode)
  if (typeof createTransport !== "function") {
    throw new TypeError("A Grok transport factory is required")
  }

  const entries = new Map()
  let selectedMode = initialMode
  let generation = 0

  return Object.freeze({
    install(mode, source) {
      requireMode(mode)
      if (!source || typeof source !== "object") throw new TypeError("Invalid Grok credential source")
      const token = Object.freeze({})
      const transport = createTransport(source)
      if (!transport || typeof transport !== "object") throw new TypeError("Invalid Grok transport")
      entries.set(mode, { source, transport, token })
      generation += 1
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        if (entries.get(mode)?.token === token) {
          entries.delete(mode)
          generation += 1
        }
      }
    },

    select(mode) {
      requireMode(mode)
      if (selectedMode !== mode) {
        selectedMode = mode
        generation += 1
      }
    },

    invalidate() {
      generation += 1
    },

    getGeneration() {
      const entry = entries.get(selectedMode)
      if (entry === undefined) throw new AuthModeUnavailableError()
      return Object.freeze({
        id: generation,
        mode: selectedMode,
        transport: entry.transport,
      })
    },

    status() {
      return Object.freeze({
        selectedMode,
        generation,
        available: Object.freeze({
          "official-cli": entries.has("official-cli"),
          "managed-device": entries.has("managed-device"),
        }),
      })
    },
  })
}

function requireMode(mode) {
  if (!MODES.has(mode)) throw new TypeError("Invalid Grok authentication mode")
}

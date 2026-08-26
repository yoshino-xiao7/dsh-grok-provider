export class AuthModeUnavailableError extends Error {
  constructor() {
    super("The official Grok authentication source is unavailable")
    this.name = "AuthModeUnavailableError"
  }
}

export function createAuthRegistry({ createTransport }) {
  if (typeof createTransport !== "function") {
    throw new TypeError("A Grok transport factory is required")
  }

  let entry
  let generation = 0

  return Object.freeze({
    install(source) {
      if (!source || typeof source !== "object") throw new TypeError("Invalid Grok credential source")
      const token = Object.freeze({})
      const transport = createTransport(source)
      if (!transport || typeof transport !== "object") throw new TypeError("Invalid Grok transport")
      entry = { transport, token }
      generation += 1
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        if (entry?.token === token) {
          entry = undefined
          generation += 1
        }
      }
    },

    invalidate() {
      generation += 1
    },

    getGeneration() {
      if (entry === undefined) throw new AuthModeUnavailableError()
      return Object.freeze({ id: generation, transport: entry.transport })
    },

    status() {
      return Object.freeze({ generation, available: entry !== undefined })
    },
  })
}

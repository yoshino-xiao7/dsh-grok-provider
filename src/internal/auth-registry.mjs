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
      entry = { source, transport, token }
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

    async status() {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const snapshot = entry
        const snapshotGeneration = generation
        let available = false
        if (snapshot !== undefined && typeof snapshot.source.withAccessToken === "function") {
          try {
            await snapshot.source.withAccessToken(() => undefined)
            available = true
          } catch {
            available = false
          }
        }
        if (entry === snapshot && generation === snapshotGeneration) {
          return Object.freeze({ generation: snapshotGeneration, available })
        }
      }
      return Object.freeze({ generation, available: false })
    },
  })
}

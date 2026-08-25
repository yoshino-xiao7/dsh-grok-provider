const OUTCOMES = new Set(["succeeded", "cancelled"])

export function createOfficialAuthDriver({ officialAuth, credentialSource }) {
  if (
    !officialAuth ||
    typeof officialAuth.login !== "function" ||
    typeof officialAuth.logout !== "function" ||
    !credentialSource ||
    typeof credentialSource.withAccessToken !== "function"
  ) throw new TypeError("Invalid official Grok authentication driver dependencies")

  return Object.freeze({
    async begin({ signal } = {}) {
      return Object.freeze({
        completion: (async () => {
          const outcome = await officialAuth.login({ signal })
          validateOutcome(outcome)
          if (outcome.kind !== "succeeded") return outcome
          await credentialSource.withAccessToken(async () => undefined)
          return outcome
        })(),
      })
    },

    async logout({ signal } = {}) {
      const outcome = await officialAuth.logout({ signal })
      validateOutcome(outcome)
      return outcome
    },
  })
}

function validateOutcome(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    !OUTCOMES.has(value.kind) ||
    Object.keys(value).length !== 1
  ) throw new TypeError("Invalid official Grok authentication outcome")
}

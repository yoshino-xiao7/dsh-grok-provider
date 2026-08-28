import { OfficialCliCleanupError } from "./official-cli-auth.mjs"

const OUTCOMES = new Set(["succeeded", "cancelled", "cleanup-failed"])

export function createOfficialAuthDriver({ officialAuth, credentialSource }) {
  if (
    !officialAuth ||
    typeof officialAuth.login !== "function" ||
    typeof officialAuth.logout !== "function" ||
    typeof officialAuth.refresh !== "function" ||
    !credentialSource ||
    typeof credentialSource.withAccessToken !== "function"
  ) throw new TypeError("Invalid official Grok authentication driver dependencies")

  return Object.freeze({
    async begin({ signal } = {}) {
      return Object.freeze({
        completion: (async () => {
          const outcome = await runOfficialAction(() => officialAuth.login({ signal }))
          validateOutcome(outcome)
          if (outcome.kind !== "succeeded") return outcome
          await credentialSource.withAccessToken(async () => undefined)
          return outcome
        })(),
      })
    },

    async logout({ signal } = {}) {
      const outcome = await runOfficialAction(() => officialAuth.logout({ signal }))
      validateOutcome(outcome)
      return outcome
    },

    async refresh({ signal } = {}) {
      const outcome = await runOfficialAction(() => officialAuth.refresh({ signal }))
      validateOutcome(outcome)
      return outcome
    },
  })
}

async function runOfficialAction(operation) {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof OfficialCliCleanupError) {
      return Object.freeze({ kind: "cleanup-failed" })
    }
    throw error
  }
}

function validateOutcome(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    !OUTCOMES.has(value.kind) ||
    Object.keys(value).length !== 1
  ) throw new TypeError("Invalid official Grok authentication outcome")
}

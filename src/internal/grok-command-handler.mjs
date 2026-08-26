import { parseGrokCommandInput } from "./grok-command.mjs"

const USAGE = "Usage: /grok status|login|cancel|logout"

export function createGrokCommandHandler({ controller }) {
  if (
    !controller ||
    typeof controller.status !== "function" ||
    typeof controller.beginLogin !== "function" ||
    typeof controller.cancel !== "function" ||
    typeof controller.logout !== "function"
  ) throw new TypeError("Invalid Grok command controller")

  return async function handleGrokCommand({ rawInput, signal } = {}) {
    const command = parseGrokCommandInput(rawInput)
    if (command === undefined) return error(USAGE)

    try {
      if (command.verb === "status") {
        const status = controller.status()
        return success(`Grok official CLI auth: ${renderStatus(status)}`)
      }
      if (command.verb === "login") {
        const session = await controller.beginLogin()
        const outcome = await session.wait({ signal })
        return outcome.kind === "succeeded"
          ? success("Grok official CLI login succeeded")
          : error(`Grok official CLI login ${outcome.kind}`)
      }
      if (command.verb === "cancel") {
        const sessionId = controller.status().session?.sessionId
        return typeof sessionId === "string" && controller.cancel(sessionId)
          ? success("Grok login cancellation requested")
          : error("No Grok login is running")
      }
      if (command.verb === "logout") {
        const outcome = await controller.logout({ signal })
        return outcome.kind === "succeeded"
          ? success("Grok official CLI logout succeeded")
          : outcome.kind === "confirmation-required"
            ? success("Repeat /grok logout within 30 seconds to confirm")
            : error(`Grok official CLI logout ${outcome.kind}`)
      }
      return error(USAGE)
    } catch {
      return error("The Grok authentication operation failed")
    }
  }
}

function renderStatus(status) {
  if (status.session?.state === "running") return "running"
  return status.driver && status.available ? "ready" : "unavailable"
}

function success(text) {
  return Object.freeze({ kind: "success", text })
}

function error(text) {
  return Object.freeze({ kind: "error", text })
}

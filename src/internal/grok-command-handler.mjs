import { parseGrokCommandInput } from "./grok-command.mjs"

const USAGE = "Usage: /grok status|use <mode>|login [mode]|cancel|logout <mode>"

export function createGrokCommandHandler({ controller }) {
  if (
    !controller ||
    typeof controller.status !== "function" ||
    typeof controller.use !== "function" ||
    typeof controller.beginLogin !== "function" ||
    typeof controller.cancel !== "function"
  ) throw new TypeError("Invalid Grok command controller")

  return async function handleGrokCommand({ rawInput, signal } = {}) {
    const command = parseGrokCommandInput(rawInput)
    if (command === undefined) return error(USAGE)

    try {
      if (command.verb === "status") {
        const status = controller.status()
        return success(
          `Grok auth: ${status.selectedMode}; ` +
          `official-cli=${renderMode(status, "official-cli")}; ` +
          `managed-device=${renderMode(status, "managed-device")}`,
        )
      }
      if (command.verb === "use") {
        controller.use(command.mode)
        return success(`Grok auth mode selected: ${command.mode}`)
      }
      if (command.verb === "login") {
        const mode = command.mode ?? controller.status().selectedMode
        const session = await controller.beginLogin(mode)
        if (mode === "managed-device") {
          return success(
            `Open ${session.public.verificationUri} and enter code ${session.public.userCode}; ` +
            `session ${session.public.sessionId} is running`,
          )
        }
        const outcome = await session.wait({ signal })
        return outcome.kind === "succeeded"
          ? success(`Grok ${mode} login succeeded`)
          : error(`Grok ${mode} login ${outcome.kind}`)
      }
      if (command.verb === "cancel") {
        const mode = controller.status().selectedMode
        const sessionId = controller.status().sessions?.[mode]?.sessionId
        return typeof sessionId === "string" && controller.cancel(mode, sessionId)
          ? success("Grok login cancellation requested")
          : error("No Grok login is running for the selected mode")
      }
      if (command.verb === "logout") {
        if (typeof controller.logout !== "function") return error("Grok logout is unavailable")
        const outcome = await controller.logout(command.mode, { signal })
        return outcome.kind === "succeeded"
          ? success(`Grok ${command.mode} logout succeeded`)
          : outcome.kind === "confirmation-required"
            ? success(`Repeat /grok logout ${command.mode} within 30 seconds to confirm`)
            : error(`Grok ${command.mode} logout ${outcome.kind}`)
      }
      return error(USAGE)
    } catch {
      return error("The Grok authentication operation failed")
    }
  }
}

function renderMode(status, mode) {
  const session = status.sessions?.[mode]
  if (session?.state === "running") return "running"
  return status.drivers?.[mode] ? "ready" : "unavailable"
}

function success(text) {
  return Object.freeze({ kind: "success", text })
}

function error(text) {
  return Object.freeze({ kind: "error", text })
}

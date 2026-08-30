import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import packageJson from "../../package.json" with { type: "json" }

import { attributionHeaders } from "@deepseek-ai/dsh-llm"
import Schema from "@deepseek-ai/schemastery"

import {
  GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  UnsupportedCredentialError,
  createCredentialSource,
} from "../internal/credential-source.mjs"
import { createAccountDashboard } from "../internal/account-dashboard.mjs"
import { createAuthController } from "../internal/auth-controller.mjs"
import { createAuthRpcHandler } from "../internal/auth-rpc.mjs"
import { createGrokAdapter } from "../internal/grok-adapter.mjs"
import { createGrokCommandHandler } from "../internal/grok-command-handler.mjs"
import { createGrokTransport } from "../internal/grok-transport.mjs"
import { mapLlmError } from "../internal/llm-error.mjs"
import { createOfficialCredentialLoader } from "../internal/official-credential-loader.mjs"
import { createOfficialCliAuth } from "../internal/official-cli-auth.mjs"
import { createOfficialAuthDriver } from "../internal/official-auth-driver.mjs"
import { verifyOfficialCliExecutable } from "../internal/official-cli-verifier.mjs"
import { installProviderRuntime } from "../internal/provider-runtime.mjs"
import { createRuntimeDiagnostics } from "../internal/runtime-diagnostics.mjs"

export const name = "llm-grok"
export const inject = ["llm"]

export const Config = Schema.object({
  webSearch: Schema.boolean().default(false).description("Allow xAI Web Search for regular Grok requests"),
  xSearch: Schema.boolean().default(false).description("Allow xAI X Search for regular Grok requests"),
})

export function apply(ctx, config) {
  const platform = process.platform
  if (platform !== "darwin" && platform !== "win32") {
    throw new TypeError("dsh-grok-provider supports macOS and Windows")
  }

  const searchPolicy = Object.freeze({
    webSearch: config.webSearch,
    xSearch: config.xSearch,
  })

  const homeDir = os.homedir()
  let refreshOfficialCredential
  let inspectOfficialCli
  const officialSource = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: createOfficialCredentialLoader({
      authPath: path.join(homeDir, ".grok", "auth.json"),
      platform,
    }),
    now: () => new Date(),
    refresh: async () => {
      if (refreshOfficialCredential === undefined) throw new UnsupportedCredentialError()
      await refreshOfficialCredential()
    },
  })
  const runtime = installProviderRuntime({
    llm: ctx.llm,
    officialSource,
    createTransport: (credentialSource) => createGrokTransport({
      credentialSource,
      fetch: globalThis.fetch,
      attributionHeaders,
      clientIdentifier: "dsh-grok-provider",
      clientVersion: "1.0.5",
    }),
    createAdapter: ({ getGeneration }) => createGrokAdapter({
      getGeneration,
      getAttachmentStore: () => ctx.get("attachments"),
      mapError: mapLlmError,
      searchPolicy,
    }),
  })
  const authController = createAuthController({
    registry: runtime.auth,
    randomUUID,
  })
  const commandHandler = createGrokCommandHandler({ controller: authController })
  const dashboard = createAccountDashboard({
    listModels: () => runtime.adapter.listModels("grok"),
    getBilling: ({ signal } = {}) => runtime.auth.getGeneration().transport.getBilling({ signal }),
    now: () => new Date(),
  })
  const runtimeDiagnostics = createRuntimeDiagnostics({
    pluginVersion: packageJson.version,
    getCliInspector: () => inspectOfficialCli,
  })
  const authRpcHandler = createAuthRpcHandler({
    controller: authController,
    dashboard,
    diagnostics: runtimeDiagnostics.read,
  })

  ctx.inject(["subprocess"], (subprocessCtx) => {
    let removeDriver
    let refresh
    let inspectCli
    let isolated = false
    const isolate = () => {
      if (isolated) return
      isolated = true
      if (inspectOfficialCli === inspectCli) inspectOfficialCli = undefined
      if (refreshOfficialCredential === refresh) refreshOfficialCredential = undefined
      removeDriver?.()
    }
    const officialAuth = createOfficialCliAuth({
      subprocess: subprocessCtx.subprocess,
      platform,
      homeDir,
      verifyExecutable: verifyOfficialCliExecutable,
      onCleanupFailure: isolate,
    })
    inspectCli = ({ signal } = {}) => officialAuth.inspect({ signal })
    inspectOfficialCli = inspectCli
    removeDriver = authController.installDriver(createOfficialAuthDriver({
      officialAuth,
      credentialSource: officialSource,
    }))
    refresh = async () => {
      const outcome = await authController.refresh()
      if (outcome.kind !== "succeeded") throw new UnsupportedCredentialError()
    }
    refreshOfficialCredential = refresh
    return async () => {
      isolate()
      const results = await Promise.allSettled([
        runtimeDiagnostics.disposeInspector(inspectCli),
        authController.shutdown(),
      ])
      const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason)
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) throw new AggregateError(failures, "Failed to dispose Grok CLI capability")
    }
  })

  ctx.inject(["commands"], (commandsCtx) => commandsCtx.commands.register({
    name: "grok",
    description: "Manage Grok Build authentication",
    input: { hint: "status|login|cancel|logout" },
    recordInput: false,
    handler: commandHandler,
  }))
  ctx.inject(["connection"], (connectionCtx) => connectionCtx.connection.rpc.handle(
    "/grok-auth",
    authRpcHandler,
    { authority: "loopback" },
  ))

  ctx.effect(() => () => runtime.dispose(), "llm-grok runtime")
}

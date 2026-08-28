import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"

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

export const name = "llm-grok"
export const inject = ["llm"]

export const Config = Schema.object({})

export function apply(ctx) {
  const platform = process.platform
  if (platform !== "darwin" && platform !== "win32") {
    throw new TypeError("dsh-grok-provider supports macOS and Windows")
  }

  const homeDir = os.homedir()
  let refreshOfficialCredential
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
  const authRpcHandler = createAuthRpcHandler({ controller: authController, dashboard })

  ctx.inject(["subprocess"], (subprocessCtx) => {
    const officialAuth = createOfficialCliAuth({
      subprocess: subprocessCtx.subprocess,
      platform,
      homeDir,
      verifyExecutable: verifyOfficialCliExecutable,
    })
    const refresh = async () => {
      const outcome = await officialAuth.refresh()
      if (outcome.kind !== "succeeded") throw new UnsupportedCredentialError()
    }
    refreshOfficialCredential = refresh
    const removeDriver = authController.installDriver(createOfficialAuthDriver({
      officialAuth,
      credentialSource: officialSource,
    }))
    return async () => {
      await authController.shutdown()
      if (refreshOfficialCredential === refresh) refreshOfficialCredential = undefined
      removeDriver()
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

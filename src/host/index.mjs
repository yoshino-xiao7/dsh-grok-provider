import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { LlmError, attributionHeaders } from "@deepseek-ai/dsh-llm"
import Schema from "@deepseek-ai/schemastery"

import {
  CredentialFileTooLargeError,
  GROK_CLI_1_0_5_AUTH_CONTRACT,
  UnsupportedCredentialError,
  createCredentialSource,
} from "../internal/credential-source.mjs"
import { AuthModeUnavailableError } from "../internal/auth-registry.mjs"
import { createAuthController } from "../internal/auth-controller.mjs"
import { createAuthRpcHandler } from "../internal/auth-rpc.mjs"
import { createGrokAdapter } from "../internal/grok-adapter.mjs"
import { createGrokCommandHandler } from "../internal/grok-command-handler.mjs"
import { GrokTransportError, createGrokTransport } from "../internal/grok-transport.mjs"
import {
  OfficialCredentialFileError,
  createOfficialCredentialLoader,
} from "../internal/official-credential-loader.mjs"
import { createOfficialCliAuth } from "../internal/official-cli-auth.mjs"
import { createOfficialAuthDriver } from "../internal/official-auth-driver.mjs"
import { verifyOfficialCliExecutable } from "../internal/official-cli-verifier.mjs"
import { installManagedCapability } from "../internal/managed-capability.mjs"
import { installProviderRuntime } from "../internal/provider-runtime.mjs"
import { MANAGED_OAUTH_CONTRACT } from "./managed-oauth-contract.mjs"

export const name = "llm-grok"
export const inject = ["llm"]

export const Config = Schema.object({
  authMode: Schema.union(["official-cli", "managed-device"]).default("official-cli"),
})

export function apply(ctx, config = { authMode: "official-cli" }) {
  const platform = process.platform
  if (platform !== "darwin" && platform !== "win32") {
    throw new TypeError("dsh-grok-provider-yukiryou supports macOS and Windows in version 0.1.0")
  }

  const homeDir = os.homedir()
  const officialSource = createCredentialSource({
    contract: GROK_CLI_1_0_5_AUTH_CONTRACT,
    load: createOfficialCredentialLoader({
      authPath: path.join(homeDir, ".grok", "auth.json"),
      platform,
    }),
    now: () => new Date(),
  })
  const runtime = installProviderRuntime({
    llm: ctx.llm,
    initialMode: config.authMode,
    officialSource,
    createTransport: (credentialSource) => createGrokTransport({
      credentialSource,
      fetch: globalThis.fetch,
      attributionHeaders,
      clientIdentifier: "dsh-grok-provider-yukiryou",
      clientVersion: "1.0.5",
    }),
    createAdapter: ({ getGeneration }) => createGrokAdapter({
      getGeneration,
      mapError: mapLlmError,
    }),
  })
  const authController = createAuthController({
    registry: runtime.auth,
    randomUUID,
  })
  const commandHandler = createGrokCommandHandler({ controller: authController })
  const authRpcHandler = createAuthRpcHandler({ controller: authController })

  ctx.inject(["subprocess"], (subprocessCtx) => {
    const officialAuth = createOfficialCliAuth({
      subprocess: subprocessCtx.subprocess,
      platform,
      homeDir,
      verifyExecutable: verifyOfficialCliExecutable,
    })
    const removeDriver = authController.installDriver("official-cli", createOfficialAuthDriver({
      officialAuth,
      credentialSource: officialSource,
    }))
    return async () => {
      await authController.shutdown("official-cli")
      removeDriver()
    }
  })

  if (MANAGED_OAUTH_CONTRACT !== null) {
    ctx.inject(["credentials"], async (credentialsCtx) => {
      const { credentialKey } = await import("@deepseek-ai/dsh-credentials")
      return installManagedCapability({
        controller: authController,
        registry: runtime.auth,
        credentials: credentialsCtx.credentials,
        credentialKey: credentialKey("dsh-grok-provider-yukiryou", "grok-oauth"),
        contract: MANAGED_OAUTH_CONTRACT,
        now: () => new Date(),
        fetch: globalThis.fetch,
      })
    })
  }

  ctx.inject(["commands"], (commandsCtx) => commandsCtx.commands.register({
    name: "grok",
    description: "Manage Grok Build authentication",
    input: { hint: "status|use <mode>|login [mode]|cancel|logout <mode>" },
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

function mapLlmError(error) {
  if (error instanceof LlmError) return error
  if (error?.name === "AbortError") {
    return new LlmError("The Grok Build request was cancelled", "ABORTED", { cause: error })
  }
  if (
    error instanceof AuthModeUnavailableError ||
    error instanceof UnsupportedCredentialError ||
    error instanceof CredentialFileTooLargeError ||
    error instanceof OfficialCredentialFileError ||
    (error instanceof GrokTransportError && (error.status === 401 || error.status === 403))
  ) {
    return new LlmError("Grok authentication is required", "AUTH", {
      cause: error,
      ...(error.status === undefined ? {} : { status: error.status }),
    })
  }
  if (error instanceof GrokTransportError) {
    return new LlmError("The Grok Build request failed", error.status === 429 ? "RATE_LIMIT" : "PROVIDER_ERROR", {
      cause: error,
      ...(error.status === undefined ? {} : { status: error.status }),
    })
  }
  return new LlmError("The Grok provider rejected an invalid or unsupported response", "INVALID_RESPONSE", {
    cause: error,
  })
}

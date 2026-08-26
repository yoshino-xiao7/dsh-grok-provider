import os from "node:os"
import path from "node:path"

import { attributionHeaders } from "@deepseek-ai/dsh-llm"

import { createAccountDashboard } from "../src/internal/account-dashboard.mjs"
import { GROK_PRODUCTION_OIDC_AUTH_CONTRACT, createCredentialSource } from "../src/internal/credential-source.mjs"
import { createGrokAdapter } from "../src/internal/grok-adapter.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"

if (process.platform !== "darwin") throw new Error("This pre-release smoke is macOS-only")

const credentialSource = createCredentialSource({
  contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  load: createOfficialCredentialLoader({
    authPath: path.join(os.homedir(), ".grok", "auth.json"),
    platform: "darwin",
  }),
  now: () => new Date(),
})
const transport = createGrokTransport({
  credentialSource,
  fetch: globalThis.fetch,
  attributionHeaders,
  clientIdentifier: "dsh-grok-provider",
  clientVersion: "1.0.5",
})
const adapter = createGrokAdapter({ getGeneration: () => ({ transport }) })
const dashboard = createAccountDashboard({
  listModels: () => adapter.listModels("grok"),
  getBilling: ({ signal } = {}) => transport.getBilling({ signal }),
  now: () => new Date(),
})

const value = await dashboard()
process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)

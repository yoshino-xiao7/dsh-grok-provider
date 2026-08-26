import os from "node:os"
import path from "node:path"

import { attributionHeaders } from "@deepseek-ai/dsh-llm"
import { GROK_PRODUCTION_OIDC_AUTH_CONTRACT, createCredentialSource } from "../src/internal/credential-source.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"

const credentialSource = createCredentialSource({
  contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  load: createOfficialCredentialLoader({ authPath: path.join(os.homedir(), ".grok", "auth.json"), platform: "darwin" }),
  now: () => new Date(),
})
const transport = createGrokTransport({ credentialSource, fetch: globalThis.fetch, attributionHeaders, clientIdentifier: "dsh-grok-provider", clientVersion: "1.0.5" })
const value = JSON.parse(await transport.getBilling())
const config = value?.config
const safe = {
  configKeys: config && typeof config === "object" ? Object.keys(config).sort() : [],
  creditUsagePercent: config?.creditUsagePercent,
  credit_usage_percent: config?.credit_usage_percent,
  productUsage: Array.isArray(config?.productUsage) ? config.productUsage.map(({ product, usagePercent }) => ({ product, usagePercent })) : undefined,
  product_usage: Array.isArray(config?.product_usage) ? config.product_usage.map(({ product, usage_percent }) => ({ product, usage_percent })) : undefined,
}
process.stdout.write(`${JSON.stringify(safe, null, 2)}\n`)

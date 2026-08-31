import os from "node:os"
import path from "node:path"

import { attributionHeaders } from "@deepseek-ai/dsh-llm"

import {
  GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  createCredentialSource,
} from "../src/internal/credential-source.mjs"
import { createGrokAdapter } from "../src/internal/grok-adapter.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"

if (process.platform !== "darwin") throw new Error("This live smoke is macOS-only")

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
const adapter = createGrokAdapter({ getGeneration: () => ({ id: 1, transport }) })
const counts = Object.create(null)

for await (const chunk of adapter.stream({
  provider: "grok",
  model: "grok-4.6",
  reasoningEffort: "low",
  messages: [{
    id: "v103-live-smoke",
    role: "user",
    source: { kind: "user" },
    content: [{ type: "text", text: "Reply with only the word OK." }],
  }],
})) counts[chunk.type] = (counts[chunk.type] ?? 0) + 1

if (counts.finish !== 1 || (counts["text-delta"] ?? 0) < 1) {
  throw new Error("The redacted live smoke did not complete")
}
process.stdout.write(`${JSON.stringify({ model: "grok-4.6", completed: true, counts })}\n`)

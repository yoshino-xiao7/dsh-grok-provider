import os from "node:os"
import path from "node:path"

import { GROK_CLI_1_0_5_AUTH_CONTRACT, createCredentialSource } from "../src/internal/credential-source.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { parseModelCatalogResponse } from "../src/internal/model-catalog.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"
import { parseResponsesSse } from "../src/internal/responses-sse.mjs"

if (process.platform !== "darwin") throw new Error("This probe is macOS-only")

const credentialSource = createCredentialSource({
  contract: GROK_CLI_1_0_5_AUTH_CONTRACT,
  load: createOfficialCredentialLoader({
    authPath: path.join(os.homedir(), ".grok", "auth.json"),
    platform: "darwin",
  }),
  now: () => new Date(),
})
const transport = createGrokTransport({
  credentialSource,
  fetch: globalThis.fetch,
  attributionHeaders: () => ({ "user-agent": "deepseek-harness/0.1.1-rc.2" }),
  clientIdentifier: "dsh-grok-provider",
  clientVersion: "1.0.5",
})

const models = parseModelCatalogResponse(await transport.listModels(), { provider: "grok" })
for (const model of models) {
  const observations = []
  const request = {
    model: model.resolvedModelInfo.id,
    input: [{ role: "user", content: "Reply with only OK." }],
    include: ["reasoning.encrypted_content"],
    stream: true,
    store: false,
  }
  for await (const event of parseResponsesSse(transport.streamResponses(request))) {
    if (event.type === "response.output_item.done" && event.item?.type === "reasoning") {
      observations.push({
        event: event.type,
        itemKeys: Object.keys(event.item).sort(),
        encryptedType: typeof event.item.encrypted_content,
        encryptedLength: typeof event.item.encrypted_content === "string"
          ? event.item.encrypted_content.length
          : null,
        summaryType: Array.isArray(event.item.summary) ? "array" : typeof event.item.summary,
      })
    }
    if (event.type === "response.completed") {
      observations.push({
        event: event.type,
        responseKeys: Object.keys(event.response ?? {}).sort(),
        outputType: Array.isArray(event.response?.output) ? "array" : typeof event.response?.output,
      })
    }
  }
  console.log(JSON.stringify({ model: model.resolvedModelInfo.id, observations }))
}

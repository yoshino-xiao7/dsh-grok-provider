import os from "node:os"
import path from "node:path"

import { GROK_PRODUCTION_OIDC_AUTH_CONTRACT, createCredentialSource } from "../src/internal/credential-source.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"
import { parseResponsesSse } from "../src/internal/responses-sse.mjs"
import { createResponsesEventDecoder } from "../src/internal/responses-codec.mjs"

const source = createCredentialSource({
  contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  load: createOfficialCredentialLoader({
    authPath: path.join(os.homedir(), ".grok", "auth.json"),
    platform: "darwin",
  }),
  now: () => new Date(),
})
const transport = createGrokTransport({
  credentialSource: source,
  fetch: globalThis.fetch,
  attributionHeaders: () => ({ "user-agent": "deepseek-harness/0.1.1-rc.2" }),
  clientIdentifier: "dsh-grok-provider",
  clientVersion: "1.0.5",
})
const request = {
  model: "grok-4.6",
  input: [{ role: "user", content: "Write a detailed explanation of binary search." }],
  reasoning: { effort: "low" },
  max_output_tokens: 16,
  stream: true,
  store: false,
}

const decoder = createResponsesEventDecoder()
let finishKind
for await (const event of parseResponsesSse(transport.streamResponses(request))) {
  console.log(JSON.stringify({
    type: event.type,
    responseStatus: event.response?.status,
    incompleteReason: event.response?.incomplete_details?.reason,
    itemType: event.item?.type,
    itemStatus: event.item?.status,
  }))
  for (const chunk of decoder.push(event)) {
    if (chunk.type === "finish") finishKind = chunk.reason.kind
  }
}
decoder.finish()
console.log(JSON.stringify({ kind: "decoded-terminal", finishKind }))

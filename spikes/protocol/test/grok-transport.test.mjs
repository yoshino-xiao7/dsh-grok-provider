import assert from "node:assert/strict"
import test from "node:test"

import { createGrokTransport } from "../../../src/internal/grok-transport.mjs"

test("model discovery uses the pinned Grok Build endpoint and honest client attribution", async () => {
  const requests = []
  const transport = createGrokTransport({
    credentialSource: {
      async withAccessToken(operation) {
        return operation("fixture-access-token")
      },
    },
    fetch: async (url, init) => {
      requests.push({ url, init })
      return {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => '{"object":"list","data":[]}',
      }
    },
    attributionHeaders: () => ({
      "User-Agent": "deepseek-harness/0.1.1-rc.2",
      "X-Title": "DeepSeek Harness",
    }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })

  const body = await transport.listModels()

  assert.equal(body, '{"object":"list","data":[]}')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "https://cli-chat-proxy.grok.com/v1/models")
  assert.equal(requests[0].init.method, "GET")
  assert.equal(requests[0].init.redirect, "error")
  assert.deepEqual(Object.fromEntries(requests[0].init.headers.entries()), {
    accept: "application/json",
    authorization: "Bearer fixture-access-token",
    "user-agent": "deepseek-harness/0.1.1-rc.2",
    "x-grok-client-identifier": "dsh-grok-provider",
    "x-grok-client-version": "1.0.5",
    "x-title": "DeepSeek Harness",
    "x-xai-token-auth": "xai-grok-cli",
  })
  assert.equal(requests[0].init.signal instanceof AbortSignal, true)
})

test("Responses streaming posts only to the pinned endpoint and yields response bytes", async () => {
  const requests = []
  const encoder = new TextEncoder()
  const transport = createGrokTransport({
    credentialSource: {
      async withAccessToken(operation) {
        return operation("fixture-access-token")
      },
    },
    fetch: async (url, init) => {
      requests.push({ url, init })
      return {
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream; charset=utf-8" }),
        body: (async function* () {
          yield encoder.encode("data: fixture\n\n")
        })(),
      }
    },
    attributionHeaders: () => ({ "User-Agent": "deepseek-harness/0.1.1-rc.2" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })
  const request = { model: "grok-4.6", input: "OK", stream: true, store: false }

  const chunks = []
  for await (const chunk of transport.streamResponses(request)) chunks.push(chunk)

  assert.equal(new TextDecoder().decode(chunks[0]), "data: fixture\n\n")
  assert.equal(requests[0].url, "https://cli-chat-proxy.grok.com/v1/responses")
  assert.equal(requests[0].init.method, "POST")
  assert.equal(requests[0].init.redirect, "error")
  assert.equal(requests[0].init.body, JSON.stringify(request))
  assert.equal(requests[0].init.headers.get("content-type"), "application/json")
  assert.equal(requests[0].init.headers.get("authorization"), "Bearer fixture-access-token")
})

test("billing uses the pinned credits endpoint and keeps credential metadata in Host headers", async () => {
  const requests = []
  const transport = createGrokTransport({
    credentialSource: {
      async withAccessToken(operation) {
        return operation("fixture-access-token", { userId: "fixture-user-id" })
      },
    },
    fetch: async (url, init) => {
      requests.push({ url, init })
      return {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => '{"config":{"creditUsagePercent":25}}',
      }
    },
    attributionHeaders: () => ({ "User-Agent": "deepseek-harness/0.1.1-rc.2" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })

  assert.equal(await transport.getBilling(), '{"config":{"creditUsagePercent":25}}')
  assert.equal(requests[0].url, "https://cli-chat-proxy.grok.com/v1/billing?format=credits")
  assert.equal(requests[0].init.method, "GET")
  assert.equal(requests[0].init.redirect, "error")
  assert.equal(requests[0].init.headers.get("x-userid"), "fixture-user-id")
})

test("billing fails closed before fetch when the official credential has no safe user id", async () => {
  let fetchCalled = false
  const transport = createGrokTransport({
    credentialSource: { async withAccessToken(operation) { return operation("fixture-access-token", {}) } },
    fetch: async () => { fetchCalled = true },
    attributionHeaders: () => ({ "User-Agent": "deepseek-harness/0.1.1-rc.2" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })
  await assert.rejects(transport.getBilling(), { name: "GrokTransportError" })
  assert.equal(fetchCalled, false)
})

test("model discovery owns a deadline and classifies an internal timeout as transport failure", async () => {
  const transport = createGrokTransport({
    credentialSource: { async withAccessToken(operation) { return operation("fixture-access-token") } },
    fetch: async (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => {
      reject(new DOMException("Timed out", "AbortError"))
    }, { once: true })),
    attributionHeaders: () => ({ "user-agent": "fixture-harness" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
    modelTimeoutMs: 5,
  })

  await assert.rejects(Promise.race([
    transport.listModels(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("deadline missing")), 50)),
  ]), { name: "GrokTransportError" })
})

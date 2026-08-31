import assert from "node:assert/strict"
import test from "node:test"

import {
  GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  createCredentialSource,
} from "../../../src/internal/credential-source.mjs"
import { createGrokTransport } from "../../../src/internal/grok-transport.mjs"

const OIDC_SCOPE = "https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828"

function createOidcFixture(accessToken) {
  return JSON.stringify({
    [OIDC_SCOPE]: {
      key: accessToken,
      auth_mode: "oidc",
      expires_at: "2030-01-01T01:00:00.000Z",
      oidc_issuer: "https://auth.x.ai",
      oidc_client_id: "b1a00492-073a-47ea-816f-4c329264a828",
    },
  })
}

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

test("Responses streaming aborts a source that stops producing bytes", async () => {
  const encoder = new TextEncoder()
  const transport = createGrokTransport({
    credentialSource: {
      async withAccessToken(operation) {
        return operation("fixture-access-token")
      },
    },
    fetch: async (_url, init) => ({
      status: 200,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: (async function* () {
        yield encoder.encode("data: first\n\n")
        await new Promise((_, reject) => init.signal.addEventListener("abort", () => {
          reject(new DOMException("Timed out", "AbortError"))
        }, { once: true }))
      })(),
    }),
    attributionHeaders: () => ({ "user-agent": "fixture-harness" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
    responseTimeoutMs: 5,
  })

  const chunks = []
  await assert.rejects(async () => {
    for await (const chunk of transport.streamResponses({
      model: "grok-4.6",
      input: "OK",
      stream: true,
      store: false,
    })) chunks.push(chunk)
  }, { name: "GrokTransportError" })
  assert.equal(new TextDecoder().decode(chunks[0]), "data: first\n\n")
})

test("Responses streaming refreshes one rejected official session before any bytes are emitted", async () => {
  let accessToken = "rejected-access-token"
  let refreshCalls = 0
  const requests = []
  const encoder = new TextEncoder()
  const credentialSource = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => createOidcFixture(accessToken),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => {
      refreshCalls += 1
      accessToken = "recovered-access-token"
    },
  })
  const transport = createGrokTransport({
    credentialSource,
    fetch: async (_url, init) => {
      requests.push(init.headers.get("authorization"))
      if (requests.length === 1) {
        return {
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          body: new ReadableStream({ start(controller) { controller.close() } }),
        }
      }
      return {
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: (async function* () { yield encoder.encode("data: recovered\n\n") })(),
      }
    },
    attributionHeaders: () => ({ "user-agent": "fixture-harness" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })

  const chunks = []
  for await (const chunk of transport.streamResponses({
    model: "grok-4.6",
    input: "OK",
    stream: true,
    store: false,
  })) chunks.push(chunk)

  assert.equal(refreshCalls, 1)
  assert.deepEqual(requests, [
    "Bearer rejected-access-token",
    "Bearer recovered-access-token",
  ])
  assert.equal(new TextDecoder().decode(chunks[0]), "data: recovered\n\n")
})

test("Responses streaming reports a persistent auth rejection after one recovery attempt", async () => {
  let accessToken = "rejected-access-token"
  let refreshCalls = 0
  let requestCalls = 0
  const credentialSource = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => createOidcFixture(accessToken),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => {
      refreshCalls += 1
      accessToken = "still-rejected-access-token"
    },
  })
  const transport = createGrokTransport({
    credentialSource,
    fetch: async () => {
      requestCalls += 1
      return {
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        body: new ReadableStream({ start(controller) { controller.close() } }),
      }
    },
    attributionHeaders: () => ({ "user-agent": "fixture-harness" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })

  await assert.rejects(async () => {
    for await (const _chunk of transport.streamResponses({
      model: "grok-4.6",
      input: "OK",
      stream: true,
      store: false,
    })) {}
  }, (error) => error?.name === "GrokTransportError" && error.status === 401)
  assert.equal(refreshCalls, 1)
  assert.equal(requestCalls, 2)
})

test("Responses streaming never retries after the response stream starts", async () => {
  let refreshCalls = 0
  let requestCalls = 0
  const encoder = new TextEncoder()
  const credentialSource = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => createOidcFixture("fixture-access-token"),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => { refreshCalls += 1 },
  })
  const transport = createGrokTransport({
    credentialSource,
    fetch: async () => {
      requestCalls += 1
      return {
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: (async function* () {
          yield encoder.encode("data: started\n\n")
          throw new Error("fixture stream failure")
        })(),
      }
    },
    attributionHeaders: () => ({ "user-agent": "fixture-harness" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })
  const chunks = []

  await assert.rejects(async () => {
    for await (const chunk of transport.streamResponses({
      model: "grok-4.6",
      input: "OK",
      stream: true,
      store: false,
    })) chunks.push(chunk)
  }, { name: "GrokTransportError" })
  assert.equal(new TextDecoder().decode(chunks[0]), "data: started\n\n")
  assert.equal(refreshCalls, 0)
  assert.equal(requestCalls, 1)
})

test("concurrent pre-stream auth rejections share one official refresh", async () => {
  let accessToken = "rejected-access-token"
  let refreshCalls = 0
  let releaseRefresh
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve })
  const requests = []
  const encoder = new TextEncoder()
  const credentialSource = createCredentialSource({
    contract: GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
    load: async () => createOidcFixture(accessToken),
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    refresh: async () => {
      refreshCalls += 1
      await refreshGate
      accessToken = "recovered-access-token"
    },
  })
  const transport = createGrokTransport({
    credentialSource,
    fetch: async (_url, init) => {
      const authorization = init.headers.get("authorization")
      requests.push(authorization)
      if (authorization === "Bearer rejected-access-token") {
        return {
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          body: new ReadableStream({ start(controller) { controller.close() } }),
        }
      }
      return {
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: (async function* () { yield encoder.encode("data: recovered\n\n") })(),
      }
    },
    attributionHeaders: () => ({ "user-agent": "fixture-harness" }),
    clientIdentifier: "dsh-grok-provider",
    clientVersion: "1.0.5",
  })
  const request = { model: "grok-4.6", input: "OK", stream: true, store: false }
  const collect = async () => {
    const chunks = []
    for await (const chunk of transport.streamResponses(request)) chunks.push(chunk)
    return new TextDecoder().decode(chunks[0])
  }

  const first = collect()
  const second = collect()
  while (requests.length < 2 || refreshCalls < 1) await new Promise((resolve) => setImmediate(resolve))
  releaseRefresh()

  assert.deepEqual(await Promise.all([first, second]), ["data: recovered\n\n", "data: recovered\n\n"])
  assert.equal(refreshCalls, 1)
  assert.equal(requests.filter((value) => value === "Bearer rejected-access-token").length, 2)
  assert.equal(requests.filter((value) => value === "Bearer recovered-access-token").length, 2)
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

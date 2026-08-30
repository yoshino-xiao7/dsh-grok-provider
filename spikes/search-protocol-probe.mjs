import os from "node:os"
import path from "node:path"

import { attributionHeaders } from "@deepseek-ai/dsh-llm"

import {
  GROK_PRODUCTION_OIDC_AUTH_CONTRACT,
  createCredentialSource,
} from "../src/internal/credential-source.mjs"
import { createGrokTransport } from "../src/internal/grok-transport.mjs"
import { parseModelCatalogResponse } from "../src/internal/model-catalog.mjs"
import { createOfficialCredentialLoader } from "../src/internal/official-credential-loader.mjs"
import { parseResponsesSse } from "../src/internal/responses-sse.mjs"

const CONFIRMATION_ENV = "DSH_GROK_CONFIRM_REAL_SEARCH_PROBE"
const CONFIRMATION_VERSION = "v1"
const CASE_ENV = "DSH_GROK_SEARCH_PROBE_CASE"
const MODEL_ENV = "DSH_GROK_SEARCH_PROBE_MODEL"
const PROXY_ORIGIN = "https://cli-chat-proxy.grok.com"
const CLIENT_IDENTIFIER = "dsh-grok-provider"
const CLIENT_VERSION = "1.0.5"
const MAX_TRANSITIONS = 4_096
const MAX_UNIQUE_TYPES = 128
const MAX_SHAPES_PER_LOCATION = 16
const MAX_OBJECT_KEYS = 64
const MAX_NESTED_ITEMS = 1_024
const MAX_OUTPUT_BYTES = 128 * 1024
const ALLOWED_MODELS = new Set(["grok-4.6", "grok-4.5"])
const X_SEARCH_FUNCTION_NAMES = new Set([
  "x_user_search",
  "x_keyword_search",
  "x_semantic_search",
  "x_thread_fetch",
])

const SAFE_EVENT_TYPES = new Set([
  "error",
  "response.completed",
  "response.content_part.added",
  "response.content_part.done",
  "response.created",
  "response.custom_tool_call_input.delta",
  "response.custom_tool_call_input.done",
  "response.failed",
  "response.function_call_arguments.delta",
  "response.function_call_arguments.done",
  "response.in_progress",
  "response.incomplete",
  "response.output_item.added",
  "response.output_item.done",
  "response.output_text.annotation.added",
  "response.output_text.delta",
  "response.output_text.done",
  "response.reasoning_summary_part.added",
  "response.reasoning_summary_part.done",
  "response.reasoning_summary_text.delta",
  "response.reasoning_summary_text.done",
  "response.reasoning_text.delta",
  "response.reasoning_text.done",
  "response.web_search_call.completed",
  "response.web_search_call.in_progress",
  "response.web_search_call.searching",
  "response.x_search_call.completed",
  "response.x_search_call.in_progress",
  "response.x_search_call.searching",
])

const SAFE_FIELD_NAMES = new Set([
  "SERVER_SIDE_TOOL_WEB_SEARCH",
  "SERVER_SIDE_TOOL_X_SEARCH",
  "action",
  "annotation",
  "annotation_index",
  "annotations",
  "arguments",
  "background",
  "billing",
  "cached_tokens",
  "call_id",
  "citations",
  "code",
  "completed_at",
  "content",
  "content_index",
  "conversation",
  "cost_in_usd_ticks",
  "created_at",
  "delta",
  "encrypted_content",
  "end_index",
  "error",
  "frequency_penalty",
  "id",
  "image_url",
  "incomplete_details",
  "input",
  "input_tokens",
  "input_tokens_details",
  "instructions",
  "item",
  "item_id",
  "logprobs",
  "max_output_tokens",
  "max_tool_calls",
  "message",
  "metadata",
  "model",
  "name",
  "num_sources_used",
  "num_server_side_tools_used",
  "object",
  "output",
  "output_index",
  "output_tokens",
  "output_tokens_details",
  "parallel_tool_calls",
  "param",
  "part",
  "previous_response_id",
  "presence_penalty",
  "prompt_cache_key",
  "queries",
  "query",
  "reasoning",
  "reasoning_tokens",
  "response",
  "role",
  "safety_identifier",
  "sequence_number",
  "server_side_tool_usage",
  "service_tier",
  "start_index",
  "status",
  "store",
  "sources",
  "summary",
  "summary_index",
  "temperature",
  "text",
  "title",
  "tool_choice",
  "tools",
  "top_logprobs",
  "top_p",
  "total_tokens",
  "truncation",
  "type",
  "usage",
  "user",
  "url",
  "web_search_requests",
  "x_search_requests",
])

const SAFE_ENUM_VALUES = new Set([
  "assistant",
  "completed",
  "custom_tool_call",
  "failed",
  "file_citation",
  "function_call",
  "in_progress",
  "incomplete",
  "message",
  "output_text",
  "queued",
  "reasoning",
  "response",
  "search",
  "searching",
  "summary_text",
  "system",
  "url_citation",
  "user",
  "web_search_call",
  "x_search_call",
])

const CASES = Object.freeze({
  web: probeCase({
    prompt: "Use Web Search exactly once to inspect the public xAI Web Search documentation at docs.x.ai. Then reply with exactly WEB_SEARCH_PROBE.",
    requiredKinds: ["web_search"],
    tools: [{ type: "web_search" }],
  }),
  x: probeCase({
    prompt: "You must use X Search exactly once to inspect the most recent public post from @xai; do not answer from memory. Then reply with exactly X_SEARCH_PROBE.",
    requiredKinds: ["x_search"],
    tools: [{ type: "x_search" }],
    toolChoice: "required",
  }),
  both: probeCase({
    prompt: "Use Web Search exactly once and X Search exactly once to inspect public xAI sources. Then reply with exactly BOTH_SEARCH_PROBE.",
    requiredKinds: ["web_search", "x_search"],
    tools: [{ type: "web_search" }, { type: "x_search" }],
  }),
  mixed: probeCase({
    prompt: "Use Web Search exactly once to inspect the public xAI Web Search documentation. Then call record_search_probe exactly once with status set to observed.",
    requiredKinds: ["web_search", "function_call"],
    tools: [
      {
        type: "function",
        name: "record_search_probe",
        description: "Record that the fixed public Search protocol probe was observed.",
        parameters: {
          type: "object",
          properties: { status: { type: "string", enum: ["observed"] } },
          required: ["status"],
          additionalProperties: false,
        },
      },
      { type: "web_search" },
    ],
  }),
})

const MISSING_KIND_CODES = Object.freeze({
  web_search: "missing-web-search",
  x_search: "missing-x-search",
  function_call: "missing-function-call",
})

const PUBLIC_FAILURE_CODES = new Set([
  "automated-environment",
  "confirmation-required",
  "event-after-terminal",
  "fixture-function-mismatch",
  "unexpected-x-search-tool",
  "invalid-annotation",
  "invalid-annotations",
  "invalid-case",
  "invalid-citations",
  "invalid-completed",
  "invalid-content-array",
  "invalid-content-part",
  "invalid-event",
  "invalid-fixture-arguments",
  "invalid-model",
  "invalid-model-request",
  "invalid-nested-object",
  "invalid-numeric-tree",
  "invalid-numeric-value",
  "invalid-observed-name",
  "invalid-observed-string",
  "invalid-response-object",
  "invalid-response-output",
  "invalid-response-request",
  "invalid-sequence",
  "missing-completed",
  "missing-function-call",
  "missing-web-search",
  "missing-x-search",
  "model-request-limit",
  "model-route-unavailable",
  "non-completed-terminal",
  "request-count-mismatch",
  "response-request-limit",
  "summary-too-large",
  "too-many-enum-values",
  "too-many-event-types",
  "too-many-identifier-aliases",
  "too-many-object-keys",
  "too-many-shape-locations",
  "too-many-shapes",
  "too-many-transitions",
  "unexpected-function-name",
  "unexpected-network-target",
  "unsafe-debug-environment",
  "unsafe-summary-key",
  "unsupported-platform",
])

class SearchProtocolProbeError extends Error {
  constructor(code, status) {
    super("The Search protocol probe failed")
    this.name = "SearchProtocolProbeError"
    this.code = code
    if (status !== undefined) this.status = status
  }
}

let lastObservation

async function main() {
  if (process.platform !== "darwin") fail("unsupported-platform")
  requireSafeDebugEnvironment()
  if (typeof process.env.CI === "string" && process.env.CI.length > 0) {
    fail("automated-environment")
  }
  const caseName = process.env[CASE_ENV]
  const model = process.env[MODEL_ENV]
  const definition = CASES[caseName]
  if (definition === undefined) fail("invalid-case")
  if (!ALLOWED_MODELS.has(model)) fail("invalid-model")
  requireBoundConfirmation({ caseName, model })
  delete process.env[CONFIRMATION_ENV]

  const requestState = {
    expectedPostBody: undefined,
    modelGets: 0,
    responsePosts: 0,
    guardErrorCode: undefined,
  }
  const signal = AbortSignal.timeout(180_000)
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
    fetch: createGuardedFetch(globalThis.fetch, requestState),
    attributionHeaders,
    clientIdentifier: CLIENT_IDENTIFIER,
    clientVersion: CLIENT_VERSION,
  })

  const catalog = parseModelCatalogResponse(await transport.listModels({ signal }), {
    provider: "grok",
  })
  const route = catalog.find((entry) => entry.resolvedModelInfo.id === model)
  if (route === undefined || route.backend !== "responses") fail("model-route-unavailable")

  const request = createRequest({ definition, model, resolvedModel: route.resolvedModelInfo })
  const serialized = JSON.stringify(request)
  const requestBytes = Buffer.byteLength(serialized, "utf8")
  requestState.expectedPostBody = serialized
  const observation = createObservation(definition.requiredKinds)
  lastObservation = observation

  for await (const event of parseResponsesSse(
    transport.streamResponses(request, { signal }),
  )) {
    observeEvent(observation, event)
  }

  const summary = finishObservation(observation)
  if (
    requestState.expectedPostBody !== undefined ||
    requestState.modelGets !== 1 ||
    requestState.responsePosts !== 1
  ) fail("request-count-mismatch")

  writeRecord({
    kind: "search-protocol-probe",
    status: "observed",
    contractStatus: "unfrozen",
    case: caseName,
    model,
    clientIdentifier: CLIENT_IDENTIFIER,
    clientVersion: CLIENT_VERSION,
    method: "POST",
    path: "/v1/responses",
    requestBytes,
    modelGets: requestState.modelGets,
    responsePosts: requestState.responsePosts,
    ...summary,
  })
}

function probeCase({ prompt, requiredKinds, tools, toolChoice }) {
  return Object.freeze({
    prompt,
    requiredKinds: Object.freeze([...requiredKinds]),
    tools: freezeTree(tools),
    ...(toolChoice === undefined ? {} : { toolChoice }),
  })
}

function createRequest({ definition, model, resolvedModel }) {
  const efforts = resolvedModel.reasoning?.efforts
  const low = Array.isArray(efforts) ? efforts.find((effort) => effort.id === "low") : undefined
  return freezeTree({
    model,
    input: [{ role: "user", content: definition.prompt }],
    tools: definition.tools,
    ...(definition.toolChoice === undefined ? {} : { tool_choice: definition.toolChoice }),
    ...(low === undefined ? {} : { reasoning: { effort: "low" } }),
    max_output_tokens: 512,
    stream: true,
    store: false,
  })
}

function createGuardedFetch(networkFetch, state) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url)
    const method = String(init.method ?? (typeof input === "object" ? input.method : "GET") ?? "GET").toUpperCase()
    if (
      url.origin !== PROXY_ORIGIN ||
      !["/v1/models", "/v1/responses"].includes(url.pathname) ||
      url.search !== "" ||
      init.redirect !== "error"
    ) guardFail(state, "unexpected-network-target")

    if (url.pathname === "/v1/models") {
      if (method !== "GET" || init.body !== undefined) guardFail(state, "invalid-model-request")
      state.modelGets += 1
      if (state.modelGets > 1) guardFail(state, "model-request-limit")
      return networkFetch(input, init)
    }

    if (
      method !== "POST" ||
      state.expectedPostBody === undefined ||
      init.body !== state.expectedPostBody
    ) guardFail(state, "invalid-response-request")
    state.expectedPostBody = undefined
    state.responsePosts += 1
    if (state.responsePosts > 1) guardFail(state, "response-request-limit")
    return networkFetch(input, init)
  }
}

function createObservation(requiredKinds) {
  return {
    requiredKinds,
    candidateKindHints: new Set(),
    eventCounts: new Map(),
    shapes: new Map(),
    enums: new Map(),
    sequence: [],
    lastSequence: -1,
    eventCount: 0,
    terminalCount: 0,
    textBytes: 0,
    argumentsBytes: 0,
    citationCount: 0,
    usage: new Map(),
    serverToolUsage: new Map(),
    aliases: {
      event: new Map(),
      field: new Map(),
      enum: new Map(),
    },
    fixtureFunctionNameMatch: false,
    fixtureFunctionArgumentsMatch: false,
  }
}

function observeEvent(observation, event) {
  if (!isPlainObject(event)) fail("invalid-event")
  if (observation.terminalCount !== 0) fail("event-after-terminal")
  const rawEventType = requireBoundedObservedString(event.type, 256)
  const eventType = summarizeIdentifier(observation, "event", rawEventType)
  if (
    !Number.isSafeInteger(event.sequence_number) ||
    event.sequence_number <= observation.lastSequence
  ) fail("invalid-sequence")
  observation.lastSequence = event.sequence_number
  observation.eventCount += 1
  increment(observation.eventCounts, eventType)
  markCandidateKind(observation, rawEventType)
  recordShape(observation, eventType, "event", event)
  recordTransition(observation, eventType)

  observeNode(observation, rawEventType, eventType, "item", event.item)
  observeNode(observation, rawEventType, eventType, "part", event.part)
  observeNode(observation, rawEventType, eventType, "action", event.action)
  observeNode(observation, rawEventType, eventType, "annotation", event.annotation)
  observeStringBytes(observation, rawEventType, "delta", event.delta)
  observeStringBytes(observation, rawEventType, "text", event.text)
  observeStringBytes(observation, rawEventType, "arguments", event.arguments)
  observeStringBytes(observation, rawEventType, "input", event.input)

  if (rawEventType === "response.completed") {
    if (event.response?.status !== "completed") fail("invalid-completed")
    observation.terminalCount += 1
  } else if (rawEventType === "response.incomplete" || rawEventType === "response.failed") {
    fail("non-completed-terminal")
  }

  observeResponse(observation, rawEventType, eventType, event.response)
}

function observeNode(observation, rawEventType, eventType, location, value) {
  if (value === undefined) return
  if (!isPlainObject(value)) fail("invalid-nested-object")
  recordShape(observation, eventType, location, value)
  const nodeType = observeEnumField(observation, eventType, location, value, "type")
  observeEnumField(observation, eventType, location, value, "status")
  observeStringBytes(observation, rawEventType, `${location}.text`, value.text)
  observeStringBytes(observation, rawEventType, `${location}.arguments`, value.arguments)
  if (nodeType === "function_call") observeFixtureFunction(observation, value)
  if (nodeType === "custom_tool_call") observeXSearchCustomTool(observation, value)
  if (value.action !== undefined) {
    observeNode(observation, rawEventType, eventType, `${location}.action`, value.action)
  }
  if (value.content !== undefined) {
    observeContentArray(
      observation,
      rawEventType,
      eventType,
      `${location}.content`,
      value.content,
    )
  }
  if (value.annotations !== undefined) {
    observeAnnotations(observation, eventType, `${location}.annotations`, value.annotations)
  }
}

function observeXSearchCustomTool(observation, value) {
  const name = requireBoundedObservedString(value.name, 128)
  if (!X_SEARCH_FUNCTION_NAMES.has(name)) fail("unexpected-x-search-tool")
  observation.candidateKindHints.add("x_search")
  if (value.input !== undefined) {
    observeStringBytes(observation, "custom_tool_call", "input", value.input)
  }
}

function observeResponse(observation, rawEventType, eventType, response) {
  if (response === undefined) return
  if (!isPlainObject(response)) fail("invalid-response-object")
  recordShape(observation, eventType, "response", response)
  observeEnumField(observation, eventType, "response", response, "status")
  if (response.output !== undefined) {
    if (!Array.isArray(response.output) || response.output.length > MAX_NESTED_ITEMS) {
      fail("invalid-response-output")
    }
    for (const item of response.output) {
      observeNode(
        observation,
        rawEventType,
        eventType,
        "response.output[]",
        item,
      )
    }
  }
  if (response.usage !== undefined) {
    observeNumericTree(observation, observation.usage, response.usage, "usage", 0)
  }
  if (response.server_side_tool_usage !== undefined) {
    observeNumericTree(
      observation,
      observation.serverToolUsage,
      response.server_side_tool_usage,
      "server",
      0,
    )
  }
  if (response.citations !== undefined) {
    if (!Array.isArray(response.citations) || response.citations.length > MAX_NESTED_ITEMS) {
      fail("invalid-citations")
    }
    observation.citationCount += response.citations.length
  }
}

function observeContentArray(observation, rawEventType, eventType, location, content) {
  if (!Array.isArray(content) || content.length > MAX_NESTED_ITEMS) fail("invalid-content-array")
  for (const part of content) {
    if (!isPlainObject(part)) fail("invalid-content-part")
    recordShape(observation, eventType, `${location}[]`, part)
    observeEnumField(observation, eventType, `${location}[]`, part, "type")
    observeStringBytes(observation, rawEventType, `${location}[].text`, part.text)
    if (part.annotations !== undefined) {
      observeAnnotations(observation, eventType, `${location}[].annotations`, part.annotations)
    }
  }
}

function observeAnnotations(observation, eventType, location, annotations) {
  if (!Array.isArray(annotations) || annotations.length > MAX_NESTED_ITEMS) fail("invalid-annotations")
  observation.citationCount += annotations.length
  for (const annotation of annotations) {
    if (!isPlainObject(annotation)) fail("invalid-annotation")
    recordShape(observation, eventType, `${location}[]`, annotation)
    observeEnumField(observation, eventType, `${location}[]`, annotation, "type")
  }
}

function observeEnumField(observation, eventType, location, value, field) {
  if (value[field] === undefined) return undefined
  const raw = requireBoundedObservedString(value[field], 256)
  markCandidateKind(observation, raw)
  const summary = summarizeIdentifier(observation, "enum", raw)
  const enumLocation = `${eventType}:${location}.${field}`
  let values = observation.enums.get(enumLocation)
  if (values === undefined) {
    values = new Set()
    observation.enums.set(enumLocation, values)
  }
  values.add(summary)
  if (values.size > MAX_UNIQUE_TYPES) fail("too-many-enum-values")
  return raw
}

function observeStringBytes(observation, eventType, field, value) {
  if (value === undefined) return
  if (typeof value !== "string") {
    if (isPlainObject(value)) return
    fail("invalid-observed-string")
  }
  const bytes = Buffer.byteLength(value, "utf8")
  if (field.includes("arguments") || eventType.includes("function_call_arguments")) {
    observation.argumentsBytes += bytes
  } else {
    observation.textBytes += bytes
  }
}

function observeNumericTree(observation, target, value, prefix, depth) {
  if (value === null) return
  if (!isPlainObject(value) || depth > 2) fail("invalid-numeric-tree")
  const keys = summarizedKeys(observation, value)
  for (const { raw, summary } of keys) {
    const nested = value[raw]
    const pathName = `${prefix}.${summary}`
    if (Number.isSafeInteger(nested) && nested >= 0) {
      target.set(pathName, (target.get(pathName) ?? 0) + nested)
    } else if (isPlainObject(nested)) {
      observeNumericTree(observation, target, nested, pathName, depth + 1)
    } else if (nested !== null && nested !== undefined) {
      fail("invalid-numeric-value")
    }
  }
}

function recordShape(observation, eventType, location, value) {
  const key = `${eventType}:${location}`
  let shapes = observation.shapes.get(key)
  if (shapes === undefined) {
    if (observation.shapes.size >= MAX_UNIQUE_TYPES * 8) fail("too-many-shape-locations")
    shapes = new Set()
    observation.shapes.set(key, shapes)
  }
  const shape = summarizedKeys(observation, value)
    .map(({ summary }) => summary)
    .join(",")
  shapes.add(shape)
  if (shapes.size > MAX_SHAPES_PER_LOCATION) fail("too-many-shapes")
}

function recordTransition(observation, eventType) {
  const previous = observation.sequence.at(-1)
  if (previous?.type === eventType) {
    previous.count += 1
    return
  }
  if (observation.sequence.length >= MAX_TRANSITIONS) fail("too-many-transitions")
  observation.sequence.push({ type: eventType, count: 1 })
}

function markCandidateKind(observation, value) {
  if (value === "web_search_call" || value.startsWith("response.web_search_call.")) {
    observation.candidateKindHints.add("web_search")
  }
  if (value === "x_search_call" || value.startsWith("response.x_search_call.")) {
    observation.candidateKindHints.add("x_search")
  }
  if (value === "function_call" || value.startsWith("response.function_call_arguments.")) {
    observation.candidateKindHints.add("function_call")
  }
}

function finishObservation(observation) {
  if (observation.eventCount === 0 || observation.terminalCount !== 1) fail("missing-completed")
  for (const kind of observation.requiredKinds) {
    if (!observation.candidateKindHints.has(kind)) fail(MISSING_KIND_CODES[kind])
  }
  if (observation.requiredKinds.includes("function_call")) {
    if (
      !observation.fixtureFunctionNameMatch ||
      !observation.fixtureFunctionArgumentsMatch
    ) fail("fixture-function-mismatch")
  }
  return {
    eventCount: observation.eventCount,
    candidateKindHints: [...observation.candidateKindHints].sort(),
    eventCounts: sortedObject(observation.eventCounts),
    sequence: observation.sequence,
    shapes: Object.fromEntries(
      [...observation.shapes.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, shapes]) => [key, [...shapes].sort()]),
    ),
    enums: Object.fromEntries(
      [...observation.enums.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, values]) => [key, [...values].sort()]),
    ),
    textBytes: observation.textBytes,
    argumentsBytes: observation.argumentsBytes,
    citationCount: observation.citationCount,
    usage: sortedObject(observation.usage),
    serverToolUsage: sortedObject(observation.serverToolUsage),
    unknownIdentifierCounts: {
      event: observation.aliases.event.size,
      field: observation.aliases.field.size,
      enum: observation.aliases.enum.size,
    },
    ...(observation.requiredKinds.includes("function_call")
      ? { fixtureFunctionShapeMatch: true }
      : {}),
    terminal: "completed",
  }
}

function summarizedKeys(observation, value) {
  const keys = Object.keys(value)
  if (keys.length > MAX_OBJECT_KEYS) fail("too-many-object-keys")
  return keys
    .map((raw) => {
      requireBoundedObservedString(raw, 96)
      return { raw, summary: summarizeIdentifier(observation, "field", raw) }
    })
    .sort(({ summary: left }, { summary: right }) => left.localeCompare(right))
}

function summarizeIdentifier(observation, kind, raw) {
  const safeValues = kind === "event"
    ? SAFE_EVENT_TYPES
    : kind === "field" ? SAFE_FIELD_NAMES : SAFE_ENUM_VALUES
  if (safeValues.has(raw)) return raw
  const aliases = observation.aliases[kind]
  let alias = aliases.get(raw)
  if (alias !== undefined) return alias
  if (aliases.size >= MAX_UNIQUE_TYPES * 8) fail("too-many-identifier-aliases")
  alias = `unknown-${kind}-${aliases.size + 1}`
  aliases.set(raw, alias)
  return alias
}

function requireBoundedObservedString(value, maxBytes) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > maxBytes
  ) fail("invalid-observed-name")
  return value
}

function observeFixtureFunction(observation, value) {
  if (value.name !== undefined) {
    const name = requireBoundedObservedString(value.name, 128)
    if (name !== "record_search_probe") fail("unexpected-function-name")
    observation.fixtureFunctionNameMatch = true
  }
  if (value.arguments !== undefined) {
    if (typeof value.arguments !== "string") fail("invalid-fixture-arguments")
    let parsed
    try {
      parsed = JSON.parse(value.arguments)
    } catch {
      return
    }
    if (
      isPlainObject(parsed) &&
      Object.keys(parsed).length === 1 &&
      parsed.status === "observed"
    ) observation.fixtureFunctionArgumentsMatch = true
  }
}

function increment(map, key) {
  if (!map.has(key) && map.size >= MAX_UNIQUE_TYPES) fail("too-many-event-types")
  map.set(key, (map.get(key) ?? 0) + 1)
}

function sortedObject(map) {
  for (const key of map.keys()) {
    if (typeof key !== "string" || !/^[A-Za-z0-9._-]+$/u.test(key)) {
      fail("unsafe-summary-key")
    }
  }
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function requireBoundConfirmation({ caseName, model, now = new Date() }) {
  const prefix = `YES:${CONFIRMATION_VERSION}:${caseName}:${model}:`
  const currentMinute = formatUtcMinute(now)
  const previousMinute = formatUtcMinute(new Date(now.getTime() - 60_000))
  const confirmation = process.env[CONFIRMATION_ENV]
  if (
    confirmation !== `${prefix}${currentMinute}` &&
    confirmation !== `${prefix}${previousMinute}`
  ) fail("confirmation-required")
}

function formatUtcMinute(value) {
  const pad = (part) => String(part).padStart(2, "0")
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}Z`
}

function requireSafeDebugEnvironment() {
  for (const name of ["DEBUG", "NODE_DEBUG", "NODE_OPTIONS", "UNDICI_DEBUG"]) {
    if (typeof process.env[name] === "string" && process.env[name].length > 0) {
      fail("unsafe-debug-environment")
    }
  }
}

function freezeTree(value) {
  const pending = [value]
  const seen = new WeakSet()
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === null || typeof current !== "object" || seen.has(current)) continue
    seen.add(current)
    for (const nested of Object.values(current)) pending.push(nested)
    Object.freeze(current)
  }
  return value
}

function writeRecord(record) {
  const output = JSON.stringify(record)
  if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) fail("summary-too-large")
  process.stdout.write(`${output}\n`)
}

function guardFail(state, code) {
  state.guardErrorCode = code
  fail(code)
}

function fail(code, status) {
  throw new SearchProtocolProbeError(code, status)
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

main().catch((error) => {
  const transportStatus = error?.name === "GrokTransportError" && Number.isSafeInteger(error.status)
    ? error.status
    : undefined
  const knownStatus = error instanceof SearchProtocolProbeError &&
    Number.isSafeInteger(error.status) &&
    error.status >= 100 &&
    error.status <= 599
    ? error.status
    : undefined
  const safeTransportStatus = transportStatus !== undefined &&
    transportStatus >= 100 &&
    transportStatus <= 599
    ? transportStatus
    : undefined
  writeRecord({
    kind: "search-protocol-probe",
    status: "failed",
    errorCode: publicErrorCode(error),
    ...(lastObservation === undefined
      ? {}
      : {
          observedCandidateKindHints: [...lastObservation.candidateKindHints].sort(),
          observedEventCounts: sortedObject(lastObservation.eventCounts),
        }),
    ...(knownStatus !== undefined
      ? { httpStatus: knownStatus }
      : safeTransportStatus === undefined ? {} : { httpStatus: safeTransportStatus }),
  })
  process.exitCode = 1
})

function publicErrorCode(error) {
  if (
    error instanceof SearchProtocolProbeError &&
    PUBLIC_FAILURE_CODES.has(error.code)
  ) return error.code
  return sanitizeErrorName(error?.name)
}

function sanitizeErrorName(name) {
  if (name === "GrokTransportError") return "transport-failed"
  if (
    name === "CredentialFileTooLargeError" ||
    name === "OfficialCredentialFileError" ||
    name === "UnsupportedCredentialError"
  ) return "credential-failed"
  if (name === "AbortError" || name === "TimeoutError") return "aborted"
  if (name === "InvalidResponsesSseError") return "invalid-event-stream"
  return "unexpected"
}

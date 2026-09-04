import assert from "node:assert/strict"
import test from "node:test"

import {
  InvalidRequestImageProjectionError,
  UnsupportedImageInputError,
  UnsupportedSearchCapabilityError,
  createResponsesRequestCompiler,
} from "../../../src/internal/responses-request-compiler.mjs"
import {
  ResponsesRequestTooLargeError,
  UnsupportedResponsesRequestError,
  encodeResponsesRequest,
} from "../../../src/internal/responses-request.mjs"

test("the request compiler preserves the legacy text wire request without consulting attachments", async () => {
  let attachmentLookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      attachmentLookups += 1
      throw new Error("the text-only path must not resolve attachments")
    },
  })
  const options = {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-1",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Hello" }],
    }],
  }
  let purposeReads = 0
  Object.defineProperty(options, "purpose", {
    enumerable: true,
    get() {
      purposeReads += 1
      throw new Error("disabled Search must not read purpose")
    },
  })
  const route = {
    backend: "responses",
    resolvedModelInfo: {
      provider: "grok",
      id: "grok-4.6",
      name: "Grok 4.6",
      inputModalities: ["text"],
    },
  }

  const expected = JSON.stringify(encodeResponsesRequest(options))
  const compiled = await compiler.compile(options, route)
  const actual = JSON.stringify(compiled.request)

  assert.equal(actual, expected)
  assert.deepEqual(compiled.receipt, { functionNames: [], serverTools: [] })
  assert.equal(Object.isFrozen(compiled), true)
  assert.equal(Object.isFrozen(compiled.request), true)
  assert.equal(Object.isFrozen(compiled.receipt), true)
  assert.equal(Object.isFrozen(compiled.receipt.functionNames), true)
  assert.equal(Object.isFrozen(compiled.receipt.serverTools), true)
  assert.equal(attachmentLookups, 0)
  assert.equal(purposeReads, 0)
})

test("Search tools are independent, ordered after functions, and reflected by a frozen receipt", async () => {
  const cases = [
    [{ webSearch: true, xSearch: false }, ["function", "web_search"]],
    [{ webSearch: false, xSearch: true }, ["function", "x_search"]],
    [{ webSearch: true, xSearch: true }, ["function", "web_search", "x_search"]],
  ]

  for (const [searchPolicy, expectedTypes] of cases) {
    const compiler = createResponsesRequestCompiler({
      searchPolicy: Object.freeze(searchPolicy),
    })
    const compiled = await compiler.compile(textOptions({
      tools: [fixtureTool("lookup")],
    }), searchRoute())

    assert.deepEqual(compiled.request.tools.map((tool) => tool.type), expectedTypes)
    assert.deepEqual(compiled.receipt, {
      functionNames: ["lookup"],
      serverTools: expectedTypes.filter((type) => type !== "function"),
    })
    assert.equal(Object.isFrozen(compiled.request.tools), true)
    assert.throws(() => compiled.receipt.serverTools.push("web_search"), TypeError)
    assert.throws(() => { compiled.request.tools[0].name = "forged" }, TypeError)
  }
})

test("enabled server Search tools replace only exact same-name Harness functions", async () => {
  const cases = [
    [{ webSearch: false, xSearch: false }, ["web_search", "x_search", "web_search_extra", "WEB_SEARCH"], []],
    [{ webSearch: true, xSearch: false }, ["x_search", "web_search_extra", "WEB_SEARCH"], ["web_search"]],
    [{ webSearch: false, xSearch: true }, ["web_search", "web_search_extra", "WEB_SEARCH"], ["x_search"]],
    [{ webSearch: true, xSearch: true }, ["web_search_extra", "WEB_SEARCH"], ["web_search", "x_search"]],
  ]

  for (const [searchPolicy, expectedFunctionNames, expectedServerTools] of cases) {
    const compiler = createResponsesRequestCompiler({ searchPolicy })
    const compiled = await compiler.compile(textOptions({
      tools: ["web_search", "x_search", "web_search_extra", "WEB_SEARCH"].map(fixtureTool),
    }), searchRoute())

    assert.deepEqual(
      compiled.request.tools?.filter((tool) => tool.type === "function").map((tool) => tool.name),
      expectedFunctionNames,
    )
    assert.deepEqual(compiled.receipt, {
      functionNames: expectedFunctionNames,
      serverTools: expectedServerTools,
    })
  }
})

test("a filtered Search function remains in historical input but cannot be called again", async () => {
  const compiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: false }),
  })
  const compiled = await compiler.compile(textOptions({
    tools: [fixtureTool("web_search"), fixtureTool("keep_tool")],
    messages: [
      {
        id: "assistant-search-history",
        role: "assistant",
        source: { kind: "model", provider: "grok", model: "grok-4.6" },
        content: [{
          type: "tool-call",
          id: "call-search-history",
          name: "web_search",
          arguments: '{"query":"public fixture"}',
        }],
      },
      {
        id: "tool-search-history",
        role: "user",
        source: { kind: "tool", callId: "call-search-history" },
        content: [{
          type: "tool-result",
          toolCallId: "call-search-history",
          isError: false,
          content: [{ type: "text", text: "Historical result" }],
        }],
      },
      {
        id: "user-after-search-history",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: "Continue" }],
      },
    ],
  }), searchRoute())

  assert.deepEqual(compiled.request.input.slice(0, 2), [
    {
      type: "function_call",
      call_id: "call-search-history",
      name: "web_search",
      arguments: '{"query":"public fixture"}',
    },
    {
      type: "function_call_output",
      call_id: "call-search-history",
      output: "Historical result",
    },
  ])
  assert.deepEqual(compiled.request.tools.map((tool) => [tool.type, tool.name]), [
    ["function", "keep_tool"],
    ["web_search", undefined],
  ])
  assert.deepEqual(compiled.receipt, {
    functionNames: ["keep_tool"],
    serverTools: ["web_search"],
  })
})

test("same-name functions are fully validated before Search replacement", () => {
  const compiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: true }),
  })
  const accessorTool = fixtureTool("web_search")
  let descriptionReads = 0
  Object.defineProperty(accessorTool, "description", {
    enumerable: true,
    get() {
      descriptionReads += 1
      return "must not be read"
    },
  })

  assert.throws(
    () => compiler.prepare(textOptions({ tools: [accessorTool] })),
    UnsupportedResponsesRequestError,
  )
  assert.equal(descriptionReads, 0)
  assert.throws(
    () => compiler.prepare(textOptions({
      tools: [fixtureTool("x_search"), fixtureTool("x_search")],
    })),
    UnsupportedResponsesRequestError,
  )
})

test("background purpose keeps same-name Harness functions because server Search is disabled", async () => {
  const compiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: true }),
  })
  const compiled = await compiler.compile(textOptions({
    purpose: "session-title",
    tools: [fixtureTool("web_search"), fixtureTool("x_search")],
  }), searchRoute())

  assert.deepEqual(compiled.request.tools.map((tool) => [tool.type, tool.name]), [
    ["function", "web_search"],
    ["function", "x_search"],
  ])
  assert.deepEqual(compiled.receipt, {
    functionNames: ["web_search", "x_search"],
    serverTools: [],
  })
})

test("Search purpose capture is synchronous, closed, and disabled for every nonempty purpose", async () => {
  const compiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: true }),
  })

  for (const purpose of ["compaction", "session-title", "future-background-purpose"]) {
    const compiled = await compiler.compile(textOptions({ purpose }), searchRoute())
    assert.equal(compiled.request.tools, undefined)
    assert.deepEqual(compiled.receipt, { functionNames: [], serverTools: [] })
  }

  for (const purpose of ["", null, false, 1, {}]) {
    assert.throws(
      () => compiler.prepare(textOptions({ purpose })),
      UnsupportedResponsesRequestError,
    )
  }

  let purposeReads = 0
  const accessorOptions = textOptions()
  Object.defineProperty(accessorOptions, "purpose", {
    enumerable: true,
    get() {
      purposeReads += 1
      return undefined
    },
  })
  assert.throws(() => compiler.prepare(accessorOptions), UnsupportedResponsesRequestError)
  assert.equal(purposeReads, 0)
})

test("Search capability is exact-route and distinguishes unsupported from malformed policy", async () => {
  const compiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: true }),
  })

  await assert.rejects(
    compiler.compile(textOptions({ model: "grok-4.5" }), textRoute("grok-4.5")),
    UnsupportedSearchCapabilityError,
  )
  await assert.rejects(
    compiler.compile(textOptions({ model: "grok-4.5" }), {
      ...textRoute("grok-4.5"),
      serverTools: ["web_search", "x_search"],
    }),
    UnsupportedSearchCapabilityError,
  )
  await assert.rejects(
    compiler.compile(textOptions(), searchRoute({ serverTools: ["web_search"] })),
    UnsupportedSearchCapabilityError,
  )
  await assert.rejects(
    compiler.compile(textOptions(), searchRoute({ serverTools: ["web_search", "future_tool"] })),
    (error) => error instanceof UnsupportedResponsesRequestError &&
      !(error instanceof UnsupportedSearchCapabilityError),
  )
})

test("Harness functions and Search tools share the closed 128-tool budget", async () => {
  const compiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: true }),
  })
  const withinBudget = await compiler.compile(textOptions({
    tools: Array.from({ length: 126 }, (_, index) => fixtureTool(`tool_${index}`)),
  }), searchRoute())

  assert.equal(withinBudget.request.tools.length, 128)
  assert.equal(withinBudget.receipt.functionNames.length, 126)
  assert.deepEqual(withinBudget.receipt.serverTools, ["web_search", "x_search"])
  await assert.rejects(compiler.compile(textOptions({
    tools: Array.from({ length: 127 }, (_, index) => fixtureTool(`tool_${index}`)),
  }), searchRoute()), UnsupportedResponsesRequestError)

  const withCollisions = await compiler.compile(textOptions({
    tools: [
      fixtureTool("web_search"),
      fixtureTool("x_search"),
      ...Array.from({ length: 126 }, (_, index) => fixtureTool(`kept_${index}`)),
    ],
  }), searchRoute())
  assert.equal(withCollisions.request.tools.length, 128)
  assert.equal(withCollisions.receipt.functionNames.length, 126)

  const webOnlyCompiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: false }),
  })
  const webOnlyBoundary = await webOnlyCompiler.compile(textOptions({
    tools: [
      fixtureTool("web_search"),
      ...Array.from({ length: 127 }, (_, index) => fixtureTool(`web_kept_${index}`)),
    ],
  }), searchRoute())
  assert.equal(webOnlyBoundary.request.tools.length, 128)
  await assert.rejects(webOnlyCompiler.compile(textOptions({
    tools: Array.from({ length: 128 }, (_, index) => fixtureTool(`web_over_${index}`)),
  }), searchRoute()), UnsupportedResponsesRequestError)
})

test("Search policy is snapshotted when the compiler module is created", async () => {
  const searchPolicy = { webSearch: true, xSearch: false }
  const compiler = createResponsesRequestCompiler({ searchPolicy })
  searchPolicy.webSearch = false
  searchPolicy.xSearch = true

  const compiled = await compiler.compile(textOptions(), searchRoute())
  assert.deepEqual(compiled.receipt.serverTools, ["web_search"])
})

test("the text-only fast path keeps the legacy acceptance domain outside the image block budget", async () => {
  let attachmentLookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      attachmentLookups += 1
      throw new Error("the text-only path must not resolve attachments")
    },
  })
  const options = {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-wide",
      role: "user",
      source: { kind: "user" },
      content: Array.from({ length: 20_001 }, () => ({ type: "text", text: "" })),
    }],
  }

  const expected = JSON.stringify(encodeResponsesRequest(options))
  const actual = JSON.stringify(await compileRequest(compiler, options, imageRoute()))

  assert.equal(actual, expected)
  assert.equal(attachmentLookups, 0)
})

test("the request compiler combines Search with an ordered image while omitting private reasoning", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  const signal = new AbortController().signal
  const reads = []
  const compiler = createResponsesRequestCompiler({
    searchPolicy: Object.freeze({ webSearch: true, xSearch: true }),
    getAttachmentStore: () => ({
      async readImageRequest(ref, policy, receivedSignal) {
        reads.push({ ref, policy, signal: receivedSignal })
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })
  const options = {
    provider: "grok",
    model: "grok-4.6",
    signal,
    messages: [{
      id: "user-1",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "text", text: "Before" },
        { type: "reasoning", text: "Private before-image reasoning." },
        { type: "image", attachment },
        { type: "reasoning", text: "Private after-image reasoning." },
        { type: "text", text: "After" },
      ],
    }],
  }

  const compiled = await compiler.compile(options, imageRoute())
  const request = compiled.request

  assert.deepEqual(reads, [{
    ref: attachment,
    policy: { maxBytes: 4 * 1024 * 1024, maxPixels: 16 * 1024 * 1024 },
    signal,
  }])
  assert.deepEqual(request.input, [{
    role: "user",
    content: [
      { type: "input_text", text: "Before" },
      {
        type: "input_image",
        image_url: `data:image/png;base64,${data.toString("base64")}`,
        detail: "high",
      },
      { type: "input_text", text: "After" },
    ],
  }])
  assert.deepEqual(compiled.receipt, {
    functionNames: [],
    serverTools: ["web_search", "x_search"],
  })
})

test("subagent settlement reasoning does not block a later image request", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [
      {
        id: "subagent-settled",
        role: "user",
        source: {
          kind: "subagent-settled",
          form: "notice",
          summary: "A child settled.",
          senderSessionId: "session-child",
        },
        content: [
          { type: "text", text: "Child " },
          { type: "text", text: "work " },
          { type: "reasoning", text: "Private child reasoning." },
          { type: "text", text: "settled." },
        ],
      },
      {
        id: "user-image",
        role: "user",
        source: { kind: "user" },
        content: [
          { type: "image", attachment },
          { type: "text", text: "Describe this image." },
        ],
      },
    ],
  }, imageRoute())

  assert.deepEqual(request.input, [
    { role: "user", content: "Child work settled." },
    {
      role: "user",
      content: [
        {
          type: "input_image",
          image_url: `data:image/png;base64,${data.toString("base64")}`,
          detail: "high",
        },
        { type: "input_text", text: "Describe this image." },
      ],
    },
  ])
})

test("image compilation replays only assistant reasoning and never user reasoning metadata", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [
      {
        id: "assistant-replay",
        role: "assistant",
        source: {
          kind: "model",
          provider: "grok",
          model: "grok-4.6",
          replayState: {
            response: { version: 1 },
            blocks: [
              { type: "reasoning", id: "rs_assistant", encryptedContent: "sealed-assistant" },
              null,
            ],
          },
        },
        content: [
          { type: "reasoning", text: "Assistant summary." },
          { type: "text", text: "Assistant answer." },
        ],
      },
      {
        id: "user-image-spoofed-replay",
        role: "user",
        source: {
          kind: "model",
          provider: "grok",
          model: "grok-4.6",
          replayState: {
            response: { version: 1 },
            blocks: [
              { type: "reasoning", id: "rs_user", encryptedContent: "sealed-user" },
              null,
            ],
          },
        },
        content: [
          { type: "reasoning", text: "Private user reasoning." },
          { type: "image", attachment },
        ],
      },
    ],
  }, imageRoute())

  assert.deepEqual(request.input, [
    {
      type: "reasoning",
      id: "rs_assistant",
      encrypted_content: "sealed-assistant",
      summary: [{ type: "summary_text", text: "Assistant summary." }],
    },
    { role: "assistant", content: "Assistant answer." },
    {
      role: "user",
      content: [{
        type: "input_image",
        image_url: `data:image/png;base64,${data.toString("base64")}`,
        detail: "high",
      }],
    },
  ])
})

test("invalid omitted user reasoning fails before attachment storage", async () => {
  let attachmentLookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      attachmentLookups += 1
      throw new Error("invalid reasoning must fail before attachment storage")
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "invalid-user-reasoning-image",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "reasoning", text: 42 },
        { type: "image", attachment: imageRef() },
      ],
    }],
  }, imageRoute()), (error) => (
    error?.name === "UnsupportedResponsesRequestError" &&
    !(error instanceof UnsupportedImageInputError)
  ))
  assert.equal(attachmentLookups, 0)
})

test("a verified JPEG projection is encoded as a JPEG data URL", async () => {
  const data = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const attachment = imageRef({ mediaType: "image/jpeg", bytes: data.byteLength })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/jpeg",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: false,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-jpeg",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment }],
    }],
  }, imageRoute())

  assert.equal(request.input[0].content[0].image_url, `data:image/jpeg;base64,${data.toString("base64")}`)
})

test("the request compiler preserves text and images nested in one tool result", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "tool-1",
      role: "user",
      source: { kind: "tool", callId: "call_fixture" },
      content: [{
        type: "tool-result",
        toolCallId: "call_fixture",
        isError: false,
        content: [
          { type: "text", text: "Before" },
          { type: "image", attachment },
          { type: "text", text: "After" },
        ],
      }],
    }],
  }, imageRoute())

  assert.deepEqual(request.input, [{
    type: "function_call_output",
    call_id: "call_fixture",
    output: [
      { type: "input_text", text: "Before" },
      {
        type: "input_image",
        image_url: `data:image/png;base64,${data.toString("base64")}`,
        detail: "high",
      },
      { type: "input_text", text: "After" },
    ],
  }])
})

test("tool-result reasoning with an image remains a generic invalid request", async () => {
  let attachmentLookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      attachmentLookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "tool-reasoning-image",
      role: "user",
      source: { kind: "tool", callId: "call_fixture" },
      content: [{
        type: "tool-result",
        toolCallId: "call_fixture",
        isError: false,
        content: [
          { type: "text", text: "Visible tool output." },
          { type: "reasoning", text: "Unsupported private tool reasoning." },
          { type: "image", attachment: imageRef() },
        ],
      }],
    }],
  }, imageRoute()), (error) => (
    error?.name === "UnsupportedResponsesRequestError" &&
    !(error instanceof UnsupportedImageInputError)
  ))
  assert.equal(attachmentLookups, 0)
})

test("the request compiler removes the oldest image until the final JSON fits 16 MiB", async () => {
  const data = Buffer.alloc(2 * 1024 * 1024)
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const oldest = imageRef({
    attachmentId: `sha256:${"d".repeat(64)}`,
    bytes: data.byteLength,
  })
  const middle = imageRef({
    attachmentId: `sha256:${"e".repeat(64)}`,
    bytes: data.byteLength,
  })
  const newest = imageRef({
    attachmentId: `sha256:${"f".repeat(64)}`,
    bytes: data.byteLength,
  })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [
      {
        id: "old",
        role: "user",
        source: { kind: "user" },
        content: [
          { type: "image", attachment: oldest },
          { type: "text", text: "x".repeat(6 * 1024 * 1024) },
        ],
      },
      {
        id: "middle",
        role: "user",
        source: { kind: "user" },
        content: [
          { type: "image", attachment: middle },
          { type: "text", text: "y".repeat(6 * 1024 * 1024) },
        ],
      },
      {
        id: "new",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "image", attachment: newest }],
      },
    ],
  }, imageRoute())

  assert.equal(request.input[0].role, "user")
  assert.match(request.input[0].content, /^\[image omitted to fit request image limits/u)
  assert.match(request.input[1].content, /^\[image omitted to fit request image limits/u)
  assert.equal(request.input[2].content[0].type, "input_image")
  assert.ok(Buffer.byteLength(JSON.stringify(request), "utf8") <= 16 * 1024 * 1024)
})

test("an already-aborted image request stops before resolving attachment storage", async () => {
  const controller = new AbortController()
  controller.abort()
  let lookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      throw new Error("attachment storage must not be resolved after abort")
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    signal: controller.signal,
    messages: [{
      id: "user-1",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: imageRef() }],
    }],
  }, imageRoute()), (error) => error?.name === "AbortError")
  assert.equal(lookups, 0)
})

test("an invalid image request envelope fails before resolving attachment storage", async () => {
  let lookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      throw new Error("invalid static options must fail before attachment storage")
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    temperature: 3,
    messages: [{
      id: "user-invalid-envelope",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: imageRef() }],
    }],
  }, imageRoute()), (error) => error?.name === "UnsupportedResponsesRequestError")
  assert.equal(lookups, 0)
})

test("the message-count bound fails before scanning or snapshotting image content", async () => {
  let blockReads = 0
  let lookups = 0
  const block = { attachment: imageRef() }
  Object.defineProperty(block, "type", {
    enumerable: true,
    get() {
      blockReads += 1
      return "image"
    },
  })
  const message = {
    id: "user-over-message-bound",
    role: "user",
    source: { kind: "user" },
    content: [block],
  }
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: Array.from({ length: 10_001 }, () => message),
  }, imageRoute()), (error) => error?.name === "UnsupportedResponsesRequestError")
  assert.equal(blockReads, 0)
  assert.equal(lookups, 0)
})

test("an accessor-backed model is rejected without splitting route and wire identity", async () => {
  let modelReads = 0
  let lookups = 0
  const options = {
    provider: "grok",
    messages: [{
      id: "user-accessor-model",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: imageRef() }],
    }],
  }
  Object.defineProperty(options, "model", {
    enumerable: true,
    get() {
      modelReads += 1
      return modelReads === 2 ? "grok-4.5" : "grok-4.6"
    },
  })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, options, imageRoute()), (error) => (
    error?.name === "UnsupportedResponsesRequestError"
  ))
  assert.equal(modelReads, 0)
  assert.equal(lookups, 0)
})

test("accessor-backed image block fields are rejected without route detection reads", async () => {
  let typeReads = 0
  let lookups = 0
  const block = { attachment: imageRef() }
  Object.defineProperty(block, "type", {
    enumerable: true,
    get() {
      typeReads += 1
      return typeReads === 1 ? "image" : "text"
    },
  })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      role: "user",
      source: { kind: "user" },
      content: [block],
    }],
  }, imageRoute()), (error) => error?.name === "UnsupportedResponsesRequestError")
  assert.equal(typeReads, 0)
  assert.equal(lookups, 0)
})

test("caller-owned message array methods cannot replace the captured image graph", async () => {
  let mapCalls = 0
  let lookups = 0
  const messages = [{
    id: "user-array-method",
    role: "user",
    source: { kind: "user" },
    content: [{ type: "image", attachment: imageRef() }],
  }]
  messages.map = () => {
    mapCalls += 1
    return [{
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "text", text: "Forged" },
        { type: "image", attachment: imageRef() },
      ],
    }]
  }
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages,
  }, imageRoute()), (error) => error?.name === "UnsupportedResponsesRequestError")
  assert.equal(mapCalls, 0)
  assert.equal(lookups, 0)
})

test("a malformed image reference fails as unsupported before offloading or resolving storage", async (context) => {
  for (const [name, attachment] of [["missing", undefined], ["null", null]]) {
    await context.test(name, async () => {
      let lookups = 0
      const compiler = createResponsesRequestCompiler({
        getAttachmentStore() {
          lookups += 1
          throw new Error("malformed references must fail before attachment storage")
        },
      })

      await assert.rejects(compileRequest(compiler, {
        provider: "grok",
        model: "grok-4.6",
        messages: [{
          id: `user-malformed-${name}`,
          role: "user",
          source: { kind: "user" },
          content: [{ type: "image", attachment }],
        }],
      }, imageRoute()), UnsupportedImageInputError)
      assert.equal(lookups, 0)
    })
  }
})

test("an image request snapshots messages before awaiting attachment I/O", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  let markReadStarted
  let releaseRead
  const readStarted = new Promise((resolve) => { markReadStarted = resolve })
  const readReleased = new Promise((resolve) => { releaseRead = resolve })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        markReadStarted()
        await readReleased
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })
  const options = {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-snapshot",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "text", text: "Before" },
        { type: "image", attachment },
      ],
    }],
  }

  const compiled = compileRequest(compiler, options, imageRoute())
  await readStarted
  options.messages[0].content[0].text = "After"
  options.signal = AbortSignal.abort()
  releaseRead()
  const request = await compiled

  assert.equal(request.input[0].content[0].text, "Before")
})

test("an image request snapshots the raw reasoning replay marker before attachment I/O", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  let markReadStarted
  let releaseRead
  const readStarted = new Promise((resolve) => { markReadStarted = resolve })
  const readReleased = new Promise((resolve) => { releaseRead = resolve })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        markReadStarted()
        await readReleased
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })
  const replayBlock = {
    type: "reasoning",
    id: "rs_raw_snapshot",
    encryptedContent: "sealed-raw-snapshot",
    textType: "reasoning_text",
  }
  const options = {
    provider: "grok",
    model: "grok-4.6",
    messages: [
      {
        id: "assistant-raw-snapshot",
        role: "assistant",
        source: {
          kind: "model",
          provider: "grok",
          model: "grok-4.6",
          replayState: {
            response: { version: 1 },
            blocks: [replayBlock],
          },
        },
        content: [{ type: "reasoning", text: "Raw reasoning." }],
      },
      {
        id: "user-image-after-raw",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "image", attachment }],
      },
    ],
  }

  const compiled = compileRequest(compiler, options, imageRoute())
  await readStarted
  replayBlock.textType = "summary_text"
  releaseRead()
  const request = await compiled

  assert.deepEqual(request.input[0], {
    type: "reasoning",
    id: "rs_raw_snapshot",
    encrypted_content: "sealed-raw-snapshot",
    summary: [],
  })
})

test("an image request rejects custom-prototype attachment references before storage", async () => {
  class ImageAttachmentRef {
    constructor() {
      Object.assign(this, imageRef())
    }
  }

  let lookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      throw new Error("custom-prototype references must fail before attachment storage")
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-custom-ref",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: new ImageAttachmentRef() }],
    }],
  }, imageRoute()), UnsupportedImageInputError)
  assert.equal(lookups, 0)
})

test("an image request rejects attachment reference accessors without invocation", async () => {
  let widthReads = 0
  let lookups = 0
  const attachment = imageRef()
  Object.defineProperty(attachment, "width", {
    enumerable: true,
    get() {
      widthReads += 1
      return widthReads === 1 ? 16 : 32
    },
  })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment }],
    }],
  }, imageRoute()), UnsupportedImageInputError)
  assert.equal(widthReads, 0)
  assert.equal(lookups, 0)
})

test("an image request does not activate replay from a custom-prototype source", async () => {
  class ModelMessageSource {
    constructor() {
      this.kind = "model"
      this.provider = "grok"
      this.model = "grok-4.6"
      this.replayState = {
        response: { version: 1 },
        blocks: [{ type: "reasoning", id: "reasoning_1", encryptedContent: "sealed" }],
      }
    }
  }

  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [
      {
        id: "assistant-custom-source",
        role: "assistant",
        source: new ModelMessageSource(),
        content: [{ type: "reasoning", text: "" }],
      },
      {
        id: "user-image",
        role: "user",
        source: { kind: "user" },
        content: [{ type: "image", attachment }],
      },
    ],
  }, imageRoute())

  assert.equal(request.input.some((item) => item.type === "reasoning"), false)
  assert.equal(request.input[0].content[0].type, "input_image")
})

test("an oversized static request envelope fails before resolving attachment storage", async () => {
  let lookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      throw new Error("an oversized static envelope must fail before attachment storage")
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    system: "s".repeat(8 * 1024 * 1024),
    tools: Array.from({ length: 10 }, (_, index) => ({
      name: `fixture_${index}`,
      description: "fixture",
      parameters: { type: "object", fixture: "x".repeat(900_000) },
    })),
    messages: [{
      id: "user-static-envelope-too-large",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: imageRef() }],
    }],
  }, imageRoute()), ResponsesRequestTooLargeError)
  assert.equal(lookups, 0)
})

test("duplicate attachment references are read once but remain separate image occurrences", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  let reads = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        reads += 1
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-1",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "image", attachment },
        { type: "image", attachment: { ...attachment } },
      ],
    }],
  }, imageRoute())

  assert.equal(reads, 1)
  assert.deepEqual(request.input[0].content.map((block) => block.type), [
    "input_image",
    "input_image",
  ])
})

test("conflicting metadata for one attachment id fails before resolving storage", async () => {
  let lookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })
  const attachment = imageRef()

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-conflict",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "image", attachment },
        { type: "image", attachment: { ...attachment, width: 2 } },
      ],
    }],
  }, imageRoute()), UnsupportedImageInputError)
  assert.equal(lookups, 0)
})

test("a ninth image offloads the oldest occurrence before attachment reads", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachments = Array.from({ length: 9 }, (_, index) => imageRef({
    attachmentId: `sha256:${String(index).padStart(64, "0")}`,
    bytes: data.byteLength,
  }))
  const reads = []
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        reads.push(ref.attachmentId)
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-nine",
      role: "user",
      source: { kind: "user" },
      content: attachments.map((attachment) => ({ type: "image", attachment })),
    }],
  }, imageRoute())

  assert.equal(reads.length, 8)
  assert.equal(reads.includes(attachments[0].attachmentId), false)
  assert.equal(request.input[0].content[0].type, "input_text")
  assert.equal(request.input[0].content.filter((block) => block.type === "input_image").length, 8)
})

test("aggregate projected bytes offload the oldest image after bounded reads", async () => {
  const data = Buffer.alloc(3 * 1024 * 1024)
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const attachments = Array.from({ length: 3 }, (_, index) => imageRef({
    attachmentId: `sha256:${String(index + 10).padStart(64, "0")}`,
    bytes: data.byteLength,
  }))
  let reads = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        reads += 1
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const request = await compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-byte-budget",
      role: "user",
      source: { kind: "user" },
      content: attachments.map((attachment) => ({ type: "image", attachment })),
    }],
  }, imageRoute())

  assert.equal(reads, 3)
  assert.equal(request.input[0].content[0].type, "input_text")
  assert.equal(request.input[0].content.filter((block) => block.type === "input_image").length, 2)
  assert.ok(Buffer.byteLength(JSON.stringify(request), "utf8") <= 16 * 1024 * 1024)
})

test("unsupported nested tool-result structure fails before reading attachments", async () => {
  let reads = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest() { reads += 1 },
    }),
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "tool-1",
      role: "user",
      source: { kind: "tool", callId: "outer" },
      content: [{
        type: "tool-result",
        toolCallId: "outer",
        content: [{
          type: "tool-result",
          toolCallId: "inner",
          content: [{ type: "image", attachment: imageRef() }],
        }],
      }],
    }],
  }, imageRoute()), (error) => error?.name === "UnsupportedResponsesRequestError")
  assert.equal(reads, 0)
})

test("an over-wide image content tree fails before resolving attachment storage", async () => {
  let lookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-1",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "image", attachment: imageRef() },
        ...Array.from({ length: 20_000 }, () => ({ type: "text", text: "" })),
      ],
    }],
  }, imageRoute()), (error) => error?.name === "UnsupportedResponsesRequestError")
  assert.equal(lookups, 0)
})

test("an over-wide image array fails before enumerating or copying its keys", async () => {
  let ownKeyReads = 0
  let lookups = 0
  const target = new Array(20_001)
  target[0] = { type: "image", attachment: imageRef() }
  const content = new Proxy(target, {
    ownKeys(array) {
      ownKeyReads += 1
      return Reflect.ownKeys(array)
    },
  })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      role: "user",
      source: { kind: "user" },
      content,
    }],
  }, imageRoute()), (error) => error?.name === "UnsupportedResponsesRequestError")
  assert.equal(ownKeyReads, 0)
  assert.equal(lookups, 0)
})

test("unsupported source MIME fails before resolving attachment storage", async () => {
  let lookups = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore() {
      lookups += 1
      return undefined
    },
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-webp",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: imageRef({ mediaType: "image/webp" }) }],
    }],
  }, imageRoute()), UnsupportedImageInputError)
  assert.equal(lookups, 0)
})

test("validated request image bytes are isolated from later store mutation", async () => {
  const original = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const firstData = Buffer.from(original)
  const first = imageRef({
    attachmentId: `sha256:${"a".repeat(64)}`,
    bytes: original.byteLength,
  })
  const second = imageRef({
    attachmentId: `sha256:${"b".repeat(64)}`,
    bytes: original.byteLength,
  })
  let markSecondReadStarted
  let releaseSecondRead
  const secondReadStarted = new Promise((resolve) => { markSecondReadStarted = resolve })
  const secondReadReleased = new Promise((resolve) => { releaseSecondRead = resolve })
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        const data = ref.attachmentId === first.attachmentId
          ? firstData
          : Buffer.from(original)
        if (ref.attachmentId === second.attachmentId) {
          markSecondReadStarted()
          await secondReadReleased
        }
        return {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          mediaType: "image/png",
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
      },
    }),
  })

  const compiled = compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-mutable-projection",
      role: "user",
      source: { kind: "user" },
      content: [
        { type: "image", attachment: first },
        { type: "image", attachment: second },
      ],
    }],
  }, imageRoute())
  await secondReadStarted
  await new Promise((resolve) => setImmediate(resolve))
  firstData.fill(0)
  releaseSecondRead()

  const request = await compiled
  assert.equal(
    request.input[0].content[0].image_url,
    `data:image/png;base64,${original.toString("base64")}`,
  )
})

test("request image projection accessors are rejected without invocation", async () => {
  const data = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const attachment = imageRef({ bytes: data.byteLength })
  let mediaTypeReads = 0
  const compiler = createResponsesRequestCompiler({
    getAttachmentStore: () => ({
      async readImageRequest(ref) {
        const version = {
          variantId: `fixture:${ref.attachmentId}`,
          attachment: ref,
          data,
          bytes: data.byteLength,
          width: 1,
          height: 1,
          depth: "uchar",
          space: "srgb",
          hasAlpha: true,
        }
        Object.defineProperty(version, "mediaType", {
          enumerable: true,
          get() {
            mediaTypeReads += 1
            return "image/png"
          },
        })
        return version
      },
    }),
  })

  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-accessor-projection",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment }],
    }],
  }, imageRoute()), InvalidRequestImageProjectionError)
  assert.equal(mediaTypeReads, 0)
})

test("invalid attachment projections are internal contract errors", async (context) => {
  const validData = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
  const oversizedData = Buffer.alloc((4 * 1024 * 1024) + 1)
  oversizedData.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const cases = [
    ["MIME magic", { data: Buffer.alloc(validData.byteLength) }],
    ["byte count", { bytes: validData.byteLength + 1 }],
    ["per-image bytes", { data: oversizedData, bytes: oversizedData.byteLength }],
    ["maximum dimension", { width: 8193 }],
    ["pixel count", { width: 4097, height: 4096 }],
    ["pixel depth", { depth: "float" }],
    ["color space", { space: "display-p3" }],
    ["alpha metadata", { hasAlpha: "yes" }],
  ]

  for (const [name, override] of cases) {
    await context.test(name, async () => {
      const attachment = imageRef({ bytes: validData.byteLength })
      let reads = 0
      const compiler = createResponsesRequestCompiler({
        getAttachmentStore: () => ({
          async readImageRequest(ref) {
            reads += 1
            return {
              variantId: `fixture:${ref.attachmentId}`,
              attachment: ref,
              data: validData,
              mediaType: "image/png",
              bytes: validData.byteLength,
              width: 1,
              height: 1,
              depth: "uchar",
              space: "srgb",
              hasAlpha: true,
              ...override,
            }
          },
        }),
      })

      await assert.rejects(compileRequest(compiler, {
        provider: "grok",
        model: "grok-4.6",
        messages: [{
          id: `user-invalid-${name}`,
          role: "user",
          source: { kind: "user" },
          content: [{ type: "image", attachment }],
        }],
      }, imageRoute()), InvalidRequestImageProjectionError)
      assert.equal(reads, 1)
    })
  }
})

test("image policy failures use a dedicated error type", async () => {
  const compiler = createResponsesRequestCompiler()
  await assert.rejects(compileRequest(compiler, {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-1",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "image", attachment: imageRef() }],
    }],
  }, imageRoute()), UnsupportedImageInputError)
})

async function compileRequest(compiler, options, route) {
  return (await compiler.compile(options, route)).request
}

function textOptions(overrides = {}) {
  return {
    provider: "grok",
    model: "grok-4.6",
    messages: [{
      id: "user-search",
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "Hello" }],
    }],
    ...overrides,
  }
}

function fixtureTool(name) {
  return {
    name,
    description: `Fixture tool ${name}`,
    parameters: { type: "object", properties: {} },
  }
}

function textRoute(model = "grok-4.6") {
  return {
    backend: "responses",
    resolvedModelInfo: {
      provider: "grok",
      id: model,
      name: model,
      inputModalities: ["text"],
    },
  }
}

function searchRoute({ serverTools = ["web_search", "x_search"] } = {}) {
  return {
    ...textRoute(),
    serverTools,
  }
}

function imageRoute() {
  return {
    backend: "responses",
    resolvedModelInfo: {
      provider: "grok",
      id: "grok-4.6",
      name: "Grok 4.6",
      inputModalities: ["text", "image"],
    },
    imageInput: {
      readPolicy: { maxBytes: 4 * 1024 * 1024, maxPixels: 16 * 1024 * 1024 },
      maxDimension: 8192,
      maxImages: 8,
      maxTotalBytes: 8 * 1024 * 1024,
      mediaTypes: ["image/jpeg", "image/png"],
    },
    serverTools: ["web_search", "x_search"],
  }
}

function imageRef({
  attachmentId = `sha256:${"a".repeat(64)}`,
  mediaType = "image/png",
  bytes = 68,
  width = 1,
  height = 1,
} = {}) {
  return { attachmentId, mediaType, bytes, width, height }
}

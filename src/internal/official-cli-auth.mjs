import path from "node:path"

const GRACE_MS = 5_000
const DEFAULT_VERSION_TIMEOUT_MS = 10 * 1000
const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_LOGOUT_TIMEOUT_MS = 2 * 60 * 1000
const DEFAULT_REFRESH_TIMEOUT_MS = 30 * 1000
const MAX_TIMER_DELAY_MS = 2_147_483_647
const FAILURE_REASONS = new Set([
  "cli-missing",
  "cli-invalid",
  "auth-network-timeout",
  "login-timeout",
  "cli-failed",
])
const OIDC_DISCOVERY_PATH = "auth.x.ai/.well-known/openid-configuration"

export class OfficialCliAuthError extends Error {
  constructor(reason = "cli-failed") {
    super("The official Grok CLI login could not be completed")
    this.name = "OfficialCliAuthError"
    this.reason = FAILURE_REASONS.has(reason) ? reason : "cli-failed"
  }
}

export class OfficialCliCleanupError extends OfficialCliAuthError {
  constructor() {
    super()
    this.name = "OfficialCliCleanupError"
  }
}

export function createOfficialCliAuth({
  subprocess,
  platform,
  homeDir,
  verifyExecutable,
  versionTimeoutMs = DEFAULT_VERSION_TIMEOUT_MS,
  loginTimeoutMs = DEFAULT_LOGIN_TIMEOUT_MS,
  logoutTimeoutMs = DEFAULT_LOGOUT_TIMEOUT_MS,
  refreshTimeoutMs = DEFAULT_REFRESH_TIMEOUT_MS,
  onCleanupFailure = () => {},
}) {
  if (
    !subprocess ||
    typeof subprocess.resolveExecutable !== "function" ||
    typeof subprocess.spawn !== "function" ||
    (platform !== "darwin" && platform !== "win32") ||
    typeof homeDir !== "string" ||
    homeDir.length === 0 ||
    typeof verifyExecutable !== "function" ||
    !isTimeout(versionTimeoutMs) ||
    !isTimeout(loginTimeoutMs) ||
    !isTimeout(logoutTimeoutMs) ||
    !isTimeout(refreshTimeoutMs) ||
    typeof onCleanupFailure !== "function"
  ) {
    throw new TypeError("Invalid official Grok CLI auth dependencies")
  }

  const pathApi = platform === "win32" ? path.win32 : path.posix
  const grokHome = pathApi.join(homeDir, ".grok")
  const candidate = pathApi.join(grokHome, "bin", platform === "win32" ? "grok.exe" : "grok")
  const cliEnvironment = buildCliEnvironment(platform, homeDir)
  const isolation = new AbortController()
  let cleanupFailed = false

  const latchCleanupFailure = (error = new OfficialCliCleanupError()) => {
    if (cleanupFailed) return
    cleanupFailed = true
    isolation.abort(error)
    try {
      onCleanupFailure()
    } catch {
      // The CLI instance remains latched even if its owner cannot synchronously isolate it.
    }
  }

  const assertCleanupHealthy = () => {
    if (cleanupFailed) throw new OfficialCliCleanupError()
  }

  const inspectExecutable = async (callerSignal) => {
    let resolved
    try {
      try {
        resolved = await withDeadline(callerSignal, versionTimeoutMs, async (signal) => {
          const executable = await subprocess.resolveExecutable(candidate, {}, signal)
          if (typeof executable !== "string" || !pathApi.isAbsolute(executable)) {
            throw new OfficialCliAuthError("cli-invalid")
          }
          signal.throwIfAborted()
          return executable
        })
      } catch (error) {
        if (callerSignal?.aborted || isTimeoutError(error) || error instanceof OfficialCliAuthError) {
          throw error
        }
        throw new OfficialCliAuthError("cli-missing")
      }
      try {
        await withDeadline(callerSignal, versionTimeoutMs, async (signal) => {
          await verifyExecutable({ candidate, resolved, grokHome, platform }, signal)
          signal.throwIfAborted()
        })
      } catch (error) {
        if (callerSignal?.aborted || isTimeoutError(error) || error instanceof OfficialCliCleanupError) {
          throw error
        }
        throw new OfficialCliAuthError("cli-invalid")
      }
      const version = await withDeadline(callerSignal, versionTimeoutMs, (signal) => runCollected(subprocess, {
        argv: [resolved, "--version"],
        cwd: grokHome,
        maxBytes: 4 * 1024,
        signal,
        env: cliEnvironment,
        teardownTimeoutMs: versionTimeoutMs,
      }))
      const displayVersion = parseGrokVersion(version.stdout)
      if (!didProcessSucceed(version) || displayVersion === undefined || version.stderr.length !== 0) {
        throw new OfficialCliAuthError("cli-invalid")
      }
      return Object.freeze({ resolved, version: displayVersion })
    } finally {
      resolved = undefined
    }
  }

  const inspectCapability = async (resolved, callerSignal, requiredCapability) => {
    try {
      const help = await withDeadline(callerSignal, versionTimeoutMs, (signal) => runCollected(subprocess, {
        argv: [resolved, ...requiredCapability.helpArgv],
        cwd: grokHome,
        maxBytes: 16 * 1024,
        signal,
        env: cliEnvironment,
        teardownTimeoutMs: versionTimeoutMs,
      }))
      if (!didProcessSucceed(help) || help.stderr.length !== 0 || !hasCliOption(help.stdout, requiredCapability.option)) {
        throw new OfficialCliAuthError("cli-invalid")
      }
    } catch (error) {
      if (callerSignal?.aborted || error instanceof OfficialCliCleanupError) throw error
      if (error instanceof OfficialCliAuthError) throw error
      throw new OfficialCliAuthError("cli-invalid")
    }
  }

  const runAction = async (argvTail, callerSignal, timeoutMs, requiredCapability, timeoutReason) => {
    const operation = createLinkedSignal(callerSignal, isolation.signal)
    let executable
    let actionStarted = false
    try {
      assertCleanupHealthy()
      executable = await inspectExecutable(operation.signal)
      if (requiredCapability) {
        await inspectCapability(executable.resolved, operation.signal, requiredCapability)
      }

      actionStarted = true
      const action = await withDeadline(operation.signal, timeoutMs, (signal) => runCollected(subprocess, {
        argv: [executable.resolved, ...argvTail],
        cwd: grokHome,
        maxBytes: 64 * 1024,
        signal,
        env: cliEnvironment,
        teardownTimeoutMs: versionTimeoutMs,
      }))
      if (!didProcessSucceed(action)) {
        throw new OfficialCliAuthError(classifyActionFailure(action.stderr))
      }
      return Object.freeze({ kind: "succeeded" })
    } catch (error) {
      if (error instanceof OfficialCliCleanupError) {
        latchCleanupFailure(error)
        throw error
      }
      if (callerSignal?.aborted) {
        return Object.freeze({ kind: "cancelled" })
      }
      const reason = error instanceof OfficialCliAuthError
        ? error.reason
        : actionStarted && isTimeoutError(error)
          ? timeoutReason
          : "cli-failed"
      if (!actionStarted) {
        if (error instanceof OfficialCliAuthError) throw error
        throw new OfficialCliAuthError(reason)
      }
      return Object.freeze({ kind: "failed", reason })
    } finally {
      operation.dispose()
      executable = undefined
    }
  }

  return Object.freeze({
    async inspect({ signal } = {}) {
      if (cleanupFailed) return Object.freeze({ state: "unavailable" })
      const operation = createLinkedSignal(signal, isolation.signal)
      try {
        const executable = await inspectExecutable(operation.signal)
        await inspectCapability(executable.resolved, operation.signal, {
          helpArgv: ["login", "--help"],
          option: "--oauth",
        })
        return Object.freeze({ state: "ready", version: executable.version })
      } catch (error) {
        if (error instanceof OfficialCliCleanupError) {
          latchCleanupFailure(error)
          return Object.freeze({ state: "unavailable" })
        }
        if (signal?.aborted) throw error
        if (error instanceof OfficialCliAuthError && error.reason === "cli-missing") {
          return Object.freeze({ state: "missing" })
        }
        return Object.freeze({ state: "invalid" })
      } finally {
        operation.dispose()
      }
    },
    login({ signal } = {}) {
      return runAction(["login", "--oauth"], signal, loginTimeoutMs, {
        helpArgv: ["login", "--help"],
        option: "--oauth",
      }, "login-timeout")
    },
    logout({ signal } = {}) {
      return runAction(["logout"], signal, logoutTimeoutMs, undefined, "cli-failed")
    },
    refresh({ signal } = {}) {
      return runAction(["models"], signal, refreshTimeoutMs, undefined, "cli-failed")
    },
  })
}

function parseGrokVersion(output) {
  if (typeof output !== "string") return undefined
  const match = /^grok\s+([0-9A-Za-z][0-9A-Za-z.+_-]{0,63})(?:\s+[^\r\n]+)?$/u.exec(output.trim())
  return match?.[1]
}

function didProcessSucceed(result) {
  return result?.outcome?.exitCode === 0 && result.outcome.signal === null
}

function classifyActionFailure(stderr) {
  const normalized = typeof stderr === "string" ? stderr.toLowerCase() : ""
  if (normalized.includes(OIDC_DISCOVERY_PATH) && normalized.includes("operation timed out")) {
    return "auth-network-timeout"
  }
  return "cli-failed"
}

function isTimeoutError(error) {
  return error?.name === "TimeoutError"
}

function hasCliOption(output, expectedOption) {
  if (typeof output !== "string" || typeof expectedOption !== "string") return false
  return output.split(/\r?\n/u).some((line) => {
    const trimmed = line.trimStart()
    if (!trimmed.startsWith("-")) return false
    const optionColumn = trimmed.split(/\s{2,}/u, 1)[0]
    return optionColumn.split(/[\s,]+/u).includes(expectedOption)
  })
}

function createLinkedSignal(callerSignal, isolationSignal) {
  const controller = new AbortController()
  const sources = [callerSignal, isolationSignal].filter((signal) => signal !== undefined)
  const listeners = sources.map((source) => {
    const listener = () => controller.abort(source.reason)
    if (source.aborted) listener()
    else source.addEventListener("abort", listener, { once: true })
    return { source, listener }
  })
  return {
    signal: controller.signal,
    dispose() {
      for (const { source, listener } of listeners) source.removeEventListener("abort", listener)
    },
  }
}

function createDeadline(callerSignal, timeoutMs) {
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(callerSignal.reason)
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs)
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      callerSignal?.removeEventListener("abort", abortFromCaller)
    },
  }
}

async function withDeadline(callerSignal, timeoutMs, operation) {
  const deadline = createDeadline(callerSignal, timeoutMs)
  try {
    return await operation(deadline.signal)
  } finally {
    deadline.dispose()
  }
}

function isTimeout(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIMER_DELAY_MS
}

async function runCollected(subprocess, { argv, cwd, maxBytes, signal, env, teardownTimeoutMs }) {
  let handle
  let stdout
  let stderr
  let processFinished = false
  try {
    handle = subprocess.spawn({
      argv,
      cwd,
      stdio: {
        stdin: "ignore",
        stdout: { maxBytes },
        stderr: { maxBytes },
      },
      graceMs: GRACE_MS,
      signal,
      env,
    })
    if (!isProcessHandle(handle)) throw new OfficialCliAuthError()
    const outcome = await waitForProcessDone(handle.done, signal)
    if (!isOutcome(outcome)) throw new OfficialCliAuthError()
    stdout = readCollected(handle.collected.stdout)
    stderr = readCollected(handle.collected.stderr)
    processFinished = true
    return { outcome, stdout, stderr }
  } finally {
    if (handle && typeof handle.waitForExit === "function") {
      if (!processFinished || signal?.aborted) terminateBestEffort(handle)
      await waitForProcessTree(handle, teardownTimeoutMs)
      signal?.throwIfAborted()
    }
    stderr = undefined
    stdout = undefined
    handle = undefined
  }
}

async function waitForProcessDone(done, signal) {
  signal?.throwIfAborted()
  if (signal === undefined) return done
  let onAbort
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
    signal.addEventListener("abort", onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
  try {
    return await Promise.race([Promise.resolve(done), aborted])
  } finally {
    signal.removeEventListener("abort", onAbort)
  }
}

async function waitForProcessTree(handle, timeoutMs) {
  const deadline = createDeadline(undefined, timeoutMs)
  try {
    const exited = await handle.waitForExit(deadline.signal)
    if (exited !== true) {
      terminateBestEffort(handle)
      throw new OfficialCliCleanupError()
    }
  } catch (error) {
    terminateBestEffort(handle)
    if (error instanceof OfficialCliCleanupError) throw error
    throw new OfficialCliCleanupError()
  } finally {
    deadline.dispose()
  }
}

function terminateBestEffort(handle) {
  try {
    handle.terminate()
  } catch {
    // The subprocess service retains ownership of a tree that failed bounded cleanup.
  }
}

function buildCliEnvironment(platform, homeDir) {
  const environment = {}
  const fixedTombstones = [
    "BROWSER",
    "GROK_AUTH_PROVIDER_COMMAND",
    "GROK_CONFIG",
    "GROK_CONFIG_PATH",
    "GROK_HOME",
    "NODE_EXTRA_CA_CERTS",
    "NODE_OPTIONS",
    "NODE_PATH",
    "SSLKEYLOGFILE",
    "XAI_API_KEY",
  ]
  for (const name of fixedTombstones) environment[name] = undefined
  for (const name of Object.keys(process.env)) {
    if (/^(?:GROK_|XAI_|DYLD_|LD_)/iu.test(name)) environment[name] = undefined
  }

  if (platform === "darwin") {
    environment.HOME = homeDir
    environment.PATH = "/usr/bin:/bin:/usr/sbin:/sbin"
  } else {
    const inheritedRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
    const systemRoot = typeof inheritedRoot === "string" && path.win32.isAbsolute(inheritedRoot) &&
      inheritedRoot.length <= 260 && !/[\r\n\0]/u.test(inheritedRoot)
      ? path.win32.normalize(inheritedRoot)
      : "C:\\Windows"
    environment.USERPROFILE = homeDir
    environment.PATH = [
      path.win32.join(systemRoot, "System32"),
      systemRoot,
      path.win32.join(systemRoot, "System32", "Wbem"),
    ].join(";")
    environment.PATHEXT = ".COM;.EXE;.BAT;.CMD"
    environment.COMSPEC = path.win32.join(systemRoot, "System32", "cmd.exe")
  }
  return Object.freeze(environment)
}

function readCollected(reader) {
  if (!reader || typeof reader.readFrom !== "function") throw new OfficialCliAuthError()
  const output = reader.readFrom(0)
  if (
    !output ||
    typeof output.text !== "string" ||
    output.lossy !== false ||
    output.spillPath !== undefined
  ) throw new OfficialCliAuthError()
  return output.text
}

function isProcessHandle(handle) {
  return (
    handle !== null &&
    typeof handle === "object" &&
    handle.done &&
    typeof handle.done.then === "function" &&
    handle.collected &&
    typeof handle.waitForExit === "function"
  )
}

function isOutcome(outcome) {
  return (
    outcome !== null &&
    typeof outcome === "object" &&
    (Number.isSafeInteger(outcome.exitCode) || outcome.exitCode === null) &&
    (typeof outcome.signal === "string" || outcome.signal === null)
  )
}

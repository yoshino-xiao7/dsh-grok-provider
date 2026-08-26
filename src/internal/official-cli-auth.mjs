import path from "node:path"

const EXPECTED_VERSION = "grok 1.0.5 (5115b46bc909)"
const GRACE_MS = 5_000
const DEFAULT_VERSION_TIMEOUT_MS = 10 * 1000
const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_LOGOUT_TIMEOUT_MS = 2 * 60 * 1000
const DEFAULT_REFRESH_TIMEOUT_MS = 30 * 1000
const MAX_TIMER_DELAY_MS = 2_147_483_647

export class OfficialCliAuthError extends Error {
  constructor() {
    super("The official Grok CLI login could not be completed")
    this.name = "OfficialCliAuthError"
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
    !isTimeout(refreshTimeoutMs)
  ) {
    throw new TypeError("Invalid official Grok CLI auth dependencies")
  }

  const pathApi = platform === "win32" ? path.win32 : path.posix
  const grokHome = pathApi.join(homeDir, ".grok")
  const candidate = pathApi.join(grokHome, "bin", platform === "win32" ? "grok.exe" : "grok")
  const cliEnvironment = buildCliEnvironment(platform, homeDir)

  const runAction = async (argvTail, callerSignal, timeoutMs) => {
    let preparationDeadline = createDeadline(callerSignal, versionTimeoutMs)
    let actionDeadline
    let resolved
    try {
      resolved = await subprocess.resolveExecutable(candidate, {}, preparationDeadline.signal)
      if (typeof resolved !== "string" || !pathApi.isAbsolute(resolved)) throw new OfficialCliAuthError()
      await verifyExecutable({ candidate, resolved, grokHome, platform })

      const version = await runCollected(subprocess, {
        argv: [resolved, "--version"],
        cwd: grokHome,
        maxBytes: 4 * 1024,
        signal: preparationDeadline.signal,
        env: cliEnvironment,
      })
      if (version.stdout.trim() !== EXPECTED_VERSION || version.stderr.length !== 0) {
        throw new OfficialCliAuthError()
      }

      preparationDeadline.dispose()
      preparationDeadline = undefined
      actionDeadline = createDeadline(callerSignal, timeoutMs)
      await runCollected(subprocess, {
        argv: [resolved, ...argvTail],
        cwd: grokHome,
        maxBytes: 64 * 1024,
        signal: actionDeadline.signal,
        env: cliEnvironment,
      })
      return Object.freeze({ kind: "succeeded" })
    } catch (error) {
      if (callerSignal?.aborted) {
        return Object.freeze({ kind: "cancelled" })
      }
      if (error instanceof OfficialCliAuthError || error instanceof TypeError) throw error
      throw new OfficialCliAuthError()
    } finally {
      actionDeadline?.dispose()
      preparationDeadline?.dispose()
      resolved = undefined
    }
  }

  return Object.freeze({
    login({ signal } = {}) {
      return runAction(["login", "--oauth"], signal, loginTimeoutMs)
    },
    logout({ signal } = {}) {
      return runAction(["logout"], signal, logoutTimeoutMs)
    },
    refresh({ signal } = {}) {
      return runAction(["models"], signal, refreshTimeoutMs)
    },
  })
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

function isTimeout(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIMER_DELAY_MS
}

async function runCollected(subprocess, { argv, cwd, maxBytes, signal, env }) {
  let handle
  let stdout
  let stderr
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
    const outcome = await handle.done
    if (!isOutcome(outcome) || outcome.exitCode !== 0 || outcome.signal !== null) {
      throw new OfficialCliAuthError()
    }
    stdout = readCollected(handle.collected.stdout)
    stderr = readCollected(handle.collected.stderr)
    return { stdout, stderr }
  } finally {
    if (handle && typeof handle.waitForExit === "function") {
      const exited = await handle.waitForExit()
      if (exited !== true && !signal?.aborted) throw new OfficialCliAuthError()
    }
    stderr = undefined
    stdout = undefined
    handle = undefined
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

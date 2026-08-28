import { lstat, realpath, stat } from "node:fs/promises"
import path from "node:path"

export class OfficialCliVerificationError extends Error {
  constructor() {
    super("The official Grok CLI executable path is invalid or unsupported")
    this.name = "OfficialCliVerificationError"
  }
}

export async function verifyOfficialCliExecutable({ candidate, resolved, grokHome, platform }, signal) {
  if (
    typeof candidate !== "string" ||
    typeof resolved !== "string" ||
    typeof grokHome !== "string" ||
    (platform !== "darwin" && platform !== "win32") ||
    !isOptionalAbortSignal(signal)
  ) throw new TypeError("Invalid official Grok CLI verification request")

  const pathApi = platform === "win32" ? path.win32 : path.posix
  if (!pathApi.isAbsolute(candidate) || !pathApi.isAbsolute(resolved) || !pathApi.isAbsolute(grokHome)) {
    throw new OfficialCliVerificationError()
  }

  try {
    signal?.throwIfAborted()
    const [candidateInfo, canonicalCandidate, canonicalResolved, canonicalHome] = await waitForMetadata([
      lstat(candidate),
      realpath(candidate),
      realpath(resolved),
      realpath(grokHome),
    ], signal)
    signal?.throwIfAborted()
    const [resolvedInfo] = await waitForMetadata([stat(canonicalCandidate)], signal)
    if (!resolvedInfo.isFile()) throw new OfficialCliVerificationError()

    if (platform === "darwin") {
      if (!candidateInfo.isFile() && !candidateInfo.isSymbolicLink()) throw new OfficialCliVerificationError()
      if ((resolvedInfo.mode & 0o111) === 0 || (resolvedInfo.mode & 0o022) !== 0) {
        throw new OfficialCliVerificationError()
      }
      if (typeof process.getuid === "function") {
        const userId = process.getuid()
        if (candidateInfo.uid !== userId || resolvedInfo.uid !== userId) {
          throw new OfficialCliVerificationError()
        }
      }
    } else {
      if (!candidateInfo.isFile() || candidateInfo.isSymbolicLink()) throw new OfficialCliVerificationError()
      if (pathApi.extname(candidate).toLowerCase() !== ".exe") throw new OfficialCliVerificationError()
    }

    const normalize = (value) => platform === "win32" ? value.toLowerCase() : value
    if (normalize(pathApi.normalize(canonicalCandidate)) !== normalize(pathApi.normalize(canonicalResolved))) {
      throw new OfficialCliVerificationError()
    }
    const relative = pathApi.relative(canonicalHome, canonicalCandidate)
    if (relative === "" || relative === ".." || relative.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relative)) {
      throw new OfficialCliVerificationError()
    }
  } catch (error) {
    if (error instanceof OfficialCliVerificationError || error instanceof TypeError) throw error
    throw new OfficialCliVerificationError()
  }
}

function isOptionalAbortSignal(signal) {
  return signal === undefined || (
    signal !== null &&
    typeof signal === "object" &&
    typeof signal.aborted === "boolean" &&
    typeof signal.addEventListener === "function" &&
    typeof signal.removeEventListener === "function" &&
    typeof signal.throwIfAborted === "function"
  )
}

async function waitForMetadata(operations, signal) {
  const pending = Promise.all(operations)
  if (signal === undefined) return pending
  signal.throwIfAborted()
  let onAbort
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
    signal.addEventListener("abort", onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
  try {
    return await Promise.race([pending, aborted])
  } finally {
    signal.removeEventListener("abort", onAbort)
  }
}

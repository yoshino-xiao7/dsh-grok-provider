import { lstat, realpath, stat } from "node:fs/promises"
import path from "node:path"

export class OfficialCliVerificationError extends Error {
  constructor() {
    super("The official Grok CLI executable path is invalid or unsupported")
    this.name = "OfficialCliVerificationError"
  }
}

export async function verifyOfficialCliExecutable({ candidate, resolved, grokHome, platform }) {
  if (
    typeof candidate !== "string" ||
    typeof resolved !== "string" ||
    typeof grokHome !== "string" ||
    (platform !== "darwin" && platform !== "win32")
  ) throw new TypeError("Invalid official Grok CLI verification request")

  const pathApi = platform === "win32" ? path.win32 : path.posix
  if (!pathApi.isAbsolute(candidate) || !pathApi.isAbsolute(resolved) || !pathApi.isAbsolute(grokHome)) {
    throw new OfficialCliVerificationError()
  }

  try {
    const [candidateInfo, canonicalCandidate, canonicalResolved, canonicalHome] = await Promise.all([
      lstat(candidate),
      realpath(candidate),
      realpath(resolved),
      realpath(grokHome),
    ])
    const resolvedInfo = await stat(canonicalCandidate)
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

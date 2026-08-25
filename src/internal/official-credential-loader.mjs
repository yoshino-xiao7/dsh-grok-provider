import { constants } from "node:fs"
import { lstat, open } from "node:fs/promises"
import path from "node:path"

const MAX_CREDENTIAL_BYTES = 64 * 1024

export class OfficialCredentialFileError extends Error {
  constructor() {
    super("The official Grok credential file is missing or insecure")
    this.name = "OfficialCredentialFileError"
  }
}

export function isSameOpenedFile(before, opened) {
  return before.dev === opened.dev && before.ino === opened.ino
}

export function createOfficialCredentialLoader({ authPath, platform }) {
  if (
    typeof authPath !== "string" ||
    (platform !== "darwin" && platform !== "win32") ||
    !(platform === "win32" ? path.win32 : path.posix).isAbsolute(authPath)
  ) {
    throw new TypeError("Invalid official Grok credential path")
  }

  return async function loadOfficialCredential() {
    let handle
    try {
      const before = await lstat(authPath)
      if (!before.isFile() || before.isSymbolicLink()) throw new OfficialCredentialFileError()
      const flags = platform === "darwin"
        ? constants.O_RDONLY | constants.O_NOFOLLOW
        : constants.O_RDONLY
      handle = await open(authPath, flags)
      const opened = await handle.stat()
      if (
        !isSameOpenedFile(before, opened) ||
        !opened.isFile() ||
        opened.size < 1 ||
        opened.size > MAX_CREDENTIAL_BYTES
      ) {
        throw new OfficialCredentialFileError()
      }
      if (platform === "darwin") {
        if ((opened.mode & 0o777) !== 0o600) throw new OfficialCredentialFileError()
        if (typeof process.getuid === "function" && opened.uid !== process.getuid()) {
          throw new OfficialCredentialFileError()
        }
      }
      const bytes = await handle.readFile()
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== opened.size) {
        throw new OfficialCredentialFileError()
      }
      return bytes
    } catch (error) {
      if (error instanceof OfficialCredentialFileError || error instanceof TypeError) throw error
      throw new OfficialCredentialFileError()
    } finally {
      if (handle !== undefined) await handle.close()
      handle = undefined
    }
  }
}

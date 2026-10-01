import { LlmError } from "@deepseek-ai/dsh-llm"

import { AuthModeUnavailableError } from "./auth-registry.mjs"
import {
  CredentialFileTooLargeError,
  UnsupportedCredentialError,
} from "./credential-source.mjs"
import { GrokTransportError } from "./grok-transport.mjs"
import { OfficialCredentialFileError } from "./official-credential-loader.mjs"
import {
  UnsupportedImageInputError,
  UnsupportedSearchCapabilityError,
} from "./responses-request-compiler.mjs"

export function mapLlmError(error, signal) {
  if (signal?.aborted || error?.name === "AbortError") {
    return new LlmError("The Grok Build request was cancelled", "ABORTED", { cause: error })
  }
  if (error instanceof LlmError) return error
  if (
    error instanceof AuthModeUnavailableError ||
    error instanceof UnsupportedCredentialError ||
    error instanceof CredentialFileTooLargeError ||
    error instanceof OfficialCredentialFileError ||
    (error instanceof GrokTransportError && (error.status === 401 || error.status === 403))
  ) {
    return new LlmError("Grok authentication is required", "AUTH", {
      cause: error,
      ...(error.status === undefined ? {} : { status: error.status }),
    })
  }
  if (error instanceof GrokTransportError) {
    if (error.status === 429) {
      return new LlmError("The Grok Build request failed", "RATE_LIMIT", {
        cause: error,
        status: error.status,
      })
    }
    // Pre-stream deadline abort: nothing was emitted, the host retry policy may
    // replay the whole request safely.
    if (error.timedOut === true && error.preStream === true) {
      return new LlmError(
        "The Grok Build request timed out before the Grok Build service responded",
        "TIMEOUT",
        { cause: error },
      )
    }
    // Pre-stream connection failure (proxy route down, TLS reset, refused dial).
    if (error.preStream === true) {
      return new LlmError(
        "The Grok Build request could not reach the Grok Build service",
        "TRANSPORT",
        { cause: error },
      )
    }
    // Pre-stream 5xx from the fixed proxy (upstream gateway error).
    if (typeof error.status === "number" && error.status >= 500) {
      return new LlmError("The Grok Build request failed", "SERVER", {
        cause: error,
        status: error.status,
      })
    }
    return new LlmError("The Grok Build request failed", "PROVIDER_ERROR", {
      cause: error,
      ...(error.status === undefined ? {} : { status: error.status }),
    })
  }
  if (
    error instanceof UnsupportedImageInputError ||
    isUnsupportedAttachmentError(error)
  ) {
    return new LlmError("The Grok model cannot accept this image input", "UNSUPPORTED_CONTENT", {
      cause: error,
    })
  }
  if (error instanceof UnsupportedSearchCapabilityError) {
    return new LlmError("The Grok model cannot use the requested Search capability", "UNSUPPORTED_CONTENT", {
      cause: error,
    })
  }
  return new LlmError("The Grok provider rejected an invalid or unsupported response", "INVALID_RESPONSE", {
    cause: error,
  })
}

function isUnsupportedAttachmentError(error) {
  return error instanceof Error && [
    "TOO_MANY_IMAGES",
    "IMAGES_TOO_LARGE",
    "UNSUPPORTED_IMAGE_TYPE",
    "INVALID_IMAGE_BASE64",
    "INVALID_IMAGE",
    "IMAGE_TYPE_MISMATCH",
    "IMAGE_TOO_LARGE",
    "IMAGE_TOO_MANY_PIXELS",
    "IMAGE_DIMENSION_TOO_LARGE",
    "ATTACHMENT_PROJECTION_UNSUPPORTED",
  ].includes(error.code)
}

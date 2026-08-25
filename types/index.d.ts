import type { Context } from "@deepseek-ai/cordis"
import type Schema from "@deepseek-ai/schemastery"

export interface Config {
  authMode?: "official-cli" | "managed-device"
}

export declare const name: "llm-grok"
export declare const inject: readonly ["llm"]
export declare const Config: Schema<Config>
export declare function apply(ctx: Context, config?: Config): void

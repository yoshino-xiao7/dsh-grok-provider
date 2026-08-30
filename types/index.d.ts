import type { Context } from "@deepseek-ai/cordis"
import type Schema from "@deepseek-ai/schemastery"

export interface Config {
  webSearch?: boolean
  xSearch?: boolean
}

export declare const name: "llm-grok"
export declare const inject: readonly ["llm"]
export declare const Config: Schema<Config>
export declare function apply(ctx: Context, config: Config): void

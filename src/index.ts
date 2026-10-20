/**
 * dsh-voyage-log — Host plugin entry.
 *
 * The Node half: declares the validated Config, starts the VoyageRuntime Remote
 * over the harness session-query service, and registers the Typert manifest.
 * It never opens a socket of its own and never leaves the machine — the browser
 * half asks for one session's fold and gets it back locally.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-typert-registry'
import { VoyageRuntime } from './runtime.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import type { ResolvedConfig } from './types.ts'

/** Cordis plugin name. Must match package.json `name` and cordis.patch.yml. */
export const name = 'dsh-voyage-log'
/** Services required before the Remote can serve a fold. */
export const inject = ['typert', 'sessionQuery']

/** Plugin configuration, validated and defaulted by the schema below. */
export interface Config {
  /** Rewrite secret-shaped spans before anything crosses to the browser. */
  redactSecrets?: boolean
  /** Timeline rows kept per turn before the leg is capped. */
  maxTurnEvents?: number
}

/** Configuration schema with defaults. Users override keys in cordis.patch.yml. */
export const Config = z.object({
  redactSecrets: z.boolean().default(true),
  maxTurnEvents: z.natural().min(20).max(5000).default(240),
})

/** Start the host Remote and register the Typert manifest. */
export function apply(ctx: Context, config?: Config): void {
  const resolved = Config(config ?? {}) as ResolvedConfig
  new VoyageRuntime(ctx, resolved)
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-voyage-log: typert manifest')
}

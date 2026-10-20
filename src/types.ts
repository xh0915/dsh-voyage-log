/**
 * dsh-voyage-log — Host-only shared types.
 *
 * The wire payload types are inferred from the Zod schemas in schema.ts (the
 * single authority); this file only carries the host's resolved configuration.
 */

/** Resolved host configuration (the validated Config from index.ts). */
export interface ResolvedConfig {
  /** Rewrite secret-shaped spans before anything crosses to the browser. */
  redactSecrets: boolean
  /** Timeline rows kept per turn before the leg is capped. */
  maxTurnEvents: number
}

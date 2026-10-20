/**
 * dsh-voyage-log — Host Typert manifest for the voyage Remote.
 *
 * Reflection metadata only (the registry contributes no prompt, tool, or session
 * event). Keep `invocations` pointing at contract.ts, which the client half shares.
 */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { DSH_VOYAGE_INVOCATIONS } from './contract.ts'

/** Host manifest for the voyage Remote. */
export const TYPERT_MANIFEST: TypertContribution = {
  package: 'dsh-voyage-log', face: 'host', schemas: [],
  model: {
    services: [{
      key: 'voyage', exportName: 'VoyageRuntime',
      description: 'Fold one session log into a voyage report for the Voyage Log view.',
      tags: [], members: [
        { kind: 'method', name: 'build', signature: 'build(sessionId: string, signal?: AbortSignal): Promise<VoyageLog>' },
      ], types: [],
    }], events: [], objects: [],
  },
  invocations: DSH_VOYAGE_INVOCATIONS,
}

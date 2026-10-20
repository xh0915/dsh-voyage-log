/**
 * dsh-voyage-log — Client Remote contribution and typed namespace face.
 *
 * `TypertRemoteNamespace$766f79616765` is the hex encoding of the service key
 * "voyage" (v=76 o=6f y=79 a=61 g=67 e=65). Keep this name and the
 * TypertRemoteMap keys in sync with the `id`s in contract.ts.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { VoyageLog } from '../schema.ts'
import { DSH_VOYAGE_INVOCATIONS } from '../contract.ts'

/** Client contribution for the voyage Remote. */
export const DSH_VOYAGE_REMOTE: TypertRemoteContribution = { package: 'dsh-voyage-log', descriptors: DSH_VOYAGE_INVOCATIONS }

declare module '@deepseek-ai/dsh-typert-protocol' {
  /** The mounted voyage namespace face. */
  interface TypertRemoteNamespace$766f79616765 {
    build: (sessionId: string, signal?: AbortSignal) => Promise<RemoteResult<VoyageLog>>
  }
  interface TypertRemoteMap {
    'voyage/build': TypertRemoteNamespace$766f79616765['build']
  }
  interface TypertRemoteNamespaceMap { voyage: TypertRemoteNamespace$766f79616765 }
}

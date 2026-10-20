/**
 * dsh-voyage-log — Host Remote service.
 *
 * `voyage.build(sessionId)` reads one real session log through the harness
 * session-query service, folds it, redacts it, and returns the report. Nothing
 * here invents numbers: every reading comes off the raw log, and a session with
 * no foldable events reports as such instead of padding the deck.
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-session-query'
import { sessionIdSchema } from './contract.ts'
import { foldSession, type RawEvent, type RawHeader } from './fold.ts'
import type { VoyageLog } from './schema.ts'
import type { ResolvedConfig } from './types.ts'

/** Failure codes this service can forward from the query engine. */
const NOT_FOUND = 'SESSION_QUERY_SESSION_NOT_FOUND'
const ABORTED = 'SESSION_QUERY_ABORTED'
const CORRUPT = 'SESSION_QUERY_CORRUPT_SESSION'
const INVALID_SURFACE = 'SESSION_QUERY_INVALID_SURFACE'
const PERSISTENCE = 'SESSION_QUERY_PERSISTENCE_FAILED'

/** Map a query-engine failure onto copy the view can show honestly. */
function voyageFailure(reason: unknown): Error {
  const code = (reason as { code?: unknown }).code
  if (typeof code === 'string') {
    if (code === NOT_FOUND) return new Error('这个会话还没有可读取的日志。')
    if (code === ABORTED) return new Error('航海日志的读取已取消。')
    if (code === CORRUPT || code === INVALID_SURFACE) return new Error('会话日志无法通过校验，航海日志拒绝猜测内容。')
    if (code === PERSISTENCE) return new Error('会话持久层当前不可读，稍后重试。')
  }
  return reason instanceof Error ? reason : new Error(String(reason))
}

/** Host-side service backing the `voyage` Remote namespace. */
export class VoyageRuntime extends TypertRemoteService {
  /** @param ctx - owning Cordis context. @param config - resolved plugin config. */
  constructor(ctx: Context, private readonly config: ResolvedConfig) { super(ctx, 'voyage') }

  /**
   * Fold the session log of `sessionId` into a voyage report.
   * @param sessionId - the session the view is currently showing.
   * @param signal - transport cancellation from the browser.
   * @returns the redacted voyage report.
   */
  @Remote
  async build(sessionId: string, signal?: AbortSignal): Promise<VoyageLog> {
    const id = sessionIdSchema.parse(sessionId)
    let snapshot: SessionLogSnapshot
    try {
      snapshot = await this.ctx.sessionQuery.readSession(id as unknown as SessionId)
    } catch (reason) {
      throw voyageFailure(reason)
    }
    if (signal?.aborted) throw new Error('航海日志的读取已取消。')

    const header = snapshot.session as unknown as RawHeader
    const report = foldSession(
      { id: String(header.id), createdAt: header.createdAt, cwd: header.cwd, agentPreset: header.agentPreset },
      snapshot.events as unknown as RawEvent[],
      { redactSecrets: this.config.redactSecrets, maxTurnEvents: this.config.maxTurnEvents },
    )
    return report
  }
}

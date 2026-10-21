/**
 * Host-half contract: one session in, one honest report out.
 *
 * The runtime is driven against a fake Cordis context whose `sessionQuery` hands
 * back the same snapshot shape the real service does, so the query failure codes
 * and the redaction switch are covered without booting the harness.
 */
import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, Config, inject, name } from '../src/index.ts'
import { VoyageRuntime } from '../src/runtime.ts'
import { TYPERT_MANIFEST } from '../src/typert.ts'
import { foldSession } from '../src/fold.ts'
import type { ResolvedConfig } from '../src/types.ts'
import { fullFold, sampleEvents, sampleHeader } from './sample.ts'

const CONFIG: ResolvedConfig = { redactSecrets: true, maxTurnEvents: 240 }

/** The snapshot shape `sessionQuery.readSession` resolves to. */
const snapshot = { session: sampleHeader, events: sampleEvents }

/** The minimum reflect surface a Cordis service registers itself through. */
function fakeReflect(): { provided: Array<[string, unknown]>; provide(key: string, service: unknown): void; get(key: string): unknown } {
  const provided: Array<[string, unknown]> = []
  return {
    provided,
    provide: (key: string, service: unknown) => { provided.push([key, service]) },
    get: (key: string) => provided.find(([k]) => k === key)?.[1],
  }
}

/** A context whose query service resolves `value` or rejects `failure`. */
function makeContext(value: unknown, failure?: unknown): Context {
  return {
    sessionQuery: { readSession: failure === undefined ? vi.fn(async () => value) : vi.fn(async () => { throw failure }) },
    reflect: fakeReflect(),
  } as unknown as Context
}

/** Construct the service against a fake context. */
function runtime(ctx: Context, config: ResolvedConfig = CONFIG): VoyageRuntime {
  return new VoyageRuntime(ctx, config)
}

/** Failure carrying a query-engine code. */
function failure(code: string): Error {
  return Object.assign(new Error(`boom: ${code}`), { code })
}

describe('voyage runtime', () => {
  it('folds the session the view is showing', async () => {
    const report = await runtime(makeContext(snapshot)).build('session-01harrow')
    expect(report.sessionId).toBe(sampleHeader.id)
    expect(report.cwd).toBe(sampleHeader.cwd)
    expect(report.counts.rawEvents).toBe(sampleEvents.length)
    // The fold stamps its own clock; every other byte must match a direct fold.
    expect({ ...report, generatedAt: 0 }).toEqual({ ...foldSession({
      id: sampleHeader.id, createdAt: sampleHeader.createdAt, cwd: sampleHeader.cwd, agentPreset: sampleHeader.agentPreset,
    }, sampleEvents, fullFold), generatedAt: 0 })
  })

  it('trims the session id before the query', async () => {
    const ctx = makeContext(snapshot)
    await runtime(ctx).build('  session-01harrow  ')
    expect(ctx.sessionQuery.readSession).toHaveBeenCalledWith(sampleHeader.id)
  })

  it('refuses a blank or oversized session id', async () => {
    const service = runtime(makeContext(snapshot))
    await expect(service.build('   ')).rejects.toThrow()
    await expect(service.build('s'.repeat(201))).rejects.toThrow()
    await expect(service.build(42 as unknown as string)).rejects.toThrow()
  })

  it('turns every query failure into copy the view can show', async () => {
    const cases: Array<[string, string]> = [
      ['SESSION_QUERY_SESSION_NOT_FOUND', '还没有可读取的日志'],
      ['SESSION_QUERY_ABORTED', '已取消'],
      ['SESSION_QUERY_CORRUPT_SESSION', '不会去猜内容'],
      ['SESSION_QUERY_INVALID_SURFACE', '不会去猜内容'],
      ['SESSION_QUERY_PERSISTENCE_FAILED', '稍后重试'],
    ]
    for (const [code, expected] of cases) {
      await expect(runtime(makeContext(undefined, failure(code))).build('session-01harrow')).rejects.toThrow(expected)
    }
  })

  it('passes an unknown failure through untouched', async () => {
    await expect(runtime(makeContext(undefined, new Error('socket hang up'))).build('session-01harrow')).rejects.toThrow('socket hang up')
  })

  it('stops when the browser cancels the transport', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(runtime(makeContext(snapshot)).build('session-01harrow', controller.signal)).rejects.toThrow('已取消')
  })

  it('honours the redaction switch from config', async () => {
    const redacted = await runtime(makeContext(snapshot), { ...CONFIG, redactSecrets: false }).build('session-01harrow')
    expect(redacted.redaction).toEqual({ count: 0, kinds: [], enabled: false })
    const guarded = await runtime(makeContext(snapshot), CONFIG).build('session-01harrow')
    expect(guarded.redaction.enabled).toBe(true)
    expect(guarded.redaction.count).toBeGreaterThan(0)
  })

  it('applies the cap from config, not a hard-coded one', async () => {
    const ctx = makeContext({ session: sampleHeader, events: sampleEvents })
    const tight = await runtime(ctx, { redactSecrets: true, maxTurnEvents: 20 }).build('session-01harrow')
    expect(tight.turns.every((turn) => turn.events.length <= 20)).toBe(true)
  })
})

describe('host entry', () => {
  it('declares the plugin name and the services it needs', () => {
    expect(name).toBe('dsh-voyage-log')
    expect(inject).toEqual(['typert', 'sessionQuery'])
  })

  it('defaults the config through the schema', () => {
    expect(Config({} as never)).toEqual({ redactSecrets: true, maxTurnEvents: 240 })
  })

  it('rejects a leg budget below the readable floor', () => {
    expect(() => Config({ maxTurnEvents: 5 } as never)).toThrow()
  })

  it('starts the remote and registers the manifest', () => {
    const registered: unknown[] = []
    const disposers: unknown[] = []
    const reflect = fakeReflect()
    // Cordis runs a compose-time effect immediately and keeps what it returns.
    const ctx = {
      effect: (fn: () => unknown) => { disposers.push(fn()) },
      reflect,
      typert: { register: (manifest: unknown) => { registered.push(manifest); return () => undefined } },
    } as unknown as Context
    apply(ctx, {})
    expect(reflect.provided.map(([key]) => key)).toEqual(['voyage'])
    expect(registered).toEqual([TYPERT_MANIFEST])
    expect(TYPERT_MANIFEST).toMatchObject({ package: 'dsh-voyage-log', face: 'host' })
    expect(disposers).toHaveLength(1)
    expect(typeof disposers[0]).toBe('function')
  })
})

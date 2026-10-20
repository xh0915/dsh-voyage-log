import { describe, expect, it } from 'vitest'
import { DSH_VOYAGE_INVOCATIONS, sessionIdSchema } from '../src/contract.ts'
import { TYPERT_MANIFEST } from '../src/typert.ts'
import { DSH_VOYAGE_REMOTE } from '../src/client/remote.ts'
import { VoyageLogSchema } from '../src/schema.ts'
import { foldSample } from './sample.ts'

const build = DSH_VOYAGE_INVOCATIONS[0]

describe('the shared wire contract', () => {
  it('exposes exactly one method on the voyage namespace', () => {
    expect(DSH_VOYAGE_INVOCATIONS).toHaveLength(1)
    expect(build).toMatchObject({
      id: 'dsh-voyage-log#voyage/build',
      service: 'voyage',
      namespace: 'voyage',
      method: 'build',
      invocation: { kind: 'direct' },
    })
  })

  it('takes one JSON session id and a transport cancellation', () => {
    expect(build.parameters).toHaveLength(1)
    expect(build.parameters[0]).toMatchObject({ name: 'sessionId', wire: 'sessionId', source: 'json' })
    expect(build.parameters[0]?.acceptsUndefined).toBeUndefined()
    expect(build.parameters[0]?.codec.mode).toBe('strict')
    expect(build.cancellation).toEqual({ parameter: 'signal' })
    expect(build.result.mode).toBe('strict')
  })

  it('shares one descriptor array between the host manifest and the client contribution', () => {
    expect(TYPERT_MANIFEST.invocations).toBe(DSH_VOYAGE_INVOCATIONS)
    expect(DSH_VOYAGE_REMOTE.descriptors).toBe(DSH_VOYAGE_INVOCATIONS)
    expect(TYPERT_MANIFEST.package).toBe(DSH_VOYAGE_REMOTE.package)
    expect(TYPERT_MANIFEST.face).toBe('host')
  })

  it('describes the service the host actually registers', () => {
    const service = TYPERT_MANIFEST.model.services.find((entry) => entry.key === 'voyage')
    expect(service).toMatchObject({ key: 'voyage', exportName: 'VoyageRuntime' })
    expect(service?.members).toEqual([{ kind: 'method', name: 'build', signature: 'build(sessionId: string, signal?: AbortSignal): Promise<VoyageLog>' }])
    expect(TYPERT_MANIFEST.model.events).toEqual([])
    expect(TYPERT_MANIFEST.model.objects).toEqual([])
  })

  it('derives the reflected remote key from the same service and method', () => {
    expect(`${build.service}/${build.method}`).toBe('voyage/build')
  })
})

describe('the session id codec guards the boundary', () => {
  it('accepts a real id and trims surrounding space', () => {
    expect(sessionIdSchema.parse('session-01harrow')).toBe('session-01harrow')
    expect(sessionIdSchema.parse('  session-01harrow  ')).toBe('session-01harrow')
  })

  it('rejects a missing, blank, or absurdly long id', () => {
    expect(sessionIdSchema.safeParse('').success).toBe(false)
    expect(sessionIdSchema.safeParse('   ').success).toBe(false)
    expect(sessionIdSchema.safeParse('x'.repeat(201)).success).toBe(false)
    expect(sessionIdSchema.safeParse(undefined).success).toBe(false)
    expect(sessionIdSchema.safeParse(42).success).toBe(false)
  })

  it('is the codec the parameter actually carries', () => {
    const codec = build.parameters[0]?.codec
    expect(codec.mode === 'strict' && codec.schema === sessionIdSchema).toBe(true)
  })
})

describe('the result codec is strict about the fold', () => {
  it('accepts what the fold really produces', () => {
    expect(VoyageLogSchema.safeParse(foldSample()).success).toBe(true)
  })

  it('rejects a payload that invents or drops numbers', () => {
    const honest = foldSample()
    const forge = <K extends keyof typeof honest>(key: K, value: unknown) => ({ ...honest, [key]: value })
    expect(VoyageLogSchema.safeParse(forge('tokens', { input: -1, output: 0, cacheRead: 0 })).success).toBe(false)
    expect(VoyageLogSchema.safeParse(forge('tokens', { input: 1.5, output: 0, cacheRead: 0 })).success).toBe(false)
    expect(VoyageLogSchema.safeParse(forge('tools', undefined)).success).toBe(false)
    expect(VoyageLogSchema.safeParse(forge('sessionId', '')).success).toBe(false)
    expect(VoyageLogSchema.safeParse(forge('title', 'x'.repeat(201))).success).toBe(false)
  })

  it('refuses an oversized row field on the way out', () => {
    const log = foldSample()
    const row = { ...log.turns[0].events[0], text: 'x'.repeat(1_201) }
    const forged = { ...log, turns: [{ ...log.turns[0], events: [row] }, ...log.turns.slice(1)] }
    expect(VoyageLogSchema.safeParse(forged).success).toBe(false)
  })

  it('keeps the result codec pointed at the fold schema', () => {
    const codec = build.result
    expect(codec.mode === 'strict' && codec.schema === VoyageLogSchema).toBe(true)
  })
})

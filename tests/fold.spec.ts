import { describe, expect, it } from 'vitest'
import { VoyageLogSchema } from '../src/schema.ts'
import { MASK } from '../src/redact.ts'
import { BASE, RELAY_KEY, foldSample, sampleEvents, sampleHeader } from './sample.ts'

const rows = (index: number) => foldSample().turns[index].events

describe('foldSession counts the real log', () => {
  const log = foldSample()

  it('keeps one leg per turn and stops at the newest seq', () => {
    expect(log.turns.map((turn) => turn.index)).toEqual([1, 2])
    expect(log.counts.turns).toBe(2)
    expect(log.throughSeq).toBe(24)
    expect(log.counts.rawEvents).toBe(sampleEvents.length)
    expect(log.endedAt).toBe(BASE + 14_000)
    expect(log.durationMs).toBe(14_000)
    expect(log.turns[0].durationMs).toBe(9_000)
  })

  it('totals steps, messages and tool traffic', () => {
    expect(log.counts.steps).toBe(2)
    expect(log.counts.userMessages).toBe(1)
    expect(log.counts.assistantMessages).toBe(2)
    expect(log.counts.toolCalls).toBe(4)
    expect(log.counts.toolErrors).toBe(1)
    expect(log.counts.approvals).toBe(1)
    expect(log.counts.retries).toBe(1)
    expect(log.counts.compactions).toBe(1)
  })

  it('sums usage only from what the log reported', () => {
    expect(log.tokens).toEqual({ input: 1210, output: 85, cacheRead: 600 })
    expect(log.turns[0].tokens.input).toBe(1200)
    expect(log.turns[1].tokens.cacheRead).toBe(0)
  })

  it('separates changed cargo from merely read cargo', () => {
    expect(log.counts.filesChanged).toBe(1)
    expect(log.counts.filesRead).toBe(1)
    expect(log.files.map((cargo) => [cargo.path, cargo.edits, cargo.writes, cargo.reads])).toEqual([
      ['E:/proj/demo/src/config.ts', 1, 0, 0],
      ['E:/proj/demo/README.md', 0, 0, 1],
    ])
  })

  it('aggregates tools by name with measured wall time', () => {
    const edit = log.tools.find((tool) => tool.name === 'edit')
    expect(edit).toMatchObject({ calls: 1, errors: 0, totalMs: 1_500 })
    expect(log.tools.find((tool) => tool.name === 'pwsh')).toMatchObject({ calls: 1, errors: 1, totalMs: 200 })
    expect(log.tools.find((tool) => tool.name === 'mystery_tool')).toMatchObject({ calls: 1, errors: 0, totalMs: 0 })
  })

  it('records every model that answered', () => {
    expect(log.models.map((model) => model.model)).toEqual(['deepseek-v4-pro', 'glm-5.3-flash'])
    expect(log.models[0].provider).toBe('deepseek')
  })
})

describe('foldSession rows', () => {
  it('pairs a tool call with the answer that carries its callId', () => {
    const call = rows(0).find((row) => row.name === 'edit')
    expect(call).toMatchObject({ cat: 'file', kind: 'file', op: 'edit', durationMs: 1_500, summary: '编辑 config.ts' })
    expect(call?.outcome).toBeUndefined()
  })

  it('marks a call that never got a result instead of dropping it', () => {
    const mystery = rows(0).find((row) => row.name === 'mystery_tool')
    expect(mystery).toMatchObject({ cat: 'tool', kind: 'tool', outcome: 'no-result', durationMs: 0, detail: '{"a":1}' })
  })

  it('carries the failure line off the errored result', () => {
    const pwsh = rows(0).find((row) => row.name === 'pwsh')
    expect(pwsh?.error).toBe('ToolError · TOOL_FAILED · remote rejected')
  })

  it('resolves an approval against the decision recorded later', () => {
    const approval = rows(0).find((row) => row.kind === 'approval')
    expect(approval).toMatchObject({ kind: 'approval', name: 'pwsh', outcome: 'allow-once' })
  })

  it('keeps reasoning as a character count, not the raw chain of thought', () => {
    const assistant = rows(0).find((row) => row.kind === 'assistant')
    expect(assistant?.detail).toBe('思考 120 字')
    expect(assistant?.text).toBe('我会写入配置。')
  })

  it('reads the title and the newest todo list', () => {
    const log = foldSample()
    expect(log.title).toBe('配置改造航程')
    expect(log.todos).toHaveLength(2)
    expect(log.todos[1]).toEqual({ content: '写测试', status: 'pending' })
  })

  it('falls back to the first prompt when no title event exists', () => {
    const log = foldSample(sampleEvents.filter((event) => event.type !== 'session/title'))
    expect(log.title).not.toBe('无名航程')
    expect(log.title.length).toBeLessThanOrEqual(200)
  })

  it('orders rows by log seq even when they arrive out of order', () => {
    const shuffled = [...sampleEvents].reverse()
    expect(foldSample(shuffled).turns[0].events.map((row) => row.seq)).toEqual([...rows(0).map((row) => row.seq)].sort((a, b) => a - b))
  })
})

describe('foldSession bounds the wire payload', () => {
  it('caps a leg and flags both the leg and the report', () => {
    const log = foldSample(sampleEvents, { redactSecrets: true, maxTurnEvents: 2 })
    expect(log.truncated).toBe(true)
    for (const turn of log.turns) {
      expect(turn.events.length).toBeLessThanOrEqual(2)
      expect(turn.capped).toBe(true)
    }
  })

  it('prefers key rows when a cap bites', () => {
    const log = foldSample(sampleEvents, { redactSecrets: true, maxTurnEvents: 2 })
    for (const turn of log.turns) expect(turn.events.every((row) => row.cat === 'key')).toBe(true)
  })

  it('leaves the cap flag alone when nothing overflows', () => {
    expect(foldSample().truncated).toBe(false)
    expect(foldSample().turns.every((turn) => turn.capped === false)).toBe(true)
  })

  it('never exceeds a field budget on the wire', () => {
    const long = foldSample([
      { type: 'turn/start', seq: 1, time: BASE, data: { turn: 1 } },
      { type: 'user/message', seq: 2, time: BASE, data: { content: [{ type: 'text', text: 'x'.repeat(50_000) }] } },
      {
        type: 'tool/call', seq: 3, time: BASE,
        data: { callId: 'x', name: 'grep', arguments: JSON.stringify({ pattern: 'y'.repeat(9_000), path: 'z'.repeat(9_000) }) },
      },
      { type: 'turn/end', seq: 4, time: BASE, data: { reason: { kind: 'completed' } } },
    ])
    for (const turn of long.turns) {
      for (const row of turn.events) {
        expect(row.text === undefined || row.text.length <= 1200).toBe(true)
        expect(row.summary === undefined || row.summary.length <= 300).toBe(true)
        expect(row.detail === undefined || row.detail.length <= 300).toBe(true)
        expect(row.path === undefined || row.path.length <= 400).toBe(true)
      }
      expect(turn.prompt.length).toBeLessThanOrEqual(1200)
    }
    expect(long.turns[0].events.some((row) => row.text?.endsWith('…'))).toBe(true)
  })
})

describe('foldSession redacts before the wire', () => {
  it('masks a relay key and reports what it touched', () => {
    const log = foldSample()
    expect(log.turns[0].prompt).toContain(MASK)
    expect(log.turns[0].prompt).not.toContain(RELAY_KEY)
    expect(log.redaction.enabled).toBe(true)
    expect(log.redaction.count).toBeGreaterThan(0)
    expect(log.redaction.kinds).toContain('provider-key')
  })

  it('masks credentials embedded in a tool command detail', () => {
    const pwsh = rows(0).find((row) => row.name === 'pwsh')
    expect(pwsh?.detail).not.toContain('Sup3rS3cretPasswd')
    expect(pwsh?.detail).toContain(MASK)
  })

  it('passes text through untouched when redaction is off', () => {
    const log = foldSample(sampleEvents, { redactSecrets: false, maxTurnEvents: 240 })
    expect(log.turns[0].prompt).toContain(RELAY_KEY)
    expect(log.redaction).toEqual({ count: 0, kinds: [], enabled: false })
  })

  it('still honours the budget while redacting', () => {
    const log = foldSample([{ type: 'user/message', seq: 1, time: BASE, data: { content: [{ type: 'text', text: `${'a'.repeat(3_000)}${RELAY_KEY}` }] } }])
    expect(log.turns[0].prompt.length).toBeLessThanOrEqual(1200)
    expect(log.turns[0].prompt).not.toContain(RELAY_KEY)
  })
})

describe('foldSession survives an empty and a hostile log', () => {
  it('folds a header with no events', () => {
    const log = foldSample([])
    expect(log.counts.turns).toBe(0)
    expect(log.turns).toEqual([])
    expect(log.tokens).toEqual({ input: 0, output: 0, cacheRead: 0 })
    expect(log.title).toBe('无名航程')
    expect(VoyageLogSchema.safeParse(log).success).toBe(true)
  })

  it('folds events whose data is missing or wrongly shaped', () => {
    const log = foldSample([
      { type: 'tool/call', seq: 1, time: BASE, data: { name: 'edit' } },
      { type: 'assistant/message', seq: 2, time: BASE + 1, data: { message: { content: 'not a list' } } },
      { type: 'tool/result', seq: 3, time: BASE + 2, data: null },
      { type: 'todo/write', seq: 4, time: BASE + 3, data: { todos: [{ content: 1, status: null }] } },
      { type: 'unknown/event', seq: 5, time: BASE + 4, data: { whatever: true } },
    ])
    expect(VoyageLogSchema.safeParse(log).success).toBe(true)
    expect(log.counts.toolCalls).toBe(1)
    expect(log.turns[0].events.some((row) => row.summary === '编辑 未知文件')).toBe(true)
  })

  it('produces a payload the strict wire schema accepts', () => {
    expect(VoyageLogSchema.safeParse(foldSample()).data?.sessionId).toBe(sampleHeader.id)
  })

  it('never emits a negative duration or token count', () => {
    const log = foldSample([
      { type: 'tool/call', seq: 9, time: BASE + 5_000, data: { callId: 'c', name: 'read', arguments: '{}' } },
      { type: 'tool/result', seq: 8, time: BASE, data: { message: { source: { callId: 'c' }, content: [] } } },
      { type: 'turn/end', seq: 10, time: BASE - 10_000, data: { reason: { kind: 'completed' } } },
    ])
    expect(VoyageLogSchema.safeParse(log).success).toBe(true)
    expect(log.durationMs).toBeGreaterThanOrEqual(0)
    expect(log.turns[0].events[0].durationMs).toBe(0)
  })
})

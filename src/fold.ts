/**
 * dsh-voyage-log — The fold.
 *
 * Turns one raw DSH session log into a VoyageLog: legs per turn, rows per
 * meaningful event, and the aggregate readings the view and the exported report
 * draw. Pure and dependency-free — it takes plain objects, never the harness
 * types, so it is unit-testable against captured real events.
 *
 * Only completed, first-class events become rows; streaming chunks, request
 * headers and other bookkeeping are counted but never invented into content.
 */
import { Redactor } from './redact.ts'
import type { VoyageEvent, VoyageFile, VoyageLog, VoyageModel, VoyageTodo, VoyageTool, VoyageTurn } from './schema.ts'

/** The shape of a raw log line as it arrives from `sessionQuery.readSession`. */
export interface RawEvent {
  readonly type: string
  readonly seq?: number
  readonly time?: number
  readonly data?: unknown
}

/** The session header line. */
export interface RawHeader {
  readonly id: string
  readonly createdAt: number
  readonly cwd?: string
  readonly agentPreset?: string
}

/** Fold knobs resolved from the plugin Config. */
export interface FoldOptions {
  readonly redactSecrets: boolean
  readonly maxTurnEvents: number
}

/** Character budgets kept per field; every cap runs before redaction. */
const LIMIT = {
  prompt: 1200,
  message: 1200,
  summary: 300,
  detail: 300,
  error: 300,
  reason: 300,
  path: 400,
  todo: 300,
  title: 200,
  name: 60,
  provider: 40,
  model: 80,
  outcome: 40,
  status: 24,
} as const

/** Aggregate rows kept in the report. */
const TOP_TOOLS = 16
const TOP_FILES = 24

/** Mutable accumulator shape for the wire `TokenUsage`. */
interface MutableTokens {
  input: number
  output: number
  cacheRead: number
}

const ZERO_TOKENS = (): MutableTokens => ({ input: 0, output: 0, cacheRead: 0 })

function dict(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

/** Trim to an exact length budget, counting the ellipsis inside it. */
function hard(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`
}

/** Concatenate the `text` blocks of a message content array. */
function textOf(content: readonly unknown[]): string {
  const parts: string[] = []
  for (const block of content) {
    const record = dict(block)
    if (record.type === 'text' && typeof record.text === 'string') parts.push(record.text)
  }
  return parts.join('\n').trim()
}

/** Total characters of reasoning blocks in one assistant message. */
function reasoningChars(content: readonly unknown[]): number {
  let total = 0
  for (const block of content) {
    const record = dict(block)
    if (record.type === 'reasoning' && typeof record.text === 'string') total += record.text.length
  }
  return total
}

/** Pull the printable body and error flag out of a `tool/result` payload. */
function resultText(data: Record<string, unknown>): { text: string; isError: boolean } {
  const blocks = list(dict(data.message).content)
  const parts: string[] = []
  let isError = false
  for (const block of blocks) {
    const record = dict(block)
    for (const inner of list(record.content)) {
      const item = dict(inner)
      if (typeof item.text === 'string') parts.push(item.text)
    }
    if (record.isError === true) isError = true
  }
  return { text: parts.join('\n').trim(), isError }
}

/** Parse a tool call's `arguments` JSON defensively. */
function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined || raw === '') return {}
  try {
    return dict(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

/** Last path segment, for a readable row without exposing a whole tree. */
function base(path: string): string {
  const parts = path.split(/[\\/]/).filter((part) => part !== '')
  return parts.length === 0 ? path : parts[parts.length - 1]
}

/** Collapse whitespace runs so a one-line readout stays on one line. */
function inline(value: string, limit: number): string {
  return hard(value.replace(/\s+/g, ' ').trim(), limit)
}

/** What a tool call contributes to the timeline row. */
interface RowShape {
  readonly summary: string
  readonly detail?: string
  readonly path?: string
  readonly op?: 'edit' | 'write' | 'read'
}

/**
 * One honest line per tool, from the argument shapes the shipped tools actually
 * emit. Unknown tools degrade to a raw argument preview instead of vanishing.
 */
function describeCall(name: string, args: Record<string, unknown>, rawArgs: string | undefined): RowShape {
  const filePath = str(args.file_path)
  const fileLabel = filePath === undefined ? '未知文件' : base(filePath)
  switch (name) {
    case 'edit': {
      const oldText = str(args.old_string) ?? ''
      const newText = str(args.new_string) ?? ''
      return {
        path: filePath ?? '',
        op: 'edit',
        summary: `编辑 ${fileLabel}`,
        detail: `${oldText.length} → ${newText.length} 字${args.replace_all === true ? ' · 全部替换' : ''}`,
      }
    }
    case 'write': {
      const content = str(args.content) ?? ''
      return {
        path: filePath ?? '',
        op: 'write',
        summary: `写入 ${fileLabel}`,
        detail: content === '' ? '空内容' : `${content.split('\n').length} 行 · ${content.length} 字`,
      }
    }
    case 'read': {
      const offset = num(args.offset)
      const limit = num(args.limit)
      return {
        path: filePath ?? '',
        op: 'read',
        summary: `读取 ${fileLabel}`,
        detail: offset === undefined && limit === undefined ? undefined : `起 ${offset ?? 0} · 长 ${limit ?? '全部'}`,
      }
    }
    case 'read_image':
      return { path: filePath ?? '', op: 'read', summary: `读取图片 ${fileLabel}` }
    case 'grep':
      return {
        summary: `搜索 ${inline(str(args.pattern) ?? '', 120)}`,
        detail: inline([str(args.path), str(args.include)].filter((v) => v !== undefined).join(' · '), 200),
      }
    case 'glob':
      return { summary: `匹配文件 ${inline(str(args.pattern) ?? '', 120)}`, detail: str(args.path) === undefined ? undefined : inline(str(args.path) ?? '', 200) }
    case 'pwsh': {
      const command = str(args.command) ?? ''
      const description = str(args.description)
      return {
        summary: `执行 ${description === undefined ? inline(command.split('\n')[0] ?? '', 120) : inline(description, 120)}`,
        detail: inline(command, 240),
      }
    }
    case 'web_search':
      return { summary: `联网搜索 ${inline(str(args.query) ?? '', 160)}` }
    case 'subagent':
      return { summary: `派出子代理 ${inline(str(args.description) ?? '', 120)}`, detail: inline(str(args.prompt) ?? '', 240) }
    case 'todo_write':
      return { summary: '更新任务清单', detail: `${list(args.todos).length} 项` }
    case 'ask_user_question':
      return { summary: '向用户提问', detail: `${list(args.questions).length} 个问题` }
    case 'job_output':
      return { summary: `取回任务输出 ${inline(str(args.job_id) ?? '', 60)}` }
    case 'job_kill':
      return { summary: `终止任务 ${inline(str(args.job_id) ?? '', 60)}` }
    case 'job_list':
      return { summary: '列出后台任务' }
    case 'list_agents':
      return { summary: '列出代理' }
    case 'interrupt_agent':
      return { summary: '打断代理' }
    case 'create_goal':
      return { summary: '创建目标' }
    case 'update_goal':
      return { summary: '更新目标' }
    case 'get_goal':
      return { summary: '读取目标' }
    default:
      return { summary: inline(name, 120), detail: inline(rawArgs ?? '', 240) }
  }
}

/** One turn under construction. */
interface TurnAccumulator {
  index: number
  startedAt: number
  endedAt?: number
  reason?: 'completed' | 'error' | 'aborted'
  error?: string
  steps: number
  toolCalls: number
  changed: Set<string>
  tokens: MutableTokens
  rows: VoyageEvent[]
  prompt: string
}

function openTurn(index: number, at: number): TurnAccumulator {
  return { index, startedAt: at, steps: 0, toolCalls: 0, changed: new Set(), tokens: ZERO_TOKENS(), rows: [], prompt: '' }
}

/**
 * Fold one session log.
 * @param header - the session header line.
 * @param events - the raw log events.
 * @param options - redaction and cap knobs from the plugin Config.
 * @returns the wire-ready voyage report.
 */
export function foldSession(header: RawHeader, events: readonly RawEvent[], options: FoldOptions): VoyageLog {
  const redactor = new Redactor(options.redactSecrets)
  /** Redact, then re-clamp: the mask can only ever shift a tail, never reveal it. */
  const clip = (value: string | undefined, limit: number): string | undefined => (value === undefined ? undefined : redactor.clip(value, limit))
  const clipOr = (value: string | undefined, limit: number): string => clip(value, limit) ?? ''

  const ordered = [...events].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))

  // Index the events that answer an earlier one, so the main pass can pair them.
  const results = new Map<string, { time: number; text: string; isError: boolean; error?: { name?: string; code?: string } }>()
  const decisions = new Map<string, string>()
  const compactionEnds = new Map<string, string | undefined>()
  for (const event of ordered) {
    if (event.type === 'tool/result') {
      const data = dict(event.data)
      const callId = str(dict(dict(data.message).source).callId)
      if (callId !== undefined) {
        const body = resultText(data)
        const error = dict(data.error)
        results.set(callId, {
          time: event.time ?? header.createdAt,
          text: body.text,
          isError: body.isError,
          error: Object.keys(error).length === 0 ? undefined : { name: str(error.name), code: str(error.code) },
        })
      }
    } else if (event.type === 'approval/decided') {
      const data = dict(event.data)
      const id = str(data.id)
      if (id !== undefined) decisions.set(id, str(data.outcome) ?? 'unknown')
    } else if (event.type === 'compaction/end') {
      const data = dict(event.data)
      const id = str(data.compactionId)
      if (id !== undefined) compactionEnds.set(id, str(data.error))
    }
  }

  const toolStats = new Map<string, { calls: number; errors: number; totalMs: number }>()
  const fileStats = new Map<string, { edits: number; writes: number; reads: number; lastTurn: number }>()
  const modelStats = new Map<string, { provider: string; model: string; messages: number }>()
  const turns: VoyageTurn[] = []
  const counts = {
    turns: 0, steps: 0, assistantMessages: 0, userMessages: 0, toolCalls: 0, toolErrors: 0,
    filesChanged: 0, filesRead: 0, approvals: 0, retries: 0, compactions: 0, rawEvents: ordered.length,
  }
  const totals = ZERO_TOKENS()

  let current: TurnAccumulator | undefined
  let title = ''
  let todos: VoyageTodo[] = []
  let lastTime = header.createdAt
  let throughSeq = 0
  let truncated = false

  /** Close the open leg, honouring the per-leg row budget. */
  function flush(turn: TurnAccumulator | undefined): void {
    if (turn === undefined) return
    const endedAt = turn.endedAt ?? turn.startedAt
    let rows = turn.rows
    let capped = false
    if (rows.length > options.maxTurnEvents) {
      const keys = rows.filter((row) => row.cat === 'key')
      const others = rows.filter((row) => row.cat !== 'key')
      const keptKeys = keys.slice(0, options.maxTurnEvents)
      const budget = Math.max(0, options.maxTurnEvents - keptKeys.length)
      rows = [...keptKeys, ...others.slice(0, budget)].sort((a, b) => a.seq - b.seq)
      capped = true
      truncated = true
    }
    turns.push({
      index: turn.index,
      startedAt: turn.startedAt,
      endedAt: turn.endedAt,
      durationMs: Math.max(0, endedAt - turn.startedAt),
      reason: turn.reason ?? 'open',
      error: turn.error,
      prompt: turn.prompt,
      steps: turn.steps,
      toolCalls: turn.toolCalls,
      filesChanged: turn.changed.size,
      tokens: turn.tokens,
      events: rows,
      capped,
    })
    counts.turns += 1
  }

  /** Rows land on the open leg, which is created on the first event that needs one. */
  function leg(at: number): TurnAccumulator {
    if (current === undefined) {
      current = openTurn(turns.length + 1, at)
    }
    return current
  }

  function addRow(row: VoyageEvent): void {
    leg(row.time).rows.push(row)
  }

  for (const event of ordered) {
    const at = event.time ?? lastTime
    if (at > lastTime) lastTime = at
    if ((event.seq ?? 0) > throughSeq) throughSeq = event.seq ?? 0
    const data = dict(event.data)

    switch (event.type) {
      case 'turn/start': {
        flush(current)
        current = openTurn(num(data.turn) ?? turns.length + 1, at)
        break
      }
      case 'step/start': {
        leg(at).steps += 1
        counts.steps += 1
        break
      }
      case 'user/message': {
        const turn = leg(at)
        const body = clipOr(textOf(list(data.content)), LIMIT.prompt)
        counts.userMessages += 1
        if (turn.prompt === '') turn.prompt = body
        addRow({ cat: 'key', kind: 'user', seq: event.seq ?? 0, time: at, text: body })
        break
      }
      case 'assistant/message': {
        const turn = leg(at)
        const message = dict(data.message)
        const content = list(message.content)
        const usage = dict(data.usage)
        const input = Math.max(0, Math.trunc(num(usage.inputTokens) ?? 0))
        const output = Math.max(0, Math.trunc(num(usage.outputTokens) ?? 0))
        const cacheRead = Math.max(0, Math.trunc(num(usage.cacheReadTokens) ?? 0))
        counts.assistantMessages += 1
        turn.tokens.input += input
        turn.tokens.output += output
        turn.tokens.cacheRead += cacheRead
        totals.input += input
        totals.output += output
        totals.cacheRead += cacheRead
        const source = dict(message.source)
        if (source.kind === 'model') {
          const model = hard(str(source.model) ?? '未知模型', LIMIT.model)
          const provider = hard(str(source.provider) ?? '未知来源', LIMIT.provider)
          const seen = modelStats.get(model)
          if (seen === undefined) modelStats.set(model, { provider, model, messages: 1 })
          else seen.messages += 1
        }
        const body = clipOr(textOf(content), LIMIT.message)
        const thought = reasoningChars(content)
        if (body !== '') {
          addRow({
            cat: 'key', kind: 'assistant', seq: event.seq ?? 0, time: at, text: body,
            detail: thought > 0 ? `思考 ${thought.toLocaleString('en-US')} 字` : undefined,
          })
        }
        break
      }
      case 'tool/call': {
        const turn = leg(at)
        const name = clipOr(str(data.name) ?? '未知工具', LIMIT.name)
        const callId = str(data.callId) ?? ''
        const rawArgs = str(data.arguments)
        const shape = describeCall(str(data.name) ?? '未知工具', parseArgs(rawArgs), rawArgs)
        const answered = results.get(callId)
        const failed = answered !== undefined && (answered.isError || answered.error !== undefined)
        const durationMs = answered === undefined ? 0 : Math.max(0, Math.trunc(answered.time - at))

        counts.toolCalls += 1
        turn.toolCalls += 1
        const stat = toolStats.get(name) ?? { calls: 0, errors: 0, totalMs: 0 }
        stat.calls += 1
        stat.totalMs += durationMs
        if (failed) {
          stat.errors += 1
          counts.toolErrors += 1
        }
        toolStats.set(name, stat)

        let safePath: string | undefined
        if (shape.path !== undefined && shape.path !== '') {
          safePath = clipOr(shape.path, LIMIT.path)
          const cargo = fileStats.get(safePath) ?? { edits: 0, writes: 0, reads: 0, lastTurn: turn.index }
          if (shape.op === 'edit') cargo.edits += 1
          else if (shape.op === 'write') cargo.writes += 1
          else cargo.reads += 1
          cargo.lastTurn = turn.index
          fileStats.set(safePath, cargo)
          if (shape.op !== 'read') turn.changed.add(safePath)
        }

        const errorLine = failed
          ? clipOr(
              answered?.error === undefined
                ? answered?.text ?? ''
                : [answered.error.name, answered.error.code, answered.text].filter((v) => v !== undefined && v !== '').join(' · '),
              LIMIT.error,
            )
          : ''

        addRow({
          cat: shape.op === undefined ? 'tool' : 'file',
          kind: shape.op === undefined ? 'tool' : 'file',
          seq: event.seq ?? 0,
          time: at,
          name,
          path: shape.op === undefined ? undefined : safePath,
          op: shape.op,
          summary: clipOr(shape.summary, LIMIT.summary),
          detail: shape.detail === undefined ? undefined : clipOr(shape.detail, LIMIT.detail),
          durationMs,
          error: errorLine === '' ? undefined : errorLine,
          outcome: answered === undefined ? 'no-result' : undefined,
        })
        break
      }
      case 'approval/asked': {
        const asked = str(data.id)
        const tool = clipOr(str(data.toolName), LIMIT.name)
        counts.approvals += 1
        addRow({
          cat: 'key', kind: 'approval', seq: event.seq ?? 0, time: at,
          name: tool,
          summary: clipOr(tool === undefined || tool === '' ? '请求批准' : `请求批准 ${tool}`, LIMIT.summary),
          reason: clipOr(str(data.reason), LIMIT.reason),
          outcome: asked === undefined ? undefined : hard(decisions.get(asked) ?? 'unknown', LIMIT.outcome),
        })
        break
      }
      case 'llm/retry': {
        const failure = dict(data.failure)
        counts.retries += 1
        const attempt = num(data.retry) === undefined && num(data.maxRetries) === undefined
          ? undefined
          : `第 ${num(data.retry) ?? 0}/${num(data.maxRetries) ?? 0} 次`
        addRow({
          cat: 'key', kind: 'retry', seq: event.seq ?? 0, time: at,
          summary: '模型重试',
          provider: clipOr(str(data.provider), LIMIT.provider),
          reason: clipOr(str(failure.code), LIMIT.name),
          detail: clipOr([str(failure.message), attempt].filter((part) => part !== undefined && part !== '').join(' · '), LIMIT.detail),
        })
        break
      }
      case 'compaction/start': {
        const id = str(data.compactionId)
        const failure = id === undefined ? undefined : compactionEnds.get(id)
        counts.compactions += 1
        addRow({
          cat: 'key', kind: 'compaction', seq: event.seq ?? 0, time: at,
          summary: failure === undefined ? '上下文压缩完成' : '上下文压缩失败',
          error: failure === undefined ? undefined : clipOr(failure, LIMIT.error),
        })
        break
      }
      case 'turn/end': {
        const turn = leg(at)
        const reason = dict(data.reason)
        const kind = str(reason.kind)
        turn.endedAt = at
        if (kind === 'completed' || kind === 'error' || kind === 'aborted') turn.reason = kind
        if (kind === 'error') turn.error = clipOr(str(dict(reason.error).message), LIMIT.error)
        addRow({ cat: 'key', kind: 'turn-end', seq: event.seq ?? 0, time: at, reason: hard(kind ?? 'unknown', LIMIT.name), error: turn.error })
        flush(current)
        current = undefined
        break
      }
      case 'todo/write': {
        const items = list(data.todos).map((item): VoyageTodo => {
          const todo = dict(item)
          return { content: clipOr(str(todo.content), LIMIT.todo), status: hard(str(todo.status) ?? 'pending', LIMIT.status) }
        })
        if (items.length > 0) todos = items
        break
      }
      case 'session/title': {
        const next = str(data.title)
        if (next !== undefined && next !== '') title = clipOr(next, LIMIT.title)
        break
      }
      default:
        break
    }
  }
  flush(current)

  counts.filesChanged = [...fileStats.values()].filter((cargo) => cargo.edits + cargo.writes > 0).length
  counts.filesRead = [...fileStats.values()].filter((cargo) => cargo.reads > 0).length

  const firstPrompt = turns.find((turn) => turn.prompt !== '')?.prompt ?? ''
  const resolvedTitle = title !== '' ? title : hard(inline(firstPrompt, LIMIT.title), LIMIT.title) || '未命名会话'

  const files: VoyageFile[] = [...fileStats.entries()]
    .map(([path, cargo]) => ({ path, edits: cargo.edits, writes: cargo.writes, reads: cargo.reads, lastTurn: cargo.lastTurn }))
    .sort((a, b) => b.edits + b.writes - (a.edits + a.writes) || b.reads - a.reads || a.path.localeCompare(b.path))
    .slice(0, TOP_FILES)

  const tools: VoyageTool[] = [...toolStats.entries()]
    .map(([name, stat]) => ({ name, calls: stat.calls, errors: stat.errors, totalMs: Math.trunc(stat.totalMs) }))
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    .slice(0, TOP_TOOLS)

  const models: VoyageModel[] = [...modelStats.values()].sort((a, b) => b.messages - a.messages || a.model.localeCompare(b.model))

  return {
    sessionId: hard(header.id, 200),
    title: resolvedTitle,
    cwd: clipOr(header.cwd, LIMIT.path),
    agentPreset: hard(header.agentPreset ?? 'standard', LIMIT.name),
    startedAt: header.createdAt,
    endedAt: lastTime,
    durationMs: Math.max(0, lastTime - header.createdAt),
    generatedAt: Date.now(),
    throughSeq,
    counts,
    tokens: totals,
    models,
    tools,
    files,
    turns,
    todos,
    redaction: redactor.summary(),
    truncated,
  }
}

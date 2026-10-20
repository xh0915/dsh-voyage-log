/**
 * dsh-voyage-log — Report builders (pure string output, no DOM).
 *
 * Both builders take the fold plus the active translator, so an exported report
 * reads in the same language the view used. Everything interpolated into HTML is
 * escaped: the payload carries user prompts and tool arguments verbatim.
 */
import type { VoyageEvent, VoyageLog, VoyageTurn } from '../schema.ts'
import type { Translate } from './locales.ts'

/** Export knobs mirrored from the view's own filters. */
export interface ReportOptions {
  readonly version: 'full' | 'brief'
  readonly includeTools: boolean
  readonly includeFiles: boolean
  readonly redactNote: boolean
}

/** Human-readable duration off a millisecond span. */
export function span(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return `${minutes} min ${rest} s`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

/** Thousands-grouped integer. */
export function group(value: number): string {
  return value.toLocaleString('en-US')
}

/** Wall clock + date for a fold timestamp. */
export function clock(value: number): string {
  const date = new Date(value)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/** Escape a value for HTML text and attribute contexts. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Apply the export filters to one leg's rows. */
function filterRows(rows: readonly VoyageEvent[], options: ReportOptions): VoyageEvent[] {
  return rows.filter((row) => {
    if (options.version === 'brief' && row.cat !== 'key') return false
    if (row.cat === 'tool' && !options.includeTools) return false
    if (row.cat === 'file' && !options.includeFiles) return false
    return true
  })
}

/** The legs worth printing under the chosen detail level. */
function filterTurns(log: VoyageLog, options: ReportOptions): VoyageTurn[] {
  return log.turns
    .map((turn) => ({ ...turn, events: filterRows(turn.events, options) }))
    .filter((turn) => turn.events.length > 0 || turn.prompt !== '')
}

/** One-row class used by both the view and the exported stylesheet. */
function rowClass(row: VoyageEvent): string {
  return `vr vr-${row.kind}`
}

/** The one-line readout a row shows, honouring every optional field. */
function rowReadout(row: VoyageEvent, t: Translate): string {
  const parts: string[] = []
  if (row.kind === 'tool' || row.kind === 'file') {
    if (row.name !== undefined) parts.push(row.name)
    if (row.path !== undefined) parts.push(row.path)
    if (row.durationMs !== undefined) parts.push(t('row.duration', { ms: String(row.durationMs) }))
    if (row.outcome === 'no-result') parts.push(t('row.noResult'))
  } else if (row.kind === 'approval') {
    if (row.reason !== undefined && row.reason !== '') parts.push(row.reason)
    if (row.outcome !== undefined) parts.push(t('row.outcome', { outcome: row.outcome }))
  } else if (row.kind === 'retry') {
    if (row.provider !== undefined) parts.push(row.provider)
    if (row.reason !== undefined && row.reason !== '') parts.push(t('row.reason', { code: row.reason }))
  } else if (row.kind === 'turn-end') {
    if (row.reason !== undefined) parts.push(row.reason)
  }
  return parts.filter((part) => part !== '').join(' · ')
}

/**
 * The Markdown digest used by "copy summary" and by the report's own summary.
 * @param log - the folded voyage.
 * @param t - the active translator.
 * @param options - the same knobs the export modal exposes.
 * @returns a paste-ready Markdown log.
 */
export function buildMarkdown(log: VoyageLog, t: Translate, options: ReportOptions = { version: 'full', includeTools: true, includeFiles: true, redactNote: true }): string {
  const lines: string[] = []
  lines.push(`# ${t('export.reportTitle', { title: log.title })}`)
  lines.push('')
  lines.push(`- ${t('meta.cwd')}: \`${log.cwd}\``)
  lines.push(`- ${t('meta.preset')}: ${log.agentPreset}`)
  lines.push(`- ${t('meta.startedAt')}: ${clock(log.startedAt)}`)
  lines.push(`- ${t('metric.duration')}: ${span(log.durationMs)}`)
  lines.push(`- ${t('metric.turns')}: ${log.counts.turns} · ${t('metric.steps')}: ${log.counts.steps} · ${t('metric.toolCalls')}: ${log.counts.toolCalls} · ${t('metric.toolErrors')}: ${log.counts.toolErrors}`)
  lines.push(`- ${t('metric.filesChanged')}: ${log.counts.filesChanged} · ${t('metric.filesRead')}: ${log.counts.filesRead} · ${t('metric.rawEvents')}: ${log.counts.rawEvents}`)
  lines.push(`- ${t('meta.tokens')}: ${t('metric.tokenIn')} ${group(log.tokens.input)} · ${t('metric.tokenOut')} ${group(log.tokens.output)} · ${t('metric.cacheRead')} ${group(log.tokens.cacheRead)}`)
  if (log.models.length > 0) {
    lines.push(`- ${t('meta.models')}: ${log.models.map((model) => `${model.model}×${model.messages}`).join(', ')}`)
  }
  if (log.redaction.enabled && log.redaction.count > 0) {
    lines.push(`- ${t('note.redacted', { count: String(log.redaction.count) })}`)
  }
  lines.push('')
  lines.push(t('section.timeline'))
  lines.push('')
  for (const turn of filterTurns(log, options)) {
    lines.push(`## ${t('turn.leg', { index: String(turn.index) })} · ${span(turn.durationMs)} · ${turn.reason ?? 'open'}`)
    const meta = [t('turn.steps', { count: String(turn.steps) }), t('turn.tools', { count: String(turn.toolCalls) }), t('turn.files', { count: String(turn.filesChanged) })]
    lines.push(meta.join(' / '))
    for (const row of turn.events) {
      const readout = rowReadout(row, t)
      const body = row.text ?? row.summary ?? readout
      const extra = [readout === '' || readout === body ? '' : readout, row.detail ?? ''].filter((part) => part !== '').join(' · ')
      lines.push(`- \`${clock(row.time)}\` [${t(`row.${row.kind}`)}] ${body}${extra === '' ? '' : ` — ${extra}`}${row.error === undefined ? '' : ` ⚠ ${row.error}`}`)
    }
    if (turn.capped) lines.push(`> ${t('turn.capped')}`)
    lines.push('')
  }
  if (log.todos.length > 0) {
    lines.push(t('section.todos'))
    for (const todo of log.todos) lines.push(`- [${todo.status === 'completed' ? 'x' : ' '}] ${todo.content} (${todo.status})`)
    lines.push('')
  }
  lines.push(`> ${t('note.local')} ${t('note.cost')}`)
  return lines.join('\n')
}

const WHALE_MARK = '<svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true" focusable="false"><path d="M6 30c6 0 10-3 14-7 3-3 6-5 10-5 5 0 8 3 8 7 0 5-4 8-9 8-2 0-4-1-5-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6 30c-1-6 2-12 7-15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M13 15c4 1 7 4 8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>'

/** The report stylesheet: bright blue-white in light, ice-navy in dark, print-safe. */
const REPORT_CSS = `
:root{color-scheme:light dark;--bg:#f3f8fe;--bg-deep:#eaf2fc;--surface:#fff;--line:#e4eef9;--ink:#0b2347;--ink-2:#334f75;--ink-3:#607a9d;--blue:#3d5af1;--blue-soft:#eaf1ff;--green:#0b8a68;--amber:#a96c17;--rose:#b05a64}
@media (prefers-color-scheme:dark){:root{--bg:#0c1a2c;--bg-deep:#0a1626;--surface:#12233a;--line:#1e3a5c;--ink:#e9f2fd;--ink-2:#b6cee8;--ink-3:#89a8cb;--blue:#7f9cff;--blue-soft:#16294a;--green:#5fd3ad;--amber:#e3b46b;--rose:#f0a3ac}}
*{box-sizing:border-box}
body{margin:0;padding:32px 20px 48px;background:linear-gradient(180deg,var(--bg-deep),var(--bg));color:var(--ink);font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.page{max-width:920px;margin:0 auto}
.head{display:flex;gap:14px;align-items:flex-start;padding:22px 24px;background:var(--surface);border:1px solid var(--line);border-radius:16px}
.mark{color:var(--blue);flex:none;margin-top:2px}
.head h1{margin:0 0 4px;font-size:20px;letter-spacing:.2px}
.head .sub{margin:0;color:var(--ink-3);font-size:12px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.chip{padding:2px 9px;border-radius:999px;background:var(--blue-soft);color:var(--blue);font-size:12px}
.chip.warn{background:rgba(169,108,23,.12);color:var(--amber)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:10px;margin:16px 0}
.cell{padding:12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:12px}
.cell b{display:block;font-size:19px;font-variant-numeric:tabular-nums}
.cell span{color:var(--ink-3);font-size:11.5px}
h2{margin:26px 0 10px;font-size:15px;color:var(--ink-2)}
.leg{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:12px}
.leg h3{margin:0 0 2px;font-size:14px}
.leg .meta{margin:0 0 10px;color:var(--ink-3);font-size:12px}
.row{display:flex;gap:10px;padding:7px 0;border-top:1px dashed var(--line);align-items:baseline}
.row:first-of-type{border-top:0}
.time{flex:none;color:var(--ink-3);font-size:11px;font-variant-numeric:tabular-nums;width:96px}
.tag{flex:none;font-size:11px;padding:1px 7px;border-radius:999px;background:var(--blue-soft);color:var(--blue)}
.row-tool .tag,.row-file .tag{background:rgba(13,143,174,.12);color:#0d8fae}
.row-error .tag,.row-retry .tag{background:rgba(176,90,100,.14);color:var(--rose)}
.body{min-width:0;flex:1}
.body .main{white-space:pre-wrap;word-break:break-word}
.body .sub{color:var(--ink-3);font-size:12px;word-break:break-all}
.body .err{color:var(--rose);font-size:12px}
.note{margin:8px 0 0;font-size:12px;color:var(--amber)}
.list{list-style:none;margin:0;padding:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.list li{display:flex;justify-content:space-between;gap:12px;padding:9px 14px;border-top:1px solid var(--line);font-size:12.5px}
.list li:first-child{border-top:0}
.list .p{word-break:break-all}
.list .n{flex:none;color:var(--ink-3);font-variant-numeric:tabular-nums}
.foot{margin-top:24px;padding-top:14px;border-top:1px solid var(--line);color:var(--ink-3);font-size:11.5px}
@media print{body{background:#fff;padding:0}.leg,.cell,.head,.list{break-inside:avoid;border-color:#d8e4f2}}
`

/** One timeline row of the report. */
function reportRow(row: VoyageEvent, t: Translate): string {
  const readout = rowReadout(row, t)
  const main = row.text ?? row.summary ?? readout
  const sub = readout === '' || main === readout ? '' : readout
  const detail = row.detail === undefined || row.detail === main ? '' : row.detail
  const cls = row.error === undefined ? rowClass(row) : `${rowClass(row)} row-error`
  return `<div class="${cls}"><span class="time">${esc(clock(row.time))}</span>`
    + `<span class="tag">${esc(t(`row.${row.kind}`))}</span>`
    + `<span class="body"><span class="main">${esc(main)}</span>`
    + (sub === '' ? '' : `<span class="sub"> — ${esc(sub)}</span>`)
    + (detail === '' ? '' : `<span class="sub">${esc(detail)}</span>`)
    + (row.error === undefined ? '' : `<span class="err">⚠ ${esc(row.error)}</span>`)
    + '</span></div>'
}

/**
 * The self-contained report document.
 * @param log - the folded voyage.
 * @param t - the active translator.
 * @param options - detail knobs from the export modal.
 * @returns a single HTML file, inlined stylesheet, no external assets.
 */
export function buildReportHtml(log: VoyageLog, t: Translate, options: ReportOptions): string {
  const turns = filterTurns(log, options)
  const readings: Array<[string, string]> = [
    [t('metric.turns'), String(log.counts.turns)],
    [t('metric.steps'), String(log.counts.steps)],
    [t('metric.toolCalls'), String(log.counts.toolCalls)],
    [t('metric.toolErrors'), String(log.counts.toolErrors)],
    [t('metric.filesChanged'), String(log.counts.filesChanged)],
    [t('metric.filesRead'), String(log.counts.filesRead)],
    [t('metric.duration'), span(log.durationMs)],
    [t('metric.rawEvents'), group(log.counts.rawEvents)],
    [t('metric.tokenIn'), group(log.tokens.input)],
    [t('metric.tokenOut'), group(log.tokens.output)],
    [t('metric.cacheRead'), group(log.tokens.cacheRead)],
  ]

  const chips: string[] = [
    `<span class="chip">${esc(log.agentPreset)}</span>`,
    `<span class="chip">${esc(t('hero.throughSeq', { seq: String(log.throughSeq) }))}</span>`,
  ]
  if (log.counts.approvals > 0) chips.push(`<span class="chip">${esc(t('metric.approvals'))} ${log.counts.approvals}</span>`)
  if (log.counts.retries > 0) chips.push(`<span class="chip warn">${esc(t('metric.retries'))} ${log.counts.retries}</span>`)
  if (log.counts.compactions > 0) chips.push(`<span class="chip">${esc(t('metric.compactions'))} ${log.counts.compactions}</span>`)
  if (log.redaction.enabled && log.redaction.count > 0) chips.push(`<span class="chip">${esc(t('note.redacted', { count: String(log.redaction.count) }))}</span>`)
  else if (!log.redaction.enabled) chips.push(`<span class="chip warn">${esc(t('note.redactOff'))}</span>`)
  if (log.truncated) chips.push(`<span class="chip warn">${esc(t('note.truncated'))}</span>`)

  const legBlocks = turns.map((turn) => `<section class="leg">
<h3>${esc(t('turn.leg', { index: String(turn.index) }))} · ${esc(span(turn.durationMs))} · ${esc(turn.reason ?? 'open')}</h3>
<p class="meta">${esc([t('turn.steps', { count: String(turn.steps) }), t('turn.tools', { count: String(turn.toolCalls) }), t('turn.files', { count: String(turn.filesChanged) })].join(' / '))}</p>
${turn.events.map((row) => reportRow(row, t)).join('\n')}
${turn.capped ? `<p class="note">${esc(t('turn.capped'))}</p>` : ''}
</section>`).join('\n')

  const route = log.files.length === 0
    ? `<p class="meta">${esc(t('route.empty'))}</p>`
    : `<ul class="list">${log.files.map((file) => `<li><span class="p">${esc(file.path)}</span><span class="n">${esc([
      file.edits > 0 ? t('route.edits', { edits: String(file.edits) }) : '',
      file.writes > 0 ? t('route.writes', { writes: String(file.writes) }) : '',
      file.reads > 0 ? t('route.reads', { reads: String(file.reads) }) : '',
    ].filter((part) => part !== '').join(' · '))}</span></li>`).join('')}</ul>`

  const topCall = log.tools.length === 0 ? 0 : Math.max(...log.tools.map((tool) => tool.calls))
  const cargo = log.tools.length === 0
    ? `<p class="meta">${esc(t('cargo.empty'))}</p>`
    : `<ul class="list">${log.tools.map((tool) => `<li><span class="p">${esc(tool.name)} <span class="n">${esc(t('cargo.calls', { count: String(tool.calls) }))}${tool.errors > 0 ? ` · ${esc(t('cargo.errors', { count: String(tool.errors) }))}` : ''} · ${esc(span(tool.totalMs))}</span></span><span class="n">${'▮'.repeat(Math.max(1, Math.round((tool.calls / topCall) * 12)))}</span></li>`).join('')}</ul>`

  const conditions = log.models.length === 0
    ? `<p class="meta">${esc(t('conditions.noModel'))}</p>`
    : `<ul class="list">${log.models.map((model) => `<li><span class="p">${esc(model.model)} <span class="n">${esc(model.provider)}</span></span><span class="n">${esc(t('conditions.messages', { count: String(model.messages) }))}</span></li>`).join('')}</ul>`

  const todos = log.todos.length === 0
    ? ''
    : `<h2>${esc(t('section.todos'))}</h2><ul class="list">${log.todos.map((todo) => `<li><span class="p">${esc(todo.content)}</span><span class="n">${esc(todo.status)}</span></li>`).join('')}</ul>`

  const redactHead = options.redactNote
    ? (log.redaction.enabled && log.redaction.count > 0
      ? `<p class="foot">${esc(t('export.redactHead', { count: String(log.redaction.count) }))}${log.redaction.kinds.length > 0 ? ` ${esc(t('note.redactedKinds', { kinds: log.redaction.kinds.join(', ') }))}` : ''}</p>`
      : `<p class="foot">${esc(t('export.redactHeadOff'))}</p>`)
    : ''

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t('export.reportTitle', { title: log.title }))}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<main class="page">
<header class="head">
<span class="mark">${WHALE_MARK}</span>
<div>
<h1>${esc(t('export.reportTitle', { title: log.title }))}</h1>
<p class="sub">${esc(t('export.reportMeta', { time: clock(log.generatedAt), events: group(log.counts.rawEvents) }))}</p>
<p class="sub">${esc(t('meta.cwd'))}: ${esc(log.cwd)} · ${esc(t('meta.startedAt'))}: ${esc(clock(log.startedAt))} · ${esc(t('meta.session'))}: ${esc(log.sessionId)}</p>
<div class="chips">${chips.join('')}</div>
</div>
</header>

<h2>${esc(t('section.readings'))}</h2>
<div class="grid">${readings.map(([label, value]) => `<div class="cell"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('')}</div>

<h2>${esc(t('section.timeline'))}</h2>
${legBlocks === '' ? `<p class="meta">${esc(t('state.empty'))}</p>` : legBlocks}

<h2>${esc(t('section.route'))}</h2>
${route}

<h2>${esc(t('section.cargo'))}</h2>
${cargo}

<h2>${esc(t('section.conditions'))}</h2>
${conditions}
${todos}

<footer>
${redactHead}
<p class="foot">${esc(t('note.local'))} ${esc(t('note.cost'))}</p>
</footer>
</main>
</body>
</html>`
}

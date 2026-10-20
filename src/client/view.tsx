/**
 * dsh-voyage-log — The voyage view.
 *
 * One tab in the conversation view ring. It asks the host to fold the *current*
 * session, then renders the readings, the leg-by-leg timeline, and the cargo
 * panels. Every number on screen comes off the raw log; nothing is estimated.
 * Actions live in a sticky in-view toolbar because the native tab strip only
 * renders labels.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { VoyageEvent, VoyageLog } from '../schema.ts'
import type { Translate } from './locales.ts'
import { buildMarkdown, buildReportHtml, clock, group, span } from './report.ts'

/** Re-declare the view seat so this plugin types its registration without importing ui-conversation. */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.view': {
      kind: 'list'
      scope: 'session'
      owner: { inspect?: { callId: string } | null; onInspectDone?: () => void }
    }
  }
}

/** Runtime shape the mounted voyage namespace returns. */
type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }

/** The host Remote face passed into the view. */
export interface VoyageActions {
  build: (sessionId: string) => Promise<RemoteResult<VoyageLog>>
}

/** Props the view-tab slot component receives (slot runtime + inject face). */
export type VoyageViewSlotProps = PropsRuntime<'conversation.view'> & {
  actions: VoyageActions
  t: Translate
}

type Phase = 'loading' | 'ready' | 'error'
type Version = 'full' | 'brief'

/** Which row classes the timeline shows. */
interface Filters {
  key: boolean
  tools: boolean
  files: boolean
}

/** The export modal knobs. */
interface ExportOptions {
  version: Version
  includeTools: boolean
  includeFiles: boolean
  redactNote: boolean
}

const WHALE = (
  <svg className="v-mark" viewBox="0 0 48 48" width="24" height="24" aria-hidden="true" focusable="false">
    <path d="M6 30c6 0 10-3 14-7 3-3 6-5 10-5 5 0 8 3 8 7 0 5-4 8-9 8-2 0-4-1-5-2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M6 30c-1-6 2-12 7-15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M13 15c4 1 7 4 8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
)

/** Keep a title usable as a file name. */
function fileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  return `voyage-${safe === '' ? 'log' : safe}.html`
}

/** Copy text, falling back to a selection when the async clipboard is unavailable. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

/** Print a self-contained document through a throwaway frame, without a popup. */
function printDocument(html: string): void {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (doc === null) {
    frame.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  window.setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
  }, 250)
  window.setTimeout(() => { frame.remove() }, 90_000)
}

/** Save the report through a local object URL; nothing leaves the machine. */
function downloadDocument(html: string, name: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 30_000)
}

/** Rows this timeline should show under the active filters. */
function visibleRows(eventes: readonly VoyageEvent[], filters: Filters): VoyageEvent[] {
  return eventes.filter((row) => (row.cat === 'key' ? filters.key : row.cat === 'tool' ? filters.tools : filters.files))
}

/** One timeline row. */
function TimelineRow({ row, t }: { row: VoyageEvent; t: Translate }) {
  const main = row.text ?? row.summary ?? ''
  const readout: string[] = []
  if (row.kind === 'tool' || row.kind === 'file') {
    if (row.name !== undefined) readout.push(row.name)
    if (row.path !== undefined) readout.push(row.path)
    if (row.durationMs !== undefined && row.durationMs > 0) readout.push(t('row.duration', { ms: String(row.durationMs) }))
    if (row.outcome === 'no-result') readout.push(t('row.noResult'))
  } else if (row.kind === 'approval') {
    if (row.outcome !== undefined) readout.push(row.outcome)
    if (row.reason !== undefined) readout.push(row.reason)
  } else if (row.kind === 'retry') {
    if (row.provider !== undefined) readout.push(row.provider)
    if (row.reason !== undefined) readout.push(t('row.reason', { code: row.reason }))
  } else if (row.kind === 'compaction' || row.kind === 'turn-end') {
    if (row.reason !== undefined) readout.push(row.reason)
  }
  const detail = row.detail !== undefined && row.detail !== main ? row.detail : ''
  return (
    <div className="v-row">
      <span className="v-time">{new Date(row.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span className={`v-tag ${row.kind}`}>{t(`row.${row.kind}`)}</span>
      <span className="v-body">
        <span className={row.text === undefined ? 'v-main' : 'v-main dim'}>{main}</span>
        {readout.length > 0 ? <span className="v-sub">{readout.join(' · ')}</span> : null}
        {detail !== '' ? <span className="v-sub">{detail}</span> : null}
        {row.error !== undefined ? <span className="v-err">{row.error}</span> : null}
      </span>
    </div>
  )
}

/** One leg of the voyage. */
function Leg({ turn, index, open, filters, allOpen, t, onToggle }: {
  turn: VoyageLog['turns'][number]
  index: number
  open: boolean
  filters: Filters
  allOpen: boolean
  t: Translate
  onToggle: (key: number) => void
}) {
  const rows = visibleRows(turn.events, filters)
  const key = `${turn.index}-${index}`
  return (
    <section className="v-leg">
      <button type="button" className="v-leg-h" onClick={() => { onToggle(turn.index) }} aria-expanded={open}>
        <span className={`v-dot ${turn.reason ?? 'open'}`} />
        <span className="v-leg-t">{t('turn.leg', { index: String(turn.index) })}</span>
        <span className="v-leg-m">
          {span(turn.durationMs)} · {t('turn.steps', { count: String(turn.steps) })} · {t('turn.tools', { count: String(turn.toolCalls) })} · {t('turn.files', { count: String(turn.filesChanged) })}
        </span>
        <span className="v-caret">{open ? (allOpen ? t('action.collapse') : t('action.collapse')) : t('action.expand')}</span>
      </button>
      {open ? (
        <div className="v-rows">
          {turn.prompt !== '' && filters.key ? (
            <div className="v-row">
              <span className="v-time">{new Date(turn.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="v-tag user">{t('row.user')}</span>
              <span className="v-body"><span className="v-main dim">{turn.prompt}</span></span>
            </div>
          ) : null}
          {rows.length === 0 ? <p className="v-note">{t('filter.hiddenAll')}</p> : rows.map((row) => <TimelineRow key={`${key}-${row.seq}`} row={row} t={t} />)}
          {turn.capped ? <p className="v-note">{t('turn.capped')}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

/** The voyage tab body. */
export function VoyageView({ sessionId, actions, t }: VoyageViewSlotProps) {
  const [log, setLog] = useState<VoyageLog | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [failure, setFailure] = useState('')
  const [nonce, setNonce] = useState(0)
  const [openLegs, setOpenLegs] = useState<Readonly<Record<number, boolean>>>({})
  const [filters, setFilters] = useState<Filters>({ key: true, tools: true, files: true })
  const [exportOpen, setExportOpen] = useState(false)
  const [options, setOptions] = useState<ExportOptions>({ version: 'full', includeTools: true, includeFiles: true, redactNote: true })
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (sessionId === undefined || sessionId === '') {
      setLog(null)
      setPhase('ready')
      return
    }
    let cancelled = false
    setPhase('loading')
    setFailure('')
    void actions.build(sessionId).then(
      (result) => {
        if (cancelled) return
        if (result.ok) {
          setLog(result.value)
          setPhase('ready')
        } else {
          setFailure(result.error.message)
          setPhase('error')
        }
      },
      (reason: unknown) => {
        if (cancelled) return
        setFailure(reason instanceof Error ? reason.message : String(reason))
        setPhase('error')
      },
    )
    return () => { cancelled = true }
  }, [sessionId, actions, nonce])

  /** Open the newest leg whenever a fresh fold lands. */
  useEffect(() => {
    if (log === null || log.turns.length === 0) {
      setOpenLegs({})
      return
    }
    const last = log.turns[log.turns.length - 1]
    if (last !== undefined) setOpenLegs({ [last.index]: true })
  }, [log])

  const say = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => { setToast('') }, 2500)
  }, [])

  useEffect(() => () => { if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current) }, [])

  const toggleLeg = useCallback((index: number) => {
    setOpenLegs((prev) => ({ ...prev, [index]: prev[index] !== true }))
  }, [])

  const allOpen = useMemo(() => {
    if (log === null || log.turns.length === 0) return false
    return log.turns.every((turn) => openLegs[turn.index] === true)
  }, [log, openLegs])

  const setAll = useCallback((value: boolean) => {
    if (log === null) return
    const next: Record<number, boolean> = {}
    for (const turn of log.turns) next[turn.index] = value
    setOpenLegs(next)
  }, [log])

  const report = useMemo(() => (log === null ? '' : buildReportHtml(log, t, options)), [log, t, options])

  const onCopy = useCallback(() => {
    if (log === null) return
    void writeClipboard(buildMarkdown(log, t, options)).then((ok) => { say(ok ? t('action.copied') : t('action.copyFailed')) })
  }, [log, t, options, say])

  const onDownload = useCallback(() => {
    if (log === null || report === '') return
    downloadDocument(report, fileName(log.title))
    setExportOpen(false)
    say(t('action.downloaded'))
  }, [log, report, t, say])

  const onPrint = useCallback(() => {
    if (report === '') return
    printDocument(report)
    setExportOpen(false)
  }, [report])

  /** ⌘E / Ctrl+E opens the export sheet, Escape closes it, while this tab is mounted. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        setExportOpen(true)
        return
      }
      if (event.key === 'Escape') setExportOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [])

  if (phase === 'loading' && log === null) {
    return (
      <div className="v-root">
        <div className="v-inner">
          <div className="v-state"><span className="v-spin" />{t('state.loading')}</div>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="v-root">
        <div className="v-inner">
          <div className="v-bar">
            <button type="button" className="v-btn primary" onClick={() => { setNonce((value) => value + 1) }}>{t('action.refresh')}</button>
            <span className="v-spacer" />
          </div>
          <div className="v-empty">{t('state.error', { message: failure })}</div>
        </div>
      </div>
    )
  }

  if (log === null) {
    return (
      <div className="v-root">
        <div className="v-inner"><div className="v-empty">{t('state.noSession')}</div></div>
      </div>
    )
  }

  const chips: JSX.Element[] = [
    <span className="v-chip" key="preset">{log.agentPreset}</span>,
    <span className="v-chip" key="seq">{t('hero.throughSeq', { seq: String(log.throughSeq) })}</span>,
  ]
  if (log.counts.approvals > 0) chips.push(<span className="v-chip" key="ap">{t('metric.approvals')} {log.counts.approvals}</span>)
  if (log.counts.retries > 0) chips.push(<span className="v-chip warn" key="rt">{t('metric.retries')} {log.counts.retries}</span>)
  if (log.counts.compactions > 0) chips.push(<span className="v-chip" key="cp">{t('metric.compactions')} {log.counts.compactions}</span>)
  if (log.redaction.enabled && log.redaction.count > 0) {
    chips.push(<span className="v-chip" key="rd" title={log.redaction.kinds.join(', ')}>{t('note.redacted', { count: String(log.redaction.count) })}</span>)
  } else if (!log.redaction.enabled) {
    chips.push(<span className="v-chip warn" key="rdoff">{t('note.redactOff')}</span>)
  }
  if (log.truncated) chips.push(<span className="v-chip warn" key="tr">{t('note.truncated')}</span>)
  if (log.counts.toolErrors > 0) chips.push(<span className="v-chip bad" key="te">{t('metric.toolErrors')} {log.counts.toolErrors}</span>)

  const readings: Array<[string, string, boolean]> = [
    [t('metric.turns'), String(log.counts.turns), false],
    [t('metric.steps'), String(log.counts.steps), false],
    [t('metric.toolCalls'), String(log.counts.toolCalls), false],
    [t('metric.toolErrors'), String(log.counts.toolErrors), log.counts.toolErrors > 0],
    [t('metric.filesChanged'), String(log.counts.filesChanged), false],
    [t('metric.filesRead'), String(log.counts.filesRead), false],
    [t('metric.duration'), span(log.durationMs), false],
    [t('metric.tokenIn'), group(log.tokens.input), false],
    [t('metric.tokenOut'), group(log.tokens.output), false],
    [t('metric.cacheRead'), group(log.tokens.cacheRead), false],
    [t('metric.rawEvents'), group(log.counts.rawEvents), false],
  ]

  const topCall = log.tools.length === 0 ? 0 : Math.max(...log.tools.map((tool) => tool.calls))

  return (
    <div className="v-root">
      <div className="v-inner">
        <div className="v-bar">
          <button type="button" className="v-btn" onClick={() => { setNonce((value) => value + 1) }} disabled={phase === 'loading'}>
            {phase === 'loading' ? t('action.refreshing') : t('action.refresh')}
          </button>
          <button type="button" className="v-btn" onClick={onCopy}>{t('action.copy')}</button>
          <button type="button" className="v-btn primary" onClick={() => { setExportOpen(true) }}>{t('action.export')}</button>
          <span className="v-spacer" />
          {phase === 'loading' ? <span className="v-chip">{t('action.refreshing')}</span> : null}
        </div>

        <header className="v-hero">
          {WHALE}
          <div>
            <h2>{log.title}</h2>
            <p className="v-sub">{t('meta.cwd')}：{log.cwd} · {t('meta.startedAt')}：{clock(log.startedAt)} · {t('hero.generated', { time: clock(log.generatedAt) })}</p>
            <div className="v-chips">{chips}</div>
          </div>
        </header>

        <h3 className="v-h">{t('section.readings')}</h3>
        <div className="v-grid">
          {readings.map(([label, value, bad]) => (
            <div className={bad ? 'v-cell bad' : 'v-cell'} key={label}><b>{value}</b><span>{label}</span></div>
          ))}
        </div>
        <p className="v-local">{t('note.local')} {t('note.cost')}</p>

        <div className="v-cols">
          <div>
            <h3 className="v-h">{t('section.timeline')}</h3>
            <div className="v-filters">
              <span className="v-flabel">{t('filter.title')}</span>
              <button type="button" className="v-toggle" aria-pressed={filters.key} onClick={() => { setFilters((f) => ({ ...f, key: !f.key })) }}>{t('filter.key')}</button>
              <button type="button" className="v-toggle" aria-pressed={filters.tools} onClick={() => { setFilters((f) => ({ ...f, tools: !f.tools })) }}>{t('filter.tools')}</button>
              <button type="button" className="v-toggle" aria-pressed={filters.files} onClick={() => { setFilters((f) => ({ ...f, files: !f.files })) }}>{t('filter.files')}</button>
              <span className="v-spacer" />
              <button type="button" className="v-toggle" onClick={() => { setAll(!allOpen) }}>{allOpen ? t('action.collapse') : t('action.expand')}</button>
            </div>
            {log.turns.length === 0
              ? <div className="v-empty">{t('state.empty')}</div>
              : log.turns.map((turn, index) => (
                <Leg
                  key={turn.index}
                  turn={turn}
                  index={index}
                  open={openLegs[turn.index] === true}
                  filters={filters}
                  allOpen={allOpen}
                  t={t}
                  onToggle={toggleLeg}
                />
              ))}
          </div>

          <aside>
            <div className="v-panel">
              <h3 className="v-h">{t('section.route')}</h3>
              {log.files.length === 0
                ? <p className="v-sub">{t('route.empty')}</p>
                : (
                  <ul className="v-list">
                    {log.files.map((file) => (
                      <li key={file.path}>
                        <span className="v-p">{file.path}</span>
                        <span className="v-n">{[
                          file.edits > 0 ? `E${file.edits}` : '',
                          file.writes > 0 ? `W${file.writes}` : '',
                          file.reads > 0 ? `R${file.reads}` : '',
                        ].filter((part) => part !== '').join(' ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            <div className="v-panel">
              <h3 className="v-h">{t('section.cargo')}</h3>
              {log.tools.length === 0
                ? <p className="v-sub">{t('cargo.empty')}</p>
                : log.tools.map((tool) => (
                  <div className="v-bar-row" key={tool.name}>
                    <span className="v-p">{tool.name}</span>
                    <span className="v-track"><span className="v-fill" style={{ width: `${topCall === 0 ? 0 : Math.round((tool.calls / topCall) * 100)}%` }} /></span>
                    <span className="v-n">{tool.calls}{tool.errors > 0 ? ` ⚠${tool.errors}` : ''}</span>
                  </div>
                ))}
            </div>

            <div className="v-panel">
              <h3 className="v-h">{t('section.conditions')}</h3>
              {log.models.length === 0
                ? <p className="v-sub">{t('conditions.noModel')}</p>
                : (
                  <ul className="v-list">
                    {log.models.map((model) => (
                      <li key={model.model}>
                        <span className="v-p">{model.model}<br />{model.provider}</span>
                        <span className="v-n">{model.messages}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            {log.todos.length > 0 ? (
              <div className="v-panel">
                <h3 className="v-h">{t('section.todos')}</h3>
                <ul className="v-list">
                  {log.todos.map((todo) => (
                    <li key={`${todo.status}-${todo.content}`}>
                      <span className="v-p">{todo.content}</span>
                      <span className="v-n">{todo.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {exportOpen ? (
        <div className="v-veil" role="dialog" aria-modal="true" aria-label={t('export.title')} onClick={() => { setExportOpen(false) }}>
          <div className="v-modal" onClick={(event) => { event.stopPropagation() }}>
            <h3>{t('export.title')}</h3>
            <p className="hint">{t('export.hint')}</p>

            <div className="v-field">
              <span className="v-flabel">{t('export.version')}</span>
              <div className="v-seg">
                <button type="button" className="v-toggle" aria-pressed={options.version === 'full'} onClick={() => { setOptions((o) => ({ ...o, version: 'full' })) }}>{t('export.full')}</button>
                <button type="button" className="v-toggle" aria-pressed={options.version === 'brief'} onClick={() => { setOptions((o) => ({ ...o, version: 'brief' })) }}>{t('export.brief')}</button>
              </div>
            </div>

            <div className="v-field">
              <span className="v-flabel">{t('export.include')}</span>
              <button type="button" className="v-toggle" aria-pressed={options.includeTools} onClick={() => { setOptions((o) => ({ ...o, includeTools: !o.includeTools })) }}>{t('export.includeTools')}</button>
              <button type="button" className="v-toggle" aria-pressed={options.includeFiles} onClick={() => { setOptions((o) => ({ ...o, includeFiles: !o.includeFiles })) }}>{t('export.includeFiles')}</button>
              <button type="button" className="v-toggle" aria-pressed={options.redactNote} onClick={() => { setOptions((o) => ({ ...o, redactNote: !o.redactNote })) }}>{t('export.redact')}</button>
            </div>

            {log.redaction.enabled && log.redaction.count > 0
              ? <p className="v-sub">{t('note.redacted', { count: String(log.redaction.count) })} · {t('note.redactedKinds', { kinds: log.redaction.kinds.join(', ') })}</p>
              : <p className="v-sub">{t('note.redactOff')}</p>}

            <div className="v-actions">
              <button type="button" className="v-btn" onClick={() => { setExportOpen(false) }}>{t('action.close')}</button>
              <button type="button" className="v-btn" onClick={onPrint}>{t('action.print')}</button>
              <button type="button" className="v-btn primary" onClick={onDownload}>{t('action.download')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast !== '' ? <div className="v-toast">{toast}</div> : null}
    </div>
  )
}

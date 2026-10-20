import { describe, expect, it } from 'vitest'
import { buildMarkdown, buildReportHtml, clock, group, span } from '../src/client/report.ts'
import { MASK } from '../src/redact.ts'
import { BASE, RELAY_KEY, foldSample, reportOptions, sampleEvents, t } from './sample.ts'

const log = foldSample()

describe('format helpers', () => {
  it('reads a duration at a human scale', () => {
    expect(span(900)).toBe('900 ms')
    expect(span(1_500)).toBe('2 s')
    expect(span(65_000)).toBe('1 min 5 s')
    expect(span(3_720_000)).toBe('1 h 2 min')
    expect(span(0)).toBe('0 ms')
  })

  it('groups token counts', () => {
    expect(group(1_210)).toBe('1,210')
    expect(group(0)).toBe('0')
  })

  it('renders a wall clock from a fold timestamp', () => {
    expect(clock(BASE)).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('buildMarkdown', () => {
  const md = buildMarkdown(log, t)

  it('opens with the title and the honest readings', () => {
    expect(md.startsWith(`# 航海日志 · 配置改造航程`)).toBe(true)
    expect(md).toContain('`E:/proj/demo`')
    expect(md).toContain('输入 tokens 1,210')
    expect(md).toContain('输出 tokens 85')
    expect(md).toContain('缓存读取 600')
    expect(md).toContain('deepseek-v4-pro×1')
    expect(md).toContain('航段: 2')
  })

  it('prints one section per leg with its reason', () => {
    expect(md).toContain('## 航段 1 · 9 s · completed')
    expect(md).toContain('## 航段 2 · 3 s · aborted')
  })

  it('carries the row labels the view uses', () => {
    expect(md).toContain('[指令] 先把 key = ')
    expect(md).toContain('[复命] 我会写入配置。')
    expect(md).toContain('[压缩]')
    expect(md).toContain('[审批]')
    expect(md).toContain('[重试]')
  })

  it('notes the tool that never got a result and the call that failed', () => {
    expect(md).toContain('未收到回执')
    expect(md).toContain('⚠ ToolError · TOOL_FAILED · remote rejected')
  })

  it('lists the task board', () => {
    expect(md).toContain('- [x] 完成脱敏 (completed)')
    expect(md).toContain('- [ ] 写测试 (pending)')
  })

  it('closes with the local-processing and no-cost promises', () => {
    expect(md).toContain('全部数据只在本地处理，未上传任何内容。')
    expect(md).toContain('用量为日志实测值，未估算费用。')
    expect(md).toContain(`已自动脱敏 ${log.redaction.count} 处`)
  })

  it('never leaks a secret into the digest', () => {
    expect(md).not.toContain(RELAY_KEY)
    expect(md).not.toContain('Sup3rS3cretPasswd')
    expect(md).toContain(MASK)
  })

  it('drops non-key rows for a brief export', () => {
    const brief = buildMarkdown(log, t, { ...reportOptions, version: 'brief' })
    expect(brief).not.toContain('编辑 config.ts')
    expect(brief).not.toContain('mystery_tool')
    expect(brief).toContain('我会写入配置。')
  })

  it('honours the include toggles independently', () => {
    expect(buildMarkdown(log, t, { ...reportOptions, includeTools: false })).not.toContain('mystery_tool')
    expect(buildMarkdown(log, t, { ...reportOptions, includeTools: false })).toContain('编辑 config.ts')
    expect(buildMarkdown(log, t, { ...reportOptions, includeFiles: false })).not.toContain('编辑 config.ts')
    expect(buildMarkdown(log, t, { ...reportOptions, includeFiles: false })).toContain('mystery_tool')
  })

  it('flags a leg that was capped', () => {
    const capped = foldSample(sampleEvents, { redactSecrets: true, maxTurnEvents: 3 })
    expect(buildMarkdown(capped, t)).toContain('本航段行数已达上限')
  })

  it('says redaction was off instead of pretending', () => {
    const raw = foldSample(sampleEvents, { redactSecrets: false, maxTurnEvents: 240 })
    expect(buildMarkdown(raw, t)).not.toContain('已自动脱敏')
    expect(buildMarkdown(raw, t)).toContain(RELAY_KEY)
  })
})

describe('buildReportHtml', () => {
  const html = buildReportHtml(log, t, reportOptions)

  it('is one self-contained document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<style>')
    expect(html).toContain('</html>')
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toMatch(/<script\b/i)
    expect(html).not.toMatch(/src=/i)
  })

  it('escapes everything the log carried verbatim', () => {
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('完成')
  })

  it('keeps secrets behind the mask', () => {
    expect(html).not.toContain(RELAY_KEY)
    expect(html).not.toContain('Sup3rS3cretPasswd')
    expect(html).toContain(MASK)
    expect(html).toContain('已自动脱敏')
  })

  it('renders the readings grid from measured values only', () => {
    for (const label of ['航段', '步骤', '工具调用', '失败调用', '改动文件', '读取文件', '航行时长', '原始事件', '输入 tokens', '输出 tokens', '缓存读取']) {
      expect(html).toContain(`<span>${label}</span>`)
    }
    expect(html).toContain('<b>1,210</b>')
    expect(html).not.toMatch(/US?\$?\s?\d+\.\d{2}\s*(?:元|USD|\$)/)
  })

  it('shows the route, the cargo, and the sea conditions', () => {
    expect(html).toContain('E:/proj/demo/src/config.ts')
    expect(html).toContain('1 次编辑')
    expect(html).toContain('mystery_tool')
    expect(html).toContain('glm-5.3-flash')
    expect(html).toContain('zhipu')
  })

  it('keeps the whale mark inline and the footer honest', () => {
    expect(html).toContain('<svg viewBox="0 0 48 48"')
    expect(html).toContain('全部数据只在本地处理，未上传任何内容。')
    expect(html).toContain('用量为日志实测值，未估算费用。')
  })

  it('can drop the redaction note', () => {
    expect(buildReportHtml(log, t, { ...reportOptions, redactNote: false })).not.toContain('本报告已自动脱敏')
  })

  it('says so when a leg was capped or an empty fold exports', () => {
    expect(buildReportHtml(foldSample(sampleEvents, { redactSecrets: true, maxTurnEvents: 3 }), t, reportOptions)).toContain('本航段行数已达上限')
    const empty = foldSample([])
    expect(buildReportHtml(empty, t, reportOptions)).toContain('这次会话还没有可折叠的航行记录。')
    expect(buildReportHtml(empty, t, reportOptions)).toContain('没有工具调用记录。')
    expect(buildReportHtml(empty, t, reportOptions)).toContain('这次航行没有改动任何文件。')
  })

  it('warns when redaction was disabled', () => {
    const raw = foldSample(sampleEvents, { redactSecrets: false, maxTurnEvents: 240 })
    expect(buildReportHtml(raw, t, reportOptions)).toContain('脱敏已在配置中关闭')
  })
})

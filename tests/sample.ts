/**
 * Shared fold fixture shaped exactly like the events `sessionQuery.readSession`
 * returns: `user/message` carries `data.content`, `assistant/message` carries
 * `data.message` + `data.usage`, and `tool/result` answers by `callId`.
 */
import { foldSession, type FoldOptions, type RawEvent, type RawHeader } from '../src/fold.ts'
import type { VoyageLog } from '../src/schema.ts'
import { zh } from '../src/client/locales.ts'
import type { Translate } from '../src/client/locales.ts'

export const BASE = 1_700_000_000_000
export const GITHUB_TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz01234567'
export const RELAY_KEY = 'sk_abcdefghijklmnopqrstuvwx'
export const SECRET_URL = 'https://user:Sup3rS3cretPasswd@example.com/api'

export const sampleHeader: RawHeader = {
  id: 'session-01harrow',
  createdAt: BASE,
  cwd: 'E:/proj/demo',
  agentPreset: 'standard',
}

export const sampleEvents: readonly RawEvent[] = [
  { type: 'session', seq: 1, time: BASE, data: {} },
  { type: 'turn/start', seq: 2, time: BASE + 1_000, data: { turn: 1 } },
  {
    type: 'user/message', seq: 3, time: BASE + 1_000,
    data: { content: [{ type: 'text', text: `先把 key = ${RELAY_KEY} 写进配置，再推送。` }] },
  },
  {
    type: 'assistant/message', seq: 4, time: BASE + 2_000,
    data: {
      message: {
        role: 'assistant',
        source: { kind: 'model', model: 'deepseek-v4-pro', provider: 'deepseek' },
        content: [{ type: 'reasoning', text: 'x'.repeat(120) }, { type: 'text', text: '我会写入配置。' }],
      },
      usage: { inputTokens: 1200, outputTokens: 80, cacheReadTokens: 600 },
    },
  },
  { type: 'step/start', seq: 5, time: BASE + 2_000, data: {} },
  {
    type: 'tool/call', seq: 6, time: BASE + 3_000,
    data: { callId: 'c1', name: 'edit', arguments: JSON.stringify({ file_path: 'E:/proj/demo/src/config.ts', old_string: 'abc', new_string: 'defghijkl' }) },
  },
  {
    type: 'tool/result', seq: 7, time: BASE + 4_500,
    data: { message: { source: { callId: 'c1' }, content: [{ type: 'tool_result', content: [{ type: 'text', text: 'ok' }] }] } },
  },
  {
    type: 'tool/call', seq: 8, time: BASE + 5_000,
    data: { callId: 'c2', name: 'pwsh', arguments: JSON.stringify({ command: `git push && curl ${SECRET_URL}`, description: '推送并同步' }) },
  },
  {
    type: 'tool/result', seq: 9, time: BASE + 5_200,
    data: {
      message: { source: { callId: 'c2' }, content: [{ type: 'tool_result', isError: true, content: [{ type: 'text', text: 'remote rejected' }] }] },
      error: { name: 'ToolError', code: 'TOOL_FAILED' },
    },
  },
  { type: 'tool/call', seq: 10, time: BASE + 6_000, data: { callId: 'c3', name: 'mystery_tool', arguments: '{"a":1}' } },
  { type: 'approval/asked', seq: 11, time: BASE + 7_000, data: { id: 'ap1', toolName: 'pwsh', reason: '需要联网' } },
  { type: 'approval/decided', seq: 12, time: BASE + 7_500, data: { id: 'ap1', outcome: 'allow-once' } },
  { type: 'llm/retry', seq: 13, time: BASE + 8_000, data: { provider: 'deepseek', failure: { message: '上游超时' } } },
  { type: 'compaction/start', seq: 14, time: BASE + 9_000, data: { compactionId: 'cp1' } },
  { type: 'compaction/end', seq: 15, time: BASE + 9_500, data: { compactionId: 'cp1' } },
  { type: 'todo/write', seq: 16, time: BASE + 9_600, data: { todos: [{ content: '完成脱敏', status: 'completed' }, { content: '写测试', status: 'pending' }] } },
  { type: 'session/title', seq: 17, time: BASE + 9_700, data: { title: '配置改造航程' } },
  { type: 'turn/end', seq: 18, time: BASE + 10_000, data: { reason: { kind: 'completed' } } },
  { type: 'turn/start', seq: 19, time: BASE + 11_000, data: { turn: 2 } },
  { type: 'step/start', seq: 20, time: BASE + 11_000, data: {} },
  {
    type: 'tool/call', seq: 21, time: BASE + 12_000,
    data: { callId: 'c4', name: 'read', arguments: JSON.stringify({ file_path: 'E:/proj/demo/README.md', offset: 1, limit: 40 }) },
  },
  {
    type: 'tool/result', seq: 22, time: BASE + 12_100,
    data: { message: { source: { callId: 'c4' }, content: [{ type: 'tool_result', content: [{ type: 'text', text: '# demo' }] }] } },
  },
  {
    type: 'assistant/message', seq: 23, time: BASE + 13_000,
    data: {
      message: {
        role: 'assistant', source: { kind: 'model', model: 'glm-5.3-flash', provider: 'zhipu' },
        content: [{ type: 'text', text: '<script>alert(1)</script> 完成' }],
      },
      usage: { inputTokens: 10, outputTokens: 5 },
    },
  },
  { type: 'turn/end', seq: 24, time: BASE + 14_000, data: { reason: { kind: 'aborted' } } },
]

export const fullFold: FoldOptions = { redactSecrets: true, maxTurnEvents: 240 }

/** Fold the sample with the given overrides. */
export function foldSample(events: readonly RawEvent[] = sampleEvents, options: FoldOptions = fullFold, header: RawHeader = sampleHeader): VoyageLog {
  return foldSession(header, events, options)
}

/** Minimal translator for the pure report builders. */
export const t: Translate = (key, params) => {
  const template = (zh as unknown as Record<string, string>)[key] ?? key
  return template.replace(/\{(\w+)\}/g, (marker, name: string) => String(params?.[name] ?? marker))
}

export const reportOptions = { version: 'full', includeTools: true, includeFiles: true, redactNote: true } as const

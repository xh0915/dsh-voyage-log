/**
 * dsh-voyage-log — Product copy (zh / en).
 *
 * Registered under the package namespace in client/index.tsx; every key exists
 * in both dictionaries. The framework's `t` interpolates `{name}` parameters.
 *
 * Plain-language rule: no internal jargon in either dictionary. "Fold" is
 * "read/summarize", a "leg" is a "turn", and the user sees 你 / AI 回复.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export const zh = {
  'view.label': '航海日志',

  'hero.badge': '读取 DSH 会话记录',
  'hero.generated': '更新于 {time}',
  'hero.throughSeq': '已读取到第 {seq} 条事件',

  'state.loading': '正在读取这次会话的记录…',
  'state.empty': '这次会话还没有可显示的事件。',
  'state.error': '读取失败：{message}',
  'state.noSession': '当前没有打开的会话。打开一个对话就能看到它的记录。',
  'state.notMounted': '插件的后台服务还没连上，稍等一下再试。',
  'state.stale': '数据更新于 {time}，可能还没包含最新的对话。',

  'action.refresh': '刷新',
  'action.refreshing': '读取中…',
  'action.copy': '复制摘要',
  'action.copied': '摘要已复制',
  'action.copyFailed': '复制失败，请手动选取',
  'action.export': '导出报告',
  'action.download': '下载 HTML',
  'action.downloaded': '报告已保存到下载文件夹',
  'action.print': '打印',
  'action.close': '关闭',
  'action.expand': '展开',
  'action.collapse': '收起',

  'filter.title': '显示',
  'filter.key': '关键事件',
  'filter.tools': '工具调用',
  'filter.files': '文件变更',
  'filter.hiddenAll': '当前筛选下没有事件，试试打开更多类别。',

  'section.readings': '关键数字',
  'section.timeline': '时间线',
  'section.route': '文件',
  'section.cargo': '工具',
  'section.conditions': '模型与用量',
  'section.todos': '任务清单',

  'metric.turns': '对话轮次',
  'metric.steps': '步骤',
  'metric.toolCalls': '工具调用',
  'metric.toolErrors': '失败调用',
  'metric.filesChanged': '改动文件',
  'metric.filesRead': '读取文件',
  'metric.approvals': '审批请求',
  'metric.retries': '模型重试',
  'metric.compactions': '上下文压缩',
  'metric.rawEvents': '原始事件',
  'metric.duration': '总耗时',
  'metric.tokenIn': '输入 tokens',
  'metric.tokenOut': '输出 tokens',
  'metric.cacheRead': '缓存读取',

  'meta.cwd': '工作区',
  'meta.preset': 'Agent 预设',
  'meta.startedAt': '开始时间',
  'meta.session': '会话 ID',
  'meta.models': '模型',
  'meta.tokens': '用量',

  'turn.leg': '第 {index} 轮',
  'turn.open': '进行中',
  'turn.completed': '已完成',
  'turn.error': '出错',
  'turn.aborted': '已中断',
  'turn.steps': '{count} 步',
  'turn.tools': '{count} 次工具调用',
  'turn.files': '{count} 个文件改动',
  'turn.capped': '这一轮事件太多，只显示了前面一部分',
  'turn.empty': '这一轮没有可显示的事件。',

  'row.user': '你',
  'row.assistant': 'AI 回复',
  'row.tool': '工具',
  'row.file': '文件',
  'row.approval': '审批',
  'row.retry': '重试',
  'row.compaction': '上下文压缩',
  'row.turn-end': '轮次结束',
  'row.noResult': '没有返回结果',
  'row.outcome': '{outcome}',
  'row.duration': '{ms} ms',
  'row.reason': '原因 {code}',

  'route.empty': '这次会话没有改动任何文件。',
  'route.edits': '{edits} 次编辑',
  'route.writes': '{writes} 次写入',
  'route.reads': '{reads} 次读取',
  'cargo.empty': '没有工具调用记录。',
  'cargo.calls': '{count} 次',
  'cargo.errors': '{count} 次失败',
  'conditions.noModel': '没有模型回复记录。',
  'conditions.messages': '{count} 条回复',

  'note.redacted': '已自动脱敏 {count} 处敏感信息',
  'note.redactedKinds': '涉及的类型：{kinds}',
  'note.redactOff': '配置里关闭了自动脱敏',
  'note.truncated': '部分轮次事件太多，已截断',
  'note.local': '全部数据只在本机处理，没有上传任何内容。',
  'note.cost': '用量是从日志里数出来的，没有估算费用。',

  'export.title': '导出报告',
  'export.hint': '报告在你的浏览器里生成，断网也能打开。',
  'export.version': '详细程度',
  'export.full': '完整（含工具和文件）',
  'export.brief': '摘要（只看关键事件）',
  'export.include': '包含',
  'export.includeTools': '工具调用',
  'export.includeFiles': '文件变更',
  'export.redact': '附上脱敏说明',
  'export.reportTitle': '航海日志 · {title}',
  'export.reportMeta': '由 dsh-voyage-log 在 {time} 生成 · 共 {events} 条原始事件 · 数据只在本机处理',
  'export.redactHead': '本报告已自动脱敏 {count} 处敏感信息。',
  'export.redactHeadOff': '这份报告没有开启自动脱敏。',
  'export.noData': '还没有可导出的数据。',
} satisfies Record<string, string>

export type VoyageKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'dsh-voyage-log': VoyageKey }
}

export const en = {
  'view.label': 'Voyage Log',

  'hero.badge': 'DSH session log',
  'hero.generated': 'Updated {time}',
  'hero.throughSeq': 'Through event #{seq}',

  'state.loading': 'Reading this session’s log…',
  'state.empty': 'This session has no events to show yet.',
  'state.error': 'Could not read the log: {message}',
  'state.noSession': 'No session is open. Open a conversation to see its log.',
  'state.notMounted': 'The plugin’s background service is not connected yet. Try again in a moment.',
  'state.stale': 'Updated {time}; the latest turns may be missing.',

  'action.refresh': 'Refresh',
  'action.refreshing': 'Reading…',
  'action.copy': 'Copy summary',
  'action.copied': 'Summary copied',
  'action.copyFailed': 'Copy failed, select manually',
  'action.export': 'Export report',
  'action.download': 'Download HTML',
  'action.downloaded': 'Report saved to your downloads',
  'action.print': 'Print',
  'action.close': 'Close',
  'action.expand': 'Expand',
  'action.collapse': 'Collapse',

  'filter.title': 'Show',
  'filter.key': 'Key events',
  'filter.tools': 'Tool calls',
  'filter.files': 'File changes',
  'filter.hiddenAll': 'No events under the current filter — open more categories.',

  'section.readings': 'Key numbers',
  'section.timeline': 'Timeline',
  'section.route': 'Files',
  'section.cargo': 'Tools',
  'section.conditions': 'Models & usage',
  'section.todos': 'Task list',

  'metric.turns': 'Turns',
  'metric.steps': 'Steps',
  'metric.toolCalls': 'Tool calls',
  'metric.toolErrors': 'Failed calls',
  'metric.filesChanged': 'Files changed',
  'metric.filesRead': 'Files read',
  'metric.approvals': 'Approvals',
  'metric.retries': 'Model retries',
  'metric.compactions': 'Compactions',
  'metric.rawEvents': 'Raw events',
  'metric.duration': 'Total time',
  'metric.tokenIn': 'Input tokens',
  'metric.tokenOut': 'Output tokens',
  'metric.cacheRead': 'Cache read',

  'meta.cwd': 'Workspace',
  'meta.preset': 'Agent preset',
  'meta.startedAt': 'Started',
  'meta.session': 'Session ID',
  'meta.models': 'Models',
  'meta.tokens': 'Usage',

  'turn.leg': 'Turn {index}',
  'turn.open': 'in progress',
  'turn.completed': 'completed',
  'turn.error': 'error',
  'turn.aborted': 'interrupted',
  'turn.steps': '{count} steps',
  'turn.tools': '{count} tool calls',
  'turn.files': '{count} files changed',
  'turn.capped': 'This turn had too many events; only the beginning is shown',
  'turn.empty': 'This turn has no events to show.',

  'row.user': 'You',
  'row.assistant': 'Reply',
  'row.tool': 'Tool',
  'row.file': 'File',
  'row.approval': 'Approval',
  'row.retry': 'Retry',
  'row.compaction': 'Compaction',
  'row.turn-end': 'Turn end',
  'row.noResult': 'no result returned',
  'row.outcome': '{outcome}',
  'row.duration': '{ms} ms',
  'row.reason': 'reason {code}',

  'route.empty': 'This session did not change any files.',
  'route.edits': '{edits} edits',
  'route.writes': '{writes} writes',
  'route.reads': '{reads} reads',
  'cargo.empty': 'No tool calls recorded.',
  'cargo.calls': '{count} calls',
  'cargo.errors': '{count} failed',
  'conditions.noModel': 'No model replies recorded.',
  'conditions.messages': '{count} replies',

  'note.redacted': 'Automatically redacted {count} sensitive spans',
  'note.redactedKinds': 'Types redacted: {kinds}',
  'note.redactOff': 'Automatic redaction is turned off in settings',
  'note.truncated': 'Some turns had too many events and were cut short',
  'note.local': 'All data stayed on this machine; nothing was uploaded.',
  'note.cost': 'Usage is counted from the log; no cost is estimated.',

  'export.title': 'Export report',
  'export.hint': 'The report is built in your browser and opens offline.',
  'export.version': 'Detail',
  'export.full': 'Full (tools and files)',
  'export.brief': 'Brief (key events only)',
  'export.include': 'Include',
  'export.includeTools': 'Tool calls',
  'export.includeFiles': 'File changes',
  'export.redact': 'Include the redaction note',
  'export.reportTitle': 'Voyage Log · {title}',
  'export.reportMeta': 'Built by dsh-voyage-log at {time} · {events} raw events · processed locally',
  'export.redactHead': 'This report automatically redacted {count} sensitive spans.',
  'export.redactHeadOff': 'Automatic redaction was turned off for this report.',
  'export.noData': 'Nothing to export yet.',
} satisfies Record<VoyageKey, string>

export const NS = 'dsh-voyage-log'

/** Namespace-bound translate function; params fill `{name}` slots. */
export type Translate = TranslateNS<typeof NS>

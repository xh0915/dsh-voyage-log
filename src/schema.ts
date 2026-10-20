/**
 * dsh-voyage-log — The single wire authority.
 *
 * Every value that crosses the host/client Remote boundary is declared here as
 * a strict Zod schema, and the TypeScript types are inferred from those schemas,
 * so the host fold, the Typert descriptors, and the browser view can never drift.
 * The browser half imports these types with `import type`, so Zod stays on the
 * host side at runtime.
 */
import { z } from 'zod'

/** Token readings accumulated from `assistant/message` usage blocks. */
export const TokenUsageSchema = z.object({
  input: z.number().int().min(0),
  output: z.number().int().min(0),
  cacheRead: z.number().int().min(0),
}).readonly()
export type TokenUsage = z.infer<typeof TokenUsageSchema>

/**
 * One folded row on the voyage timeline.
 * Flat on purpose: every field is optional except the three that position the
 * row, so adding a new signal never forks the schema into a union.
 */
export const VoyageEventSchema = z.object({
  /** Filter class: `key` narrative rows, `tool` calls, or `file` cargo. */
  cat: z.enum(['key', 'tool', 'file']),
  /** What the row is: user | assistant | tool | file | approval | retry | compaction | turn-end. */
  kind: z.enum(['user', 'assistant', 'tool', 'file', 'approval', 'retry', 'compaction', 'turn-end']),
  /** Raw log seq of the source event — the row's stable ordering key. */
  seq: z.number().int().min(0),
  /** Source event timestamp, Unix epoch ms. */
  time: z.number().int().min(0),
  /** Tool name (`tool`/`file` rows) or the tool an approval asked about. */
  name: z.string().max(60).optional(),
  /** Workspace path for `file` rows. */
  path: z.string().max(400).optional(),
  /** File operation carried by a `file` row. */
  op: z.enum(['edit', 'write', 'read']).optional(),
  /** One-line readout shown in the row. */
  summary: z.string().max(600).optional(),
  /** Secondary line: arguments preview or result excerpt, already redacted. */
  detail: z.string().max(600).optional(),
  /** Message body for `user`/`assistant` rows, redacted and length-capped. */
  text: z.string().max(1200).optional(),
  /** Wall time the tool held the deck, ms. */
  durationMs: z.number().int().min(0).optional(),
  /** Failure line, redacted. */
  error: z.string().max(300).optional(),
  /** Turn closing reason or an approval's raised reason. */
  reason: z.string().max(300).optional(),
  /** Approval outcome. */
  outcome: z.string().max(40).optional(),
  /** Provider behind a retry row. */
  provider: z.string().max(40).optional(),
}).readonly()
export type VoyageEvent = z.infer<typeof VoyageEventSchema>

/** One conversation turn folded into a leg of the voyage. */
export const VoyageTurnSchema = z.object({
  index: z.number().int().min(0),
  startedAt: z.number().int().min(0),
  endedAt: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0),
  reason: z.enum(['completed', 'error', 'aborted', 'open']).optional(),
  error: z.string().max(300).optional(),
  /** First user prompt of the leg, redacted and capped. */
  prompt: z.string().max(1200),
  steps: z.number().int().min(0),
  toolCalls: z.number().int().min(0),
  filesChanged: z.number().int().min(0),
  tokens: TokenUsageSchema,
  events: z.array(VoyageEventSchema),
  /** True when this leg exceeded the per-leg event cap. */
  capped: z.boolean(),
}).readonly()
export type VoyageTurn = z.infer<typeof VoyageTurnSchema>

/** Aggregate counters for the voyage hero strip. */
export const VoyageCountsSchema = z.object({
  turns: z.number().int().min(0),
  steps: z.number().int().min(0),
  assistantMessages: z.number().int().min(0),
  userMessages: z.number().int().min(0),
  toolCalls: z.number().int().min(0),
  toolErrors: z.number().int().min(0),
  filesChanged: z.number().int().min(0),
  filesRead: z.number().int().min(0),
  approvals: z.number().int().min(0),
  retries: z.number().int().min(0),
  compactions: z.number().int().min(0),
  /** Raw log events the fold walked, including streaming chunks. */
  rawEvents: z.number().int().min(0),
}).readonly()
export type VoyageCounts = z.infer<typeof VoyageCountsSchema>

/** A model that steered part of the voyage. */
export const VoyageModelSchema = z.object({
  provider: z.string().max(40),
  model: z.string().max(80),
  messages: z.number().int().min(0),
}).readonly()
export type VoyageModel = z.infer<typeof VoyageModelSchema>

/** Per-tool call distribution. */
export const VoyageToolSchema = z.object({
  name: z.string().max(60),
  calls: z.number().int().min(0),
  errors: z.number().int().min(0),
  totalMs: z.number().int().min(0),
}).readonly()
export type VoyageTool = z.infer<typeof VoyageToolSchema>

/** Per-file cargo row. */
export const VoyageFileSchema = z.object({
  path: z.string().max(400),
  edits: z.number().int().min(0),
  writes: z.number().int().min(0),
  reads: z.number().int().min(0),
  lastTurn: z.number().int().min(0),
}).readonly()
export type VoyageFile = z.infer<typeof VoyageFileSchema>

/** A todo item off the latest `todo/write`. */
export const VoyageTodoSchema = z.object({
  content: z.string().max(300),
  status: z.string().max(24),
}).readonly()
export type VoyageTodo = z.infer<typeof VoyageTodoSchema>

/** What the redactor touched. */
export const VoyageRedactionSchema = z.object({
  /** Number of secret-shaped spans replaced. */
  count: z.number().int().min(0),
  /** Distinct rule families that fired, e.g. `provider-key`. */
  kinds: z.array(z.string().max(40)),
  /** Whether redaction was on at all (plugin config). */
  enabled: z.boolean(),
}).readonly()
export type VoyageRedaction = z.infer<typeof VoyageRedactionSchema>

/** The whole voyage report returned by the host fold. */
export const VoyageLogSchema = z.object({
  sessionId: z.string().min(1).max(200),
  title: z.string().max(200),
  cwd: z.string().max(400),
  agentPreset: z.string().max(40),
  startedAt: z.number().int().min(0),
  endedAt: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  generatedAt: z.number().int().min(0),
  /** Last raw-log seq folded; lets the view tell staleness honestly. */
  throughSeq: z.number().int().min(0),
  counts: VoyageCountsSchema,
  tokens: TokenUsageSchema,
  models: z.array(VoyageModelSchema),
  tools: z.array(VoyageToolSchema),
  files: z.array(VoyageFileSchema),
  turns: z.array(VoyageTurnSchema),
  todos: z.array(VoyageTodoSchema),
  redaction: VoyageRedactionSchema,
  /** True when any leg or field was capped by the fold. */
  truncated: z.boolean(),
}).readonly()
export type VoyageLog = z.infer<typeof VoyageLogSchema>

import type {
  ContextBreakdown,
  ContextCategoryKey,
  ContextCategoryPart,
  ContextPressure,
  ContextTimingSummary,
  ContextTimelineProjection,
  ContextViewModel,
  TokenUsageProjection,
} from '../shared/types.ts'

/** Palette mirrors dsh-context category hues with hex fallbacks for hosts without Tailwind color tokens. */
const CATEGORY_META: ReadonlyArray<{ key: ContextCategoryKey; color: string }> = [
  { key: 'system', color: 'var(--color-indigo-500, #6366f1)' },
  { key: 'tools', color: 'var(--color-amber-500, #f59e0b)' },
  { key: 'user', color: 'var(--color-green-500, #22c55e)' },
  { key: 'inject', color: 'var(--color-purple-500, #a855f7)' },
  { key: 'skill', color: 'var(--color-orange-500, #f97316)' },
  { key: 'assistant', color: 'var(--color-blue-500, #3b82f6)' },
  { key: 'tool', color: 'var(--color-teal-500, #14b8a6)' },
  { key: 'messages', color: 'var(--color-green-500, #22c55e)' },
  { key: 'thinking', color: 'var(--color-violet-500, #8b5cf6)' },
  { key: 'answers', color: 'var(--color-pink-500, #ec4899)' },
  { key: 'free', color: 'color-mix(in srgb, currentColor 14%, transparent)' },
  { key: 'compactionReserve', color: 'var(--color-slate-400, #94a3b8)' },
]

const MESSAGE_KEYS = ['user', 'inject', 'skill', 'assistant', 'tool'] as const
const COMPACTION_HEADROOM = 65_536

export function buildContextView(input: {
  pressure?: ContextPressure
  breakdown?: ContextBreakdown
  usage?: TokenUsageProjection
  timeline?: ContextTimelineProjection
}): ContextViewModel {
  const pressure = sanitizePressure(input.pressure)
  const breakdown = sanitizeBreakdown(input.breakdown)
  const usage = sanitizeUsage(input.usage)
  const timeline = sanitizeTimeline(input.timeline)

  if (timeline) {
    return fromTimeline(timeline, pressure, breakdown, usage)
  }
  return fromMeter(pressure, breakdown, usage)
}

function fromTimeline(
  timeline: ContextTimelineProjection,
  pressure: ContextPressure | undefined,
  breakdown: ContextBreakdown | undefined,
  usage: TokenUsageProjection | undefined,
): ContextViewModel {
  const current = timeline.current!
  const projected = finite(pressure?.projectedTokens)
  const pressureTokens = finite(pressure?.pressureTokens)
  const last = timeline.last
  const lastRequest = timeline.requests?.length ? timeline.requests[timeline.requests.length - 1] : undefined
  const promptAnchor = last ?? lastRequest
  const reconstructed = promptAnchor && finite(promptAnchor.prompt) !== undefined
    ? finite(promptAnchor.prompt)! + (finite(current.total) ?? 0) - (finite(promptAnchor.total) ?? 0)
    : undefined
  const used = projected ?? pressureTokens ?? reconstructed ?? finite(current.total) ?? 0
  const window = finite(pressure?.contextWindow) ?? finite(timeline.contextWindow)
  const parts = scaleParts(distributeTimelineParts(current, breakdown), used > 0 ? used : null)
  const free = window !== undefined ? Math.max(0, window - used) : undefined
  if (free !== undefined && free > 0) parts.push(part('free', free))

  const reserve = compactionReserve(window, timeline.maxOutputTokens)
  const unavailable = unavailableClaudeExtras({
    mode: 'timeline',
    hasCompactionReserve: !!reserve,
  })

  return {
    source: 'timeline',
    used,
    window,
    pct: window && window > 0 ? clampPct(used / window * 100) : undefined,
    estimated: pressureTokens === undefined,
    parts: parts.filter(p => p.tokens > 0 || p.key === 'free'),
    categories: categoryRows(parts, used, window),
    unavailable,
    timing: timingSummary(timeline.timing),
    usage,
    model: timeline.model,
    provider: timeline.provider,
    assistantDetail: {
      reasoning: finite(current.assistantReasoning),
      answers: finite(current.assistantAnswerTokens),
      calls: finite(current.assistantCallTokens),
    },
    compactionReserve: reserve,
  }
}

function fromMeter(
  pressure: ContextPressure | undefined,
  breakdown: ContextBreakdown | undefined,
  usage: TokenUsageProjection | undefined,
): ContextViewModel {
  const projected = finite(pressure?.projectedTokens)
  const pressureTokens = finite(pressure?.pressureTokens)
  const used = pressureTokens ?? projected
  const window = finite(pressure?.contextWindow)
  const parts: ContextCategoryPart[] = []
  if (breakdown) {
    if (finite(breakdown.systemTokens) !== undefined) parts.push(part('system', breakdown.systemTokens!))
    if (finite(breakdown.toolsTokens) !== undefined) parts.push(part('tools', breakdown.toolsTokens!))
    if (finite(breakdown.messageTokens) !== undefined) parts.push(part('messages', breakdown.messageTokens!))
  }
  const free = used !== undefined && window !== undefined ? Math.max(0, window - used) : undefined
  if (free !== undefined && free > 0) parts.push(part('free', free))
  const reserve = compactionReserve(window, undefined)

  return {
    source: used !== undefined || breakdown ? 'meter' : 'none',
    used,
    window,
    pct: used !== undefined && window && window > 0 ? clampPct(used / window * 100) : undefined,
    estimated: pressureTokens === undefined && (projected !== undefined || !!breakdown),
    parts: parts.filter(p => p.tokens > 0 || p.key === 'free'),
    categories: categoryRows(parts, used ?? sumParts(parts.filter(p => p.key !== 'free')), window),
    unavailable: unavailableClaudeExtras({
      mode: 'meter',
      hasCompactionReserve: !!reserve,
      hasMessages: !!breakdown && finite(breakdown.messageTokens) !== undefined,
    }),
    usage,
    compactionReserve: reserve,
  }
}

function distributeTimelineParts(
  current: NonNullable<ContextTimelineProjection['current']>,
  breakdown: ContextBreakdown | undefined,
): ContextCategoryPart[] {
  const messageTotal = MESSAGE_KEYS.reduce((sum, key) => sum + (finite(current[key]) ?? 0), 0)
  const system = finite(breakdown?.systemTokens) ?? finite(current.system) ?? 0
  const tools = finite(breakdown?.toolsTokens) ?? finite(current.tools) ?? 0
  const messageBudget = finite(breakdown?.messageTokens) ?? messageTotal
  const values: Partial<Record<ContextCategoryKey, number>> = { system, tools }

  if (messageTotal > 0 && messageBudget > 0) {
    let allocated = 0
    let dominant: typeof MESSAGE_KEYS[number] = 'user'
    for (const key of MESSAGE_KEYS) {
      const share = Math.round(messageBudget * ((finite(current[key]) ?? 0) / messageTotal))
      values[key] = share
      allocated += share
      if ((finite(current[key]) ?? 0) > (finite(current[dominant]) ?? 0)) dominant = key
    }
    values[dominant] = Math.max(0, (values[dominant] ?? 0) + messageBudget - allocated)
  } else {
    for (const key of MESSAGE_KEYS) values[key] = 0
  }

  return CATEGORY_META
    .filter(meta => meta.key !== 'messages' && meta.key !== 'free' && meta.key !== 'compactionReserve' && meta.key !== 'thinking' && meta.key !== 'answers')
    .map(meta => part(meta.key, values[meta.key] ?? 0))
}

function scaleParts(parts: ContextCategoryPart[], target: number | null): ContextCategoryPart[] {
  if (target === null || target <= 0) return parts.map(p => ({ ...p, raw: p.tokens }))
  const total = parts.reduce((sum, p) => sum + p.tokens, 0)
  if (total <= 0) return parts.map(p => ({ ...p, raw: p.tokens }))
  if (total === target) return parts.map(p => ({ ...p, raw: p.tokens }))
  const scale = target / total
  return parts.map(p => ({ ...p, raw: p.tokens, tokens: Math.round(p.tokens * scale) }))
}

function categoryRows(parts: ContextCategoryPart[], used: number | undefined, window: number | undefined): ContextCategoryPart[] {
  const base = used && used > 0 ? used : sumParts(parts.filter(p => p.key !== 'free'))
  return parts.map(p => ({
    ...p,
    shareOfUsed: p.key === 'free' || !base ? undefined : p.tokens / base * 100,
    shareOfWindow: window && window > 0 ? p.tokens / window * 100 : undefined,
  }))
}

function unavailableClaudeExtras(flags: {
  mode: 'timeline' | 'meter'
  hasCompactionReserve: boolean
  hasMessages?: boolean
}): ContextCategoryKey[] {
  // Claude-style rows that have no dedicated DSH/session field in the active source.
  const missing: ContextCategoryKey[] = ['mcp', 'memory']
  if (flags.mode === 'meter') missing.push('skill')
  if (flags.mode === 'meter' && !flags.hasMessages) missing.push('messages')
  if (!flags.hasCompactionReserve) missing.push('compactionReserve')
  return missing
}

function compactionReserve(window: number | undefined, maxOutputTokens: number | undefined): number | undefined {
  if (window === undefined || !(window > 0)) return undefined
  const output = Math.min(finite(maxOutputTokens) ?? 0, window)
  const remainder = window - output - COMPACTION_HEADROOM
  if (remainder <= 0) return undefined
  return COMPACTION_HEADROOM
}

function timingSummary(timing: ContextTimelineProjection['timing']): ContextTimingSummary | undefined {
  if (!timing) return undefined
  const wallMs = finite(timing.wallMs)
  const toolsMs = finite(timing.toolsMs)
  const genMs = finite(timing.genMs)
  const ttftMs = finite(timing.ttftMs)
  const speedTokens = finite(timing.speedTokens)
  const speedMs = finite(timing.speedMs)
  const tokensPerSecond = speedTokens !== undefined && speedMs && speedMs > 0
    ? speedTokens / (speedMs / 1000)
    : undefined
  if ([wallMs, toolsMs, genMs, ttftMs, tokensPerSecond].every(v => v === undefined)) return undefined
  return { wallMs, toolsMs, genMs, ttftMs, tokensPerSecond }
}

function part(key: ContextCategoryKey, tokens: number): ContextCategoryPart {
  const color = CATEGORY_META.find(item => item.key === key)?.color ?? 'var(--color-slate-400, #94a3b8)'
  return { key, tokens: Math.max(0, tokens), color }
}

function sanitizePressure(value: ContextPressure | undefined): ContextPressure | undefined {
  if (!value || typeof value !== 'object') return undefined
  const next: ContextPressure = {}
  if (finite(value.pressureTokens) !== undefined) next.pressureTokens = value.pressureTokens
  if (finite(value.projectedTokens) !== undefined) next.projectedTokens = value.projectedTokens
  if (finite(value.contextWindow) !== undefined) next.contextWindow = value.contextWindow
  return Object.keys(next).length ? next : undefined
}

function sanitizeBreakdown(value: ContextBreakdown | undefined): ContextBreakdown | undefined {
  if (!value || typeof value !== 'object') return undefined
  const next: ContextBreakdown = {}
  if (finite(value.systemTokens) !== undefined) next.systemTokens = value.systemTokens
  if (finite(value.toolsTokens) !== undefined) next.toolsTokens = value.toolsTokens
  if (finite(value.messageTokens) !== undefined) next.messageTokens = value.messageTokens
  return Object.keys(next).length ? next : undefined
}

function sanitizeUsage(value: TokenUsageProjection | undefined): TokenUsageProjection | undefined {
  if (!value || typeof value !== 'object') return undefined
  const next: TokenUsageProjection = {}
  if (finite(value.uncachedInputTokens) !== undefined) next.uncachedInputTokens = value.uncachedInputTokens
  if (finite(value.outputTokens) !== undefined) next.outputTokens = value.outputTokens
  if (finite(value.cacheReadTokens) !== undefined) next.cacheReadTokens = value.cacheReadTokens
  if (finite(value.cacheWriteTokens) !== undefined) next.cacheWriteTokens = value.cacheWriteTokens
  return Object.keys(next).length ? next : undefined
}

function sanitizeTimeline(value: ContextTimelineProjection | undefined): ContextTimelineProjection | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value.current
  if (!raw || typeof raw !== 'object') return undefined
  const current = {
    system: finite(raw.system) ?? 0,
    tools: finite(raw.tools) ?? 0,
    user: finite(raw.user) ?? 0,
    inject: finite(raw.inject) ?? 0,
    skill: finite(raw.skill) ?? 0,
    assistant: finite(raw.assistant) ?? 0,
    assistantReasoning: finite(raw.assistantReasoning),
    assistantAnswerTokens: finite(raw.assistantAnswerTokens),
    assistantCallTokens: finite(raw.assistantCallTokens),
    tool: finite(raw.tool) ?? 0,
    total: finite(raw.total) ?? 0,
  }
  return {
    ...value,
    current,
    contextWindow: finite(value.contextWindow),
    maxOutputTokens: finite(value.maxOutputTokens),
    model: typeof value.model === 'string' ? value.model : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined,
  }
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

function sumParts(parts: ContextCategoryPart[]): number {
  return parts.reduce((sum, part) => sum + part.tokens, 0)
}

export function hasProviderUsage(usage: TokenUsageProjection | undefined): boolean {
  if (!usage) return false
  return [usage.uncachedInputTokens, usage.cacheReadTokens, usage.cacheWriteTokens, usage.outputTokens]
    .some(value => finite(value) !== undefined)
}

export function formatTokens(value: unknown): string {
  const number = finite(value)
  return number === undefined ? '—' : Intl.NumberFormat().format(number)
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

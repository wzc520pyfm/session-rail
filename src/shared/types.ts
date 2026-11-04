/** Read-only workspace snapshot resolved by the Host for one DSH Session. */
export interface SessionSnapshot {
  sessionId: string
  /** Whether the Host can deliver a follow-up to this Session's active Agent. */
  followupAvailable?: boolean
  cwd?: string
  branch?: string
  repositoryStatus: RepositoryStatus
  changedFiles: ChangedFile[]
  /** Host-internal repository root; stripped from API responses. */
  repoRoot?: string
}

export interface CommitRequestResult {
  accepted: true
}

export type RepositoryStatus =
  | 'available'
  | 'no-cwd'
  | 'directory-missing'
  | 'not-repository'
  | 'unavailable'

export type ChangedFileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted'

export interface ChangedFile {
  path: string
  status: ChangedFileStatus
  staged: boolean
  unstaged: boolean
  additions: number
  deletions: number
  binary: boolean
}

export interface UnifiedDiffLine {
  kind: 'header' | 'hunk' | 'addition' | 'deletion' | 'context' | 'meta'
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface FileDiff {
  path: string
  binary: boolean
  lines?: UnifiedDiffLine[]
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface ApiEnvelope<T> {
  ok: true
  data: T
}

export interface ApiErrorEnvelope {
  ok: false
  error: ApiError
}

/** DSH token-meter projection values are optional across compositions/versions. */
export interface ContextPressure {
  pressureTokens?: number
  projectedTokens?: number
  contextWindow?: number
}

export interface ContextBreakdown {
  systemTokens?: number
  toolsTokens?: number
  messageTokens?: number
}

/** DSH tokenUsage projection; counters may be absent independently. */
export interface TokenUsageProjection {
  uncachedInputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** Fine-grained occupancy categories (native meter + optional dsh-context timeline). */
export type ContextCategoryKey =
  | 'system'
  | 'tools'
  | 'user'
  | 'inject'
  | 'skill'
  | 'assistant'
  | 'tool'
  | 'messages'
  | 'thinking'
  | 'answers'
  | 'free'
  | 'compactionReserve'
  | 'mcp'
  | 'memory'

export interface ContextCategoryPart {
  key: ContextCategoryKey
  tokens: number
  color: string
  raw?: number
  shareOfUsed?: number
  shareOfWindow?: number
}

/** Optional projection published by dsh-context when that plugin is installed. */
export interface ContextTimelineProjection {
  model?: string
  provider?: string
  contextWindow?: number
  maxOutputTokens?: number
  current?: {
    system?: number
    tools?: number
    user?: number
    inject?: number
    skill?: number
    assistant?: number
    assistantReasoning?: number
    assistantAnswerTokens?: number
    assistantCallTokens?: number
    tool?: number
    total?: number
  }
  last?: { seq?: number; total?: number; prompt?: number }
  requests?: Array<{ prompt?: number; total?: number }>
  timing?: {
    wallMs?: number
    ttftMs?: number
    genMs?: number
    toolsMs?: number
    speedTokens?: number
    speedMs?: number
  }
}

export interface ContextTimingSummary {
  wallMs?: number
  toolsMs?: number
  genMs?: number
  ttftMs?: number
  tokensPerSecond?: number
}

export interface ContextViewModel {
  source: 'timeline' | 'meter' | 'none'
  used?: number
  window?: number
  pct?: number
  estimated: boolean
  parts: ContextCategoryPart[]
  categories: ContextCategoryPart[]
  unavailable: ContextCategoryKey[]
  timing?: ContextTimingSummary
  usage?: TokenUsageProjection
  model?: string
  provider?: string
  assistantDetail?: {
    reasoning?: number
    answers?: number
    calls?: number
  }
  compactionReserve?: number
}

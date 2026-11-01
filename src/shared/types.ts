/** Read-only workspace snapshot resolved by the Host for one DSH Session. */
export interface SessionSnapshot {
  sessionId: string
  cwd?: string
  branch?: string
  repositoryStatus: RepositoryStatus
  changedFiles: ChangedFile[]
  /** Host-internal repository root; stripped from API responses. */
  repoRoot?: string
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

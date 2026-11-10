/** Official `ctx.jobs` / `subagentCatalog` shapes used by the Background tasks card. */

export const KILL_ARM_MS = 3000

export type JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed'

export interface JobView {
  readonly id: string
  readonly kind: string
  readonly label: string
  readonly owner?: string
  readonly status: JobStatus
  readonly progress?: string
  readonly detail?: string
  readonly startedAt: number
  readonly finishedAt?: number
}

export interface JobsSnapshot {
  readonly rows: Readonly<Record<string, readonly JobView[]>>
}

export interface JobsKillValue {
  readonly outcome: 'requested' | 'already-finished'
}

export type JobsKillResult =
  | { readonly ok: true; readonly value?: JobsKillValue }
  | { readonly ok: false; readonly error?: { readonly message?: string; readonly code?: string } }

export interface JobsClient {
  readonly state: { getSnapshot(): JobsSnapshot; subscribe(listener: () => void): () => void }
  watchRows(sessionId: string): () => void
  kill(sessionId: string, id: string): Promise<JobsKillResult>
}

export type SubagentMode = 'one-shot' | 'external' | 'continuable' | 'unknown'

export interface SubagentCatalogEntry {
  readonly id: string
  readonly createdAt: number
  readonly mode: SubagentMode
  readonly label?: string
}

export interface SubagentTimingProjection {
  settledMs: number
  active?: { since: number; through: number }
  lastTurnCompleted?: boolean
}

export interface SessionSummaryLike {
  readonly id: string
  readonly displayTitle?: string
  readonly title?: string
  readonly running?: boolean
  readonly updatedAt?: number
}

export interface SessionProjectionSnapshotLike {
  readonly values?: Readonly<Record<string, unknown>>
  readonly state?: 'idle' | 'loading' | 'ready' | 'migration-required' | 'error'
  readonly error?: { message?: string; code?: string } | null
}

export interface SessionListStateLike {
  readonly byId?: Readonly<Record<string, SessionSummaryLike>>
  readonly projectionsBySession?: Readonly<Record<string, SessionProjectionSnapshotLike>>
}

export interface SessionStatusLike {
  readonly running?: boolean
}

export type CatalogRead =
  | { readonly status: 'ready'; readonly entries: readonly SubagentCatalogEntry[] }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'migration-required'; readonly entries: readonly SubagentCatalogEntry[] }
  | { readonly status: 'absent' }

export function isJobLive(status: JobStatus): boolean {
  return status === 'running' || status === 'stopping'
}

export function jobsForSession(snapshot: JobsSnapshot | undefined, sessionId: string): readonly JobView[] {
  if (!snapshot || !sessionId) return []
  const rows = snapshot.rows[sessionId]
  return Array.isArray(rows) ? rows : []
}

/** Compact elapsed label in the Claude-like 11s / 3m 05s style. */
export function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const s = sec % 60
  if (min < 60) return s > 0 ? `${min}m ${String(s).padStart(2, '0')}s` : `${min}m`
  const hr = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${hr}h ${m}m` : `${hr}h`
}

export function jobElapsedMs(job: JobView, now: number): number {
  const end = isJobLive(job.status) ? now : (job.finishedAt ?? now)
  return Math.max(0, end - job.startedAt)
}

export function isLocalSubagentMode(mode: SubagentMode): mode is 'one-shot' | 'continuable' | 'unknown' {
  return mode === 'one-shot' || mode === 'continuable' || mode === 'unknown'
}

export function isCatalogEntry(value: unknown): value is SubagentCatalogEntry {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<SubagentCatalogEntry>
  return typeof row.id === 'string' && row.id.length > 0
    && typeof row.createdAt === 'number'
    && (row.mode === 'one-shot' || row.mode === 'external' || row.mode === 'continuable' || row.mode === 'unknown')
}

export function readSubagentCatalog(
  sessionId: string,
  projected: unknown,
  list: SessionListStateLike | undefined,
): CatalogRead {
  const snap = sessionId ? list?.projectionsBySession?.[sessionId] : undefined
  const fromSnap = Array.isArray(snap?.values?.subagentCatalog)
    ? (snap!.values!.subagentCatalog as unknown[]).filter(isCatalogEntry)
    : undefined
  const fromHook = Array.isArray(projected) ? projected.filter(isCatalogEntry) : undefined
  const entries = fromSnap ?? fromHook
  if (snap?.state === 'error') return { status: 'error' }
  if (snap?.state === 'migration-required') return { status: 'migration-required', entries: entries ?? [] }
  if (snap?.state === 'loading' && entries === undefined) return { status: 'loading' }
  if (entries !== undefined) return { status: 'ready', entries }
  if (snap?.state === 'ready' || snap?.state === 'idle') return { status: 'absent' }
  if (snap?.state === 'loading') return { status: 'loading' }
  return { status: 'absent' }
}

export interface SubagentRow {
  readonly id: string
  readonly title: string
  readonly mode: SubagentMode
  readonly running: boolean
  readonly elapsedMs: number
  readonly createdAt: number
}

export function subagentRows(
  entries: readonly SubagentCatalogEntry[],
  list: SessionListStateLike | undefined,
  statusById: ReadonlyMap<string, SessionStatusLike> | undefined,
  now: number,
): SubagentRow[] {
  return entries.map(entry => {
    const summary = list?.byId?.[entry.id]
    const timing = timingOf(list?.projectionsBySession?.[entry.id])
    const running = statusById?.get(entry.id)?.running ?? summary?.running ?? Boolean(timing?.active)
    const title = (typeof entry.label === 'string' && entry.label) || summary?.displayTitle || summary?.title || entry.id
    return { id: entry.id, title, mode: entry.mode, running, elapsedMs: subagentElapsedMs(entry, timing, running, now), createdAt: entry.createdAt }
  })
}

function timingOf(snapshot: SessionProjectionSnapshotLike | undefined): SubagentTimingProjection | undefined {
  const value = snapshot?.values?.subagentTiming
  if (!value || typeof value !== 'object') return undefined
  const timing = value as Partial<SubagentTimingProjection>
  if (typeof timing.settledMs !== 'number' || !Number.isFinite(timing.settledMs)) return undefined
  return timing as SubagentTimingProjection
}

function subagentElapsedMs(entry: SubagentCatalogEntry, timing: SubagentTimingProjection | undefined, running: boolean, now: number): number {
  if (timing) {
    const active = timing.active ? Math.max(0, now - timing.active.since) : 0
    return Math.max(0, timing.settledMs + active)
  }
  if (running) return Math.max(0, now - entry.createdAt)
  return 0
}

export function isKillSuccess(result: JobsKillResult | null | undefined): boolean {
  return Boolean(result && result.ok === true)
}

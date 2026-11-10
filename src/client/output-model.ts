import { changesSummaryUrl, normalizeWorkspacePath } from './addresses.ts'

/** One file record served by `/api/changes.summary`. */
export interface ChangesSummaryFile {
  path: string
  display: string
  added: number
  deleted: number
  binary?: true
  oversized?: true
}

/** Public fields of one Host-served `workspace/changes` summary. */
export interface ChangesSummary {
  turn: number
  files: ChangesSummaryFile[]
  total: number
  added: number
  deleted: number
}

export interface PresentedOutputFile {
  readonly path: string
  readonly description?: string
  readonly seq: number
  readonly index: number
}

/** Announcements folded from uiConversation for one turn, newest turns first in a snapshot. */
export interface OutputTurnRecord {
  readonly turn: number
  /** Latest `workspace/changes` event sequence for this turn, when one was announced. */
  readonly seq?: number
  readonly presented: readonly PresentedOutputFile[]
}

export interface OutputViewSnapshot {
  readonly turns: readonly OutputTurnRecord[]
}

export type SummaryState = ChangesSummary | 'missing' | 'loading' | 'error'

export const OUTPUT_VIEW_TARGET = 'sessionRailOutput'
const OUTPUT_KIND = 'session-rail-output'

interface SessionEventLike {
  type: string
  seq: number
  data: unknown
}

interface MatchResult {
  readonly id: string
  readonly role: 'start' | 'update'
}

interface OutputState {
  turn: number
  seq?: number
  presented: PresentedOutputFile[]
}

interface ViewNode {
  readonly key: string
  readonly kind: string
  readonly id: string
  readonly target: string
  readonly data: OutputTurnRecord
}

interface ConversationContext {
  readonly key: string
  readonly state?: OutputState
}

export interface ObservableSnapshotLike<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

export interface UiConversationLike {
  events: { register(definition: unknown): () => void }
  views: { register(definition: unknown): () => void }
  binding(sessionId: string): { target(name: string): ObservableSnapshotLike<OutputViewSnapshot | undefined> }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isChangesEvent(value: unknown): value is { turn: number } {
  return isRecord(value) && Number.isSafeInteger(value.turn) && (value.turn as number) >= 1
}

function isPresentedFile(value: unknown): value is { path: string; description?: string } {
  return isRecord(value)
    && typeof value.path === 'string'
    && value.path.length > 0
    && (value.description === undefined || typeof value.description === 'string')
}

function isPresentedData(value: unknown): value is { turn: number; files: unknown[] } {
  return isChangesEvent(value) && Array.isArray((value as { files?: unknown }).files)
}

export function isChangedFile(value: unknown): value is ChangesSummaryFile {
  if (!isRecord(value)) return false
  const { path, display, added, deleted, binary, oversized } = value
  return typeof path === 'string' && path.length > 0
    && typeof display === 'string'
    && Number.isSafeInteger(added)
    && Number.isSafeInteger(deleted)
    && (binary === undefined || binary === true)
    && (oversized === undefined || oversized === true)
}

export function isChangesSummary(value: unknown): value is ChangesSummary {
  if (!isRecord(value)) return false
  const { turn, files, total, added, deleted } = value
  return Number.isSafeInteger(turn) && (turn as number) >= 1
    && Number.isSafeInteger(total)
    && Number.isSafeInteger(added)
    && Number.isSafeInteger(deleted)
    && Array.isArray(files)
    && files.every(isChangedFile)
}

function applyPresented(state: OutputState, event: SessionEventLike): OutputState {
  if (!isPresentedData(event.data)) return state
  const next = [...state.presented]
  for (let index = 0; index < event.data.files.length; index++) {
    const file = event.data.files[index]
    if (!isPresentedFile(file)) continue
    const incoming: PresentedOutputFile = { path: file.path, description: file.description, seq: event.seq, index }
    const existing = next.findIndex(item => normalizeWorkspacePath(item.path) === normalizeWorkspacePath(file.path))
    if (existing >= 0) next[existing] = incoming
    else next.push(incoming)
  }
  return { ...state, presented: next }
}

function applyEvent(state: OutputState, event: SessionEventLike): OutputState {
  if (event.type === 'workspace/changes' && isChangesEvent(event.data)) {
    return { ...state, turn: event.data.turn, seq: event.seq }
  }
  if (event.type === 'deliverables/presented') return applyPresented({ ...state, turn: isChangesEvent(event.data) ? event.data.turn : state.turn }, event)
  return state
}

function turnOf(event: SessionEventLike): number {
  return isChangesEvent(event.data) ? event.data.turn : 0
}

/** Folds `workspace/changes` and `deliverables/presented` events through the public uiConversation registry. */
export const outputFilesDefinition = {
  kind: OUTPUT_KIND,
  target: OUTPUT_VIEW_TARGET,
  match(event: SessionEventLike): MatchResult | null {
    if (event.type === 'workspace/changes' && isChangesEvent(event.data)) {
      return { id: String(event.data.turn), role: 'start' }
    }
    if (event.type === 'deliverables/presented' && isPresentedData(event.data)) {
      return { id: String(event.data.turn), role: 'start' }
    }
    return null
  },
  start(_context: ConversationContext, match: { event: SessionEventLike }): OutputState {
    return applyEvent({ turn: turnOf(match.event), presented: [] }, match.event)
  },
  update(context: ConversationContext & { state: OutputState }, match: { event: SessionEventLike }): OutputState {
    return applyEvent(context.state, match.event)
  },
  buildViewNode(context: ConversationContext): ViewNode | null {
    const state = context.state
    if (!state || (state.seq === undefined && state.presented.length === 0)) return null
    return {
      key: context.key,
      kind: OUTPUT_KIND,
      id: String(state.turn),
      target: OUTPUT_VIEW_TARGET,
      data: { turn: state.turn, seq: state.seq, presented: state.presented },
    }
  },
}

function snapshotFromNodes(nodes: readonly { data: OutputTurnRecord }[]): OutputViewSnapshot {
  const byTurn = new Map<number, OutputTurnRecord>()
  for (const node of nodes) byTurn.set(node.data.turn, node.data)
  return { turns: [...byTurn.values()].sort((a, b) => b.turn - a.turn) }
}

/** View builder that publishes per-turn announcements, newest first. */
export const outputFilesView = {
  target: OUTPUT_VIEW_TARGET,
  create() {
    let nodes: Array<{ id: string; data: OutputTurnRecord }> = []
    return {
      empty: { turns: [] } satisfies OutputViewSnapshot,
      replace(input: { nodes: ReadonlyArray<{ id: string; data: OutputTurnRecord }> }) {
        nodes = [...input.nodes]
        return snapshotFromNodes(nodes)
      },
      apply(input: { upserts: ReadonlyArray<{ id: string; data: OutputTurnRecord }> }) {
        const map = new Map(nodes.map(node => [node.id, node]))
        for (const node of input.upserts) map.set(node.id, node)
        nodes = [...map.values()]
        return snapshotFromNodes(nodes)
      },
    }
  },
}

export function registerOutputFiles(ui: UiConversationLike | undefined): () => void {
  if (!ui?.events?.register || !ui?.views?.register) return () => undefined
  const disposeEvents = ui.events.register(outputFilesDefinition)
  const disposeView = ui.views.register(outputFilesView)
  return () => { disposeEvents(); disposeView() }
}

export function subscribeOutputTurns(
  ui: UiConversationLike | undefined,
  sessionId: string,
  onChange: (turns: readonly OutputTurnRecord[] | 'unavailable') => void,
): () => void {
  if (!ui?.binding || !sessionId) {
    onChange([])
    return () => undefined
  }
  try {
    const source = ui.binding(sessionId).target(OUTPUT_VIEW_TARGET)
    const sync = () => onChange(source.getSnapshot()?.turns ?? [])
    const unsubscribe = source.subscribe(sync)
    sync()
    return unsubscribe
  } catch {
    onChange('unavailable')
    return () => undefined
  }
}

/** Fetch one announced summary. 404 means the Host no longer has it (e.g. after restart). */
export async function loadChangesSummary(sessionId: string, seq: number, signal?: AbortSignal): Promise<Exclude<SummaryState, 'loading'>> {
  try {
    const response = await fetch(changesSummaryUrl(sessionId, seq), { method: 'GET', credentials: 'same-origin', signal })
    if (response.status === 404) return 'missing'
    if (!response.ok) return 'error'
    const value: unknown = await response.json()
    return isChangesSummary(value) ? value : 'error'
  } catch (error) {
    if (signal?.aborted) throw error
    return 'error'
  }
}

export function indexOfChangedPath(files: readonly ChangesSummaryFile[], path: string): number {
  const want = normalizeWorkspacePath(path)
  const exactPath = files.findIndex(file => normalizeWorkspacePath(file.path) === want)
  if (exactPath >= 0) return exactPath
  const exactDisplay = files.findIndex(file => normalizeWorkspacePath(file.display) === want)
  if (exactDisplay >= 0) return exactDisplay
  const suffix: number[] = []
  files.forEach((file, index) => {
    const candidate = normalizeWorkspacePath(file.path)
    const display = normalizeWorkspacePath(file.display)
    if (
      candidate.endsWith(`/${want}`) || want.endsWith(`/${candidate}`)
      || display.endsWith(`/${want}`) || want.endsWith(`/${display}`)
    ) suffix.push(index)
  })
  return suffix.length === 1 ? suffix[0]! : -1
}

/** Latest (newest-turn) `workspace/changes` entry whose summary lists this path. */
export function findLatestChangeMatch(
  path: string,
  turns: ReadonlyArray<{ turn: number; seq?: number; summary?: SummaryState }>,
): { turn: number; seq: number; index: number } | undefined {
  for (const turn of turns) {
    if (turn.seq === undefined || !turn.summary || typeof turn.summary === 'string') continue
    const index = indexOfChangedPath(turn.summary.files, path)
    if (index >= 0) return { turn: turn.turn, seq: turn.seq, index }
  }
  return undefined
}

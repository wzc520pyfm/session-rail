import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getSnapshot, requestCommit } from './api.ts'
import { changesReviewAddress, fileAddressFor } from './addresses.ts'
import { buildContextView, formatDuration, formatTokens, hasProviderUsage } from './context-model.ts'
import { t } from './i18n.ts'
import { findLatestChangeMatch, loadChangesSummary, subscribeOutputTurns, type OutputTurnRecord, type SummaryState, type UiConversationLike } from './output-model.ts'
import { ensureRailStyle } from './styles.ts'
import type { ChangedFile, ContextBreakdown, ContextCategoryKey, ContextCategoryPart, ContextPressure, ContextTimelineProjection, ContextViewModel, SessionSnapshot, TokenUsageProjection } from '../shared/types.ts'

interface PluginItem { moduleName?: string; entryId?: string; fiberPhase?: string | null; enabled?: boolean }
interface TabChoice { kind: string; title: string }
interface OpenResourceOptions { params?: { index?: number } }
interface Props {
  sessionId: string
  cwd?: string
  pressure?: ContextPressure
  breakdown?: ContextBreakdown
  usage?: TokenUsageProjection
  timeline?: ContextTimelineProjection
  loadPlugins?: () => Promise<PluginItem[]>
  activeTabs?: TabChoice[]
  openTab?: (kind: string) => unknown
  openResource?: (address: string, options?: OpenResourceOptions) => unknown
  uiConversation?: UiConversationLike
}

const REVIEW_KIND_STORAGE = 'session-rail:selected-review-kind'
const LEGACY_DEFAULT_KIND = 'codex-review'

export function RailPane(props: Props): React.ReactElement {
  const { sessionId, cwd, pressure, breakdown, usage, timeline, loadPlugins, activeTabs = [], openTab, openResource, uiConversation } = props
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [plugins, setPlugins] = useState<PluginItem[] | null>(null)
  const [pluginError, setPluginError] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [chosenKind, setChosenKind] = useState('')
  const [commitState, setCommitState] = useState<'idle' | 'sending' | 'queued' | 'error'>('idle')
  const commitInFlight = useRef(false)
  const [routeHint, setRouteHint] = useState<string | null>(null)
  const [outputTurns, setOutputTurns] = useState<readonly OutputTurnRecord[] | 'unavailable'>([])
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({})
  const [outputRevision, setOutputRevision] = useState(0)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REVIEW_KIND_STORAGE) ?? ''
      setChosenKind(saved === LEGACY_DEFAULT_KIND ? '' : saved)
      if (saved === LEGACY_DEFAULT_KIND) localStorage.removeItem(REVIEW_KIND_STORAGE)
    } catch { setChosenKind('') }
  }, [])
  useEffect(() => { ensureRailStyle() }, [])

  useEffect(() => {
    if (!sessionId) { setSnapshot(null); setLoading(false); return }
    const abort = new AbortController(); let active = true
    setLoading(true); setSnapshotError(null); setSnapshot(null)
    getSnapshot(sessionId, abort.signal).then(value => { if (active) setSnapshot(value) }).catch(error => { if (active && !abort.signal.aborted) setSnapshotError(error instanceof Error ? error.message : String(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; abort.abort() }
  }, [sessionId, revision])

  useEffect(() => {
    if (!loadPlugins) { setPlugins([]); setPluginError(false); return }
    let active = true
    loadPlugins().then(value => { if (active) { setPlugins(Array.isArray(value) ? value : []); setPluginError(false) } }).catch(() => { if (active) { setPluginError(true); setPlugins(null) } })
    return () => { active = false }
  }, [loadPlugins])

  useEffect(() => {
    setSummaries({})
    return subscribeOutputTurns(uiConversation, sessionId, value => {
      setOutputTurns(value)
    })
  }, [uiConversation, sessionId])

  useEffect(() => {
    if (!sessionId || outputTurns === 'unavailable') return
    const abort = new AbortController()
    const needed = outputTurns.filter(turn => turn.seq !== undefined)
    for (const turn of needed) {
      const seq = turn.seq!
      const key = summaryKey(sessionId, seq)
      setSummaries(current => current[key] === undefined ? { ...current, [key]: 'loading' } : current)
    }
    void Promise.all(needed.map(async turn => {
      const seq = turn.seq!
      const key = summaryKey(sessionId, seq)
      const existing = summaries[key]
      if (existing && existing !== 'loading' && existing !== 'error') return
      if (existing === 'error' && outputRevision === 0) return
      const value = await loadChangesSummary(sessionId, seq, abort.signal)
      setSummaries(current => (current[key] === value ? current : { ...current, [key]: value }))
    })).catch(() => undefined)
    return () => abort.abort()
    // summaries is read only to skip completed entries; outputRevision retriggers retryable errors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, outputTurns, outputRevision])

  const context = useMemo(
    () => buildContextView({ pressure, breakdown, usage, timeline }),
    [pressure, breakdown, usage, timeline],
  )
  const files = snapshot?.changedFiles ?? []
  const displayCwd = cwd ?? snapshot?.cwd
  const totals = files.reduce((sum, file) => ({ add: sum.add + file.additions, del: sum.del + file.deletions }), { add: 0, del: 0 })
  const normalizedTarget = chosenKind.trim()
  const targetExists = activeTabs.some(tab => tab.kind === normalizedTarget)
  const commitDisabledReason = !sessionId ? t('commitNoSession') : loading ? t('loading') : files.length === 0 ? t('commitNoFiles') : snapshot?.followupAvailable !== true ? t('commitNoAgent') : null
  const announcedTurns = outputTurns === 'unavailable' ? [] : outputTurns

  function persistKind(kind: string) {
    setChosenKind(kind)
    try {
      if (kind) localStorage.setItem(REVIEW_KIND_STORAGE, kind)
      else localStorage.removeItem(REVIEW_KIND_STORAGE)
    } catch { /* storage may be unavailable */ }
  }

  function tryOpenResource(address: string, options?: OpenResourceOptions): boolean {
    if (!openResource) return false
    try {
      openResource(address, options)
      return true
    } catch {
      return false
    }
  }

  async function ensureSummaries(): Promise<Array<OutputTurnRecord & { summary?: SummaryState }>> {
    if (!sessionId || outputTurns === 'unavailable') return []
    const resolved = await Promise.all(announcedTurns.map(async turn => {
      if (turn.seq === undefined) return { ...turn, summary: undefined as SummaryState | undefined }
      const key = summaryKey(sessionId, turn.seq)
      const standing = summaries[key]
      if (standing && standing !== 'loading') return { ...turn, summary: standing }
      const value = await loadChangesSummary(sessionId, turn.seq)
      setSummaries(current => (current[key] === value ? current : { ...current, [key]: value }))
      return { ...turn, summary: value }
    }))
    return resolved
  }

  async function openOfficialReview(path: string) {
    const loaded = await ensureSummaries()
    const match = findLatestChangeMatch(path, loaded)
    if (match) {
      if (tryOpenResource(changesReviewAddress({ sessionId, seq: match.seq, turn: match.turn }), { params: { index: match.index } })) return
      setRouteHint(t('openFailed'))
      return
    }
    if (tryOpenResource(fileAddressFor(sessionId, displayCwd, path))) return
    setRouteHint(t('openFailed'))
  }

  function selectWorkingTreeFile(path: string) {
    setRouteHint(null)
    if (normalizedTarget && openTab) {
      try {
        const result = openTab(normalizedTarget)
        if (result !== false) return
      } catch { /* fall through to the official review tab */ }
    }
    void openOfficialReview(path)
  }

  function selectChangedOutput(turn: number, seq: number, index: number) {
    setRouteHint(null)
    if (tryOpenResource(changesReviewAddress({ sessionId, seq, turn }), { params: { index } })) return
    setRouteHint(t('openFailed'))
  }

  function selectDeliveredOutput(path: string) {
    setRouteHint(null)
    if (tryOpenResource(fileAddressFor(sessionId, displayCwd, path))) return
    setRouteHint(t('openFailed'))
  }

  function toggle(key: string) { setCollapsed(value => ({ ...value, [key]: !value[key] })) }
  return <div className="dsr">
    <Card title={t('environment')} collapsed={!!collapsed.environment} onToggle={() => toggle('environment')}>
      {loading ? <Status>{t('loading')}</Status> : null}
      {!loading && !sessionId ? <Status>{t('noSession')}</Status> : null}
      {displayCwd ? <div className="dsr-row" title={displayCwd}><span aria-hidden="true">▱</span><span className="dsr-path"><strong>{basename(displayCwd)}</strong><span className="dsr-muted"> · {displayCwd}</span></span></div> : <div className="dsr-row dsr-muted">{t('noCwd')}</div>}
      {snapshot?.branch ? <div className="dsr-row dsr-branch"><span aria-hidden="true">⑂</span>{snapshot.branch}</div> : null}
      {snapshot && !snapshot.branch && snapshot.repositoryStatus === 'available' ? <div className="dsr-row dsr-muted">{t('noBranch')}</div> : null}
      {snapshotError ? <div className="dsr-row dsr-error">{snapshotError}</div> : null}
      {snapshot?.repositoryStatus === 'not-repository' ? <Status>{t('noRepo')}</Status> : null}
      {snapshot?.repositoryStatus === 'directory-missing' ? <Status>{t('missingDir')}</Status> : null}
      {snapshot?.repositoryStatus === 'unavailable' ? <Status>{t('gitUnavailable')}</Status> : null}
    </Card>
    <Card title={t('context')} collapsed={!!collapsed.context} onToggle={() => toggle('context')}>
      <ContextPanel view={context} />
    </Card>
    <Card title={t('plugins')} collapsed={!!collapsed.plugins} onToggle={() => toggle('plugins')}>
      {pluginError ? <Status>{t('pluginsUnavailable')}</Status> : null}
      {!pluginError && plugins === null ? <Status>{t('loading')}</Status> : null}
      {!pluginError && plugins?.length === 0 ? <Status>{t('noPlugins')}</Status> : null}
      {plugins?.map((plugin, index) => <div className="dsr-plugin" key={plugin.entryId ?? `${plugin.moduleName ?? 'plugin'}-${index}`}><span title={plugin.entryId}>{plugin.moduleName ?? plugin.entryId ?? 'Plugin'}</span><span className="dsr-stats">{plugin.enabled === false ? t('disabled') : plugin.fiberPhase === 'failed' ? t('error') : plugin.fiberPhase === 'loading' || plugin.fiberPhase === 'unloading' ? t('loading') : t('enabled')}</span></div>)}
    </Card>
    <Card title={t('outputFiles')} collapsed={!!collapsed.output} onToggle={() => toggle('output')} action={<button className="dsr-refresh" type="button" aria-label={t('refresh')} title={t('refresh')} onClick={() => setOutputRevision(value => value + 1)}>↻</button>}>
      <OutputFilesPanel sessionId={sessionId} turns={outputTurns} summaries={summaries} openError={routeHint} onOpenChanged={selectChangedOutput} onOpenDelivered={selectDeliveredOutput} />
    </Card>
    <Card title={t('changes')} collapsed={!!collapsed.changes} onToggle={() => toggle('changes')} action={<button className="dsr-refresh" type="button" aria-label={t('refresh')} title={t('refresh')} onClick={() => setRevision(value => value + 1)}>↻</button>}>
      <div className="dsr-actions"><label>{t('reviewTarget')} <input className="dsr-target" list="dsr-review-targets" value={chosenKind} spellCheck={false} autoCapitalize="none" onChange={event => persistKind(event.target.value)} onBlur={() => { const kind = chosenKind.trim(); if (kind !== chosenKind) persistKind(kind) }} placeholder={t('reviewOptional')} aria-label={t('reviewTarget')} />{normalizedTarget ? <span className="dsr-chip" title={targetExists ? t('enabled') : t('unavailable')}>{targetExists ? t('enabled') : t('unavailable')}</span> : null}</label><datalist id="dsr-review-targets">{activeTabs.map(tab => <option key={tab.kind} value={tab.kind}>{tab.title}</option>)}</datalist>
      <button type="button" className="dsr-commit" disabled={!!commitDisabledReason || commitState === 'sending'} title={commitDisabledReason ?? undefined} onClick={async () => { if (commitInFlight.current || commitDisabledReason) return; commitInFlight.current = true; setCommitState('sending'); try { await requestCommit(sessionId); setCommitState('queued') } catch { setCommitState('error') } finally { commitInFlight.current = false } }}>{commitState === 'sending' ? t('commitSending') : t('commitChanges')}</button></div>
      {commitDisabledReason ? <Status>{commitDisabledReason}</Status> : null}{commitState === 'error' ? <Status error>{t('commitError')}</Status> : null}{commitState === 'queued' ? <Status>{t('commitQueued')}</Status> : null}
      <div className="dsr-row"><span>{snapshot ? t('files')(files.length) : t('loading')}</span><span className="dsr-stats"><span className="dsr-add">+{totals.add}</span> <span className="dsr-del">−{totals.del}</span></span></div>
      {snapshot?.repositoryStatus === 'no-cwd' ? <Status>{t('noCwd')}</Status> : null}
      {snapshot?.repositoryStatus === 'not-repository' ? <Status>{t('noRepo')}</Status> : null}
      {snapshot?.repositoryStatus === 'directory-missing' ? <Status>{t('missingDir')}</Status> : null}
      {snapshot?.repositoryStatus === 'unavailable' ? <Status>{t('gitUnavailable')}</Status> : null}
      {snapshot?.repositoryStatus === 'available' && files.length === 0 ? <Status>{t('clean')}</Status> : null}
      {routeHint ? <Status error={routeHint === t('openFailed')}>{routeHint}</Status> : null}
      {files.map(file => <FileRow key={file.path} file={file} onSelect={() => selectWorkingTreeFile(file.path)} />)}
      {snapshotError ? <Status error>{snapshotError}</Status> : null}
    </Card>
  </div>
}

function OutputFilesPanel({ sessionId, turns, summaries, openError, onOpenChanged, onOpenDelivered }: {
  sessionId: string
  turns: readonly OutputTurnRecord[] | 'unavailable'
  summaries: Record<string, SummaryState>
  openError: string | null
  onOpenChanged: (turn: number, seq: number, index: number) => void
  onOpenDelivered: (path: string) => void
}) {
  if (!sessionId) return <Status>{t('noSession')}</Status>
  if (turns === 'unavailable') return <Status>{t('outputUnavailable')}</Status>
  if (turns.length === 0) return <Status>{t('outputEmpty')}</Status>
  const states = turns.map(turn => ({ turn, summary: turn.seq === undefined ? undefined : summaries[summaryKey(sessionId, turn.seq)] }))
  const pending = states.some(item => item.turn.seq !== undefined && (item.summary === undefined || item.summary === 'loading'))
  const anyMissing = states.some(item => item.summary === 'missing')
  const anyError = states.some(item => item.summary === 'error')
  const anyVisible = states.some(item => {
    if (item.turn.presented.length > 0) return true
    return item.summary !== undefined && typeof item.summary !== 'string' && (item.summary.files.length > 0 || item.summary.total > 0)
  })
  const onlyMissing = !anyVisible && !pending && anyMissing && states.every(item => item.turn.presented.length === 0 && (item.turn.seq === undefined || item.summary === 'missing' || item.summary === 'error' || item.summary === undefined))
  if (onlyMissing) return <Status>{t('outputSummaryUnavailable')}</Status>
  if (!anyVisible && !pending && !anyError && !anyMissing) return <Status>{t('outputNoChanges')}</Status>
  return <>
    {pending && !anyVisible ? <Status>{t('loading')}</Status> : null}
    {openError ? <Status error={openError === t('openFailed')}>{openError}</Status> : null}
    {states.map(({ turn, summary }) => <OutputTurn key={turn.turn} record={turn} summary={summary} onOpenChanged={onOpenChanged} onOpenDelivered={onOpenDelivered} />)}
  </>
}

function OutputTurn({ record, summary, onOpenChanged, onOpenDelivered }: {
  record: OutputTurnRecord
  summary: SummaryState | undefined
  onOpenChanged: (turn: number, seq: number, index: number) => void
  onOpenDelivered: (path: string) => void
}) {
  const files = summary && typeof summary !== 'string' ? summary.files : []
  const presented = record.presented
  const changedPaths = new Set(files.map(file => normalizeForMark(file.path)))
  const deliveredOnly = presented.filter(file => !changedPaths.has(normalizeForMark(file.path)))
  const deliveredPaths = new Set(presented.map(file => normalizeForMark(file.path)))
  return <div className="dsr-turn">
    <div className="dsr-row dsr-turn-heading">
      <span>{t('turn')(record.turn)}</span>
      {summary && typeof summary !== 'string' ? <span className="dsr-stats"><span className="dsr-add">+{summary.added}</span> <span className="dsr-del">−{summary.deleted}</span></span> : null}
    </div>
    {record.seq !== undefined && (summary === undefined || summary === 'loading') ? <Status>{t('loading')}</Status> : null}
    {summary === 'missing' ? <Status>{t('outputSummaryUnavailable')}</Status> : null}
    {summary === 'error' ? <Status error>{t('error')}</Status> : null}
    {summary && typeof summary !== 'string' && files.length === 0 && presented.length === 0 ? <Status>{t('outputTurnEmpty')}</Status> : null}
    {files.map((file, index) => (
      <div className="dsr-file" key={`change:${file.path}:${index}`}>
        <div className="dsr-row">
          <button type="button" onClick={() => record.seq !== undefined && onOpenChanged(record.turn, record.seq, index)} title={file.path}>
            {file.display || file.path}
            {deliveredPaths.has(normalizeForMark(file.path)) ? <span className="dsr-chip">{t('delivered')}</span> : null}
            {file.binary ? <span className="dsr-chip">{t('binary')}</span> : null}
            {file.oversized ? <span className="dsr-chip">{t('diffTooLarge')}</span> : null}
          </button>
          <span className="dsr-stats"><span className="dsr-add">+{file.added}</span> <span className="dsr-del">−{file.deleted}</span></span>
        </div>
      </div>
    ))}
    {deliveredOnly.map(file => (
      <div className="dsr-file" key={`present:${file.seq}:${file.index}`}>
        <div className="dsr-row">
          <button type="button" onClick={() => onOpenDelivered(file.path)} title={file.path}>
            {file.path}
            <span className="dsr-chip">{t('delivered')}</span>
          </button>
        </div>
      </div>
    ))}
  </div>
}

function Card({ title, collapsed, onToggle, action, children }: { title: string; collapsed: boolean; onToggle: () => void; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="dsr-card"><div className="dsr-heading"><button className="dsr-title" type="button" aria-expanded={!collapsed} onClick={onToggle}>{title}<span aria-hidden="true">{collapsed ? '⌄' : '⌃'}</span></button>{action}</div>{!collapsed ? <div className="dsr-content">{children}</div> : null}</section>
}
function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={`dsr-row dsr-muted${error ? ' dsr-error' : ''}`}>{children}</div> }
function FileRow({ file, onSelect }: { file: ChangedFile; onSelect: () => void }) {
  const label = file.status === 'untracked' ? t('untracked') : file.status === 'added' ? t('added') : file.status === 'deleted' ? t('deleted') : file.status === 'renamed' ? t('renamed') : file.status === 'copied' ? t('copied') : file.status === 'conflicted' ? t('conflicted') : t('modified')
  return <div className="dsr-file"><div className="dsr-row"><button type="button" onClick={onSelect} title={file.path}>{file.path}<span className="dsr-chip">{label}</span>{file.binary ? <span className="dsr-chip">{t('binary')}</span> : null}{file.staged ? <span className="dsr-chip">{t('staged')}</span> : null}{file.unstaged ? <span className="dsr-chip">{t('unstaged')}</span> : null}</button><span className="dsr-stats"><span className="dsr-add">+{file.additions}</span> <span className="dsr-del">−{file.deletions}</span></span></div></div>
}

function summaryKey(sessionId: string, seq: number): string { return `${sessionId}:${seq}` }
function normalizeForMark(path: string): string { return path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '') }

function ContextPanel({ view }: { view: ContextViewModel }) {
  const [usageOpen, setUsageOpen] = useState(false)
  if (view.source === 'none' || (view.used === undefined && view.categories.length === 0)) {
    return <Status>{t('contextUnavailable')}</Status>
  }
  const used = view.used ?? 0
  const window = view.window
  const pct = view.pct
  const meterMax = window ?? Math.max(used, 1)
  const segments = view.parts.filter(part => part.key !== 'free' || (window !== undefined && part.tokens > 0))
  return <>
    <div className="dsr-row">
      <span>{view.estimated ? `${t('estimated')} · ` : ''}{t('current')}</span>
      <span className="dsr-stats">{pct !== undefined ? `${pct.toFixed(pct < 10 ? 1 : 0)}% · ` : ''}{formatTokens(used)}{window !== undefined ? ` / ${formatTokens(window)}` : ''}</span>
    </div>
    <div className="dsr-meter dsr-meter-segments" role="meter" aria-valuemin={0} aria-valuemax={meterMax} aria-valuenow={used} aria-label={t('current')}>
      {segments.map(part => {
        const width = meterMax > 0 ? Math.max(part.tokens > 0 ? 0.4 : 0, part.tokens / meterMax * 100) : 0
        return width > 0 ? <i key={part.key} title={`${categoryLabel(part.key)} · ${formatTokens(part.tokens)}`} style={{ width: `${width}%`, background: part.color }} /> : null
      })}
    </div>
    <div className="dsr-row dsr-muted"><span className="dsr-chip">{view.source === 'timeline' ? t('sourceTimeline') : t('sourceMeter')}</span>{view.model ? <span className="dsr-chip" title={view.provider}>{view.model}</span> : null}</div>
    <div className="dsr-breakdown">
      {view.categories.map(part => <CategoryRow key={part.key} part={part} detail={part.key === 'assistant' ? view.assistantDetail : undefined} />)}
      {view.compactionReserve !== undefined ? <div className="dsr-row dsr-muted"><span><span className="dsr-swatch" style={{ background: 'var(--color-slate-400, #94a3b8)' }} />{t('compactionReserve')}</span><span className="dsr-stats">{formatTokens(view.compactionReserve)} {t('tokens')}</span></div> : null}
      {view.unavailable.map(key => <div className="dsr-row dsr-muted" key={`missing-${key}`}><span>{categoryLabel(key)}</span><span className="dsr-stats dsr-chip">{t('unavailable')}</span></div>)}
    </div>
    {view.timing ? <TimingBlock timing={view.timing} /> : null}
    {hasProviderUsage(view.usage) ? <UsageBlock usage={view.usage!} expanded={usageOpen} onToggle={() => setUsageOpen(value => !value)} /> : null}
  </>
}

function CategoryRow({ part, detail }: { part: ContextCategoryPart; detail?: ContextViewModel['assistantDetail'] }) {
  const [open, setOpen] = useState(false)
  const canExpand = part.key === 'assistant' && detail && (detail.reasoning || detail.answers || detail.calls)
  return <div className="dsr-cat">
    <div className="dsr-row dsr-muted">
      <button type="button" className="dsr-cat-toggle" aria-expanded={canExpand ? open : undefined} disabled={!canExpand} onClick={() => canExpand && setOpen(value => !value)}>
        <span className="dsr-swatch" style={{ background: part.color }} aria-hidden="true" />
        <span>{categoryLabel(part.key)}{part.key !== 'free' ? <span className="dsr-chip">{t('estimated')}</span> : null}</span>
        {canExpand ? <span className="dsr-chip" aria-hidden="true">{open ? '⌃' : '⌄'}</span> : null}
      </button>
      <span className="dsr-stats">
        {formatTokens(part.tokens)} {t('tokens')}
        {part.shareOfUsed !== undefined ? <span className="dsr-chip"> · {part.shareOfUsed.toFixed(0)}% {t('ofUsed')}</span> : null}
        {part.shareOfWindow !== undefined ? <span className="dsr-chip"> · {part.shareOfWindow.toFixed(0)}% {t('ofWindow')}</span> : null}
      </span>
    </div>
    {open && detail ? <div className="dsr-subrows">
      {detail.reasoning !== undefined ? <div className="dsr-row dsr-muted"><span>{t('thinking')}</span><span className="dsr-stats">{formatTokens(detail.reasoning)}</span></div> : null}
      {detail.answers !== undefined ? <div className="dsr-row dsr-muted"><span>{t('answers')}</span><span className="dsr-stats">{formatTokens(detail.answers)}</span></div> : null}
      {detail.calls !== undefined ? <div className="dsr-row dsr-muted"><span>{t('tool')}</span><span className="dsr-stats">{formatTokens(detail.calls)}</span></div> : null}
    </div> : null}
  </div>
}

function TimingBlock({ timing }: { timing: NonNullable<ContextViewModel['timing']> }) {
  return <div className="dsr-timing">
    <div className="dsr-row"><span>{t('timing')}</span></div>
    {timing.wallMs !== undefined ? <div className="dsr-row dsr-muted"><span>{t('activeDuration')}</span><span className="dsr-stats">{formatDuration(timing.wallMs)}</span></div> : null}
    {timing.genMs !== undefined ? <div className="dsr-row dsr-muted"><span>{t('modelWait')}</span><span className="dsr-stats">{formatDuration(timing.genMs)}</span></div> : null}
    {timing.toolsMs !== undefined ? <div className="dsr-row dsr-muted"><span>{t('toolExec')}</span><span className="dsr-stats">{formatDuration(timing.toolsMs)}</span></div> : null}
    {timing.ttftMs !== undefined ? <div className="dsr-row dsr-muted"><span>{t('ttft')}</span><span className="dsr-stats">{formatDuration(timing.ttftMs)}</span></div> : null}
    {timing.tokensPerSecond !== undefined ? <div className="dsr-row dsr-muted"><span>{t('outputSpeed')}</span><span className="dsr-stats">{timing.tokensPerSecond.toFixed(1)} {t('tokensPerSec')}</span></div> : null}
  </div>
}

function UsageBlock({ usage, expanded, onToggle }: { usage: TokenUsageProjection; expanded: boolean; onToggle: () => void }) {
  const input = sum(usage.uncachedInputTokens, usage.cacheReadTokens, usage.cacheWriteTokens)
  return <div className="dsr-usage">
    <div className="dsr-row dsr-muted">
      <button type="button" className="dsr-cat-toggle" aria-expanded={expanded} onClick={onToggle} title={t('providerUsage')}>
        <span>{t('providerUsage')}</span>
        <span className="dsr-chip" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </button>
      <span className="dsr-stats">↑{formatTokens(input)} ↓{formatTokens(usage.outputTokens)}</span>
    </div>
    {expanded ? <div className="dsr-subrows">
      {finite(usage.uncachedInputTokens) !== undefined ? <div className="dsr-row dsr-muted"><span>{t('uncachedInput')}</span><span className="dsr-stats">{formatTokens(usage.uncachedInputTokens)}</span></div> : null}
      {finite(usage.cacheReadTokens) !== undefined ? <div className="dsr-row dsr-muted"><span>{t('cacheRead')}</span><span className="dsr-stats">{formatTokens(usage.cacheReadTokens)}</span></div> : null}
      {finite(usage.cacheWriteTokens) !== undefined ? <div className="dsr-row dsr-muted"><span>{t('cacheWrite')}</span><span className="dsr-stats">{formatTokens(usage.cacheWriteTokens)}</span></div> : null}
      {finite(usage.outputTokens) !== undefined ? <div className="dsr-row dsr-muted"><span>{t('output')}</span><span className="dsr-stats">{formatTokens(usage.outputTokens)}</span></div> : null}
    </div> : null}
  </div>
}

function categoryLabel(key: ContextCategoryKey): string {
  switch (key) {
    case 'system': return t('system')
    case 'tools': return t('tools')
    case 'user': return t('user')
    case 'inject': return t('inject')
    case 'skill': return t('skill')
    case 'assistant': return t('assistant')
    case 'tool': return t('tool')
    case 'messages': return t('messages')
    case 'thinking': return t('thinking')
    case 'answers': return t('answers')
    case 'free': return t('free')
    case 'compactionReserve': return t('compactionReserve')
    case 'mcp': return t('mcp')
    case 'memory': return t('memory')
    default: return key
  }
}

function finite(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined }
function format(value: unknown): string { return formatTokens(value) }
function sum(...values: unknown[]): number | undefined { const valid = values.map(finite).filter((x): x is number => x !== undefined); return valid.length ? valid.reduce((a, b) => a + b, 0) : undefined }
function basename(path: string): string { return path.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).at(-1) ?? path }

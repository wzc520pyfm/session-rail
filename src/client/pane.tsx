import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getDiff, getSnapshot, requestCommit, RailApiError } from './api.ts'
import { buildContextView, formatDuration, formatTokens, hasProviderUsage } from './context-model.ts'
import { t } from './i18n.ts'
import { ensureRailStyle } from './styles.ts'
import type { ChangedFile, ContextBreakdown, ContextCategoryKey, ContextCategoryPart, ContextPressure, ContextTimelineProjection, ContextViewModel, FileDiff, SessionSnapshot, TokenUsageProjection, UnifiedDiffLine } from '../shared/types.ts'

interface PluginItem { moduleName?: string; entryId?: string; fiberPhase?: string | null; enabled?: boolean }
interface TabChoice { kind: string; title: string }
interface Props { sessionId: string; cwd?: string; pressure?: ContextPressure; breakdown?: ContextBreakdown; usage?: TokenUsageProjection; timeline?: ContextTimelineProjection; loadPlugins?: () => Promise<PluginItem[]>; activeTabs?: TabChoice[]; openTab?: (kind: string) => unknown }

export function RailPane(props: Props): React.ReactElement {
  const { sessionId, cwd, pressure, breakdown, usage, timeline, loadPlugins, activeTabs = [], openTab } = props
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [plugins, setPlugins] = useState<PluginItem[] | null>(null)
  const [pluginError, setPluginError] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [chosenKind, setChosenKind] = useState('codex-review')
  const [commitState, setCommitState] = useState<'idle' | 'sending' | 'queued' | 'error'>('idle')
  const commitInFlight = useRef(false)
  const [routeHint, setRouteHint] = useState(false)
  const storageKey = 'session-rail:selected-review-kind'
  useEffect(() => { try { const saved = localStorage.getItem(storageKey); setChosenKind(saved || 'codex-review') } catch { setChosenKind('codex-review') } }, [])
  useEffect(() => { ensureRailStyle() }, [])

  useEffect(() => {
    if (!sessionId) { setSnapshot(null); setLoading(false); return }
    const abort = new AbortController(); let active = true
    setLoading(true); setSnapshotError(null); setSnapshot(null); setSelected(null); setDiff(null)
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
    if (!sessionId || !selected) return
    const abort = new AbortController(); let active = true
    setDiffLoading(true); setDiffError(null); setDiff(null)
    getDiff(sessionId, selected, abort.signal).then(value => { if (active) setDiff(value) }).catch(error => {
      if (!active || abort.signal.aborted) return
      const typed = error instanceof RailApiError && error.code === 'diff_too_large' ? t('diffTooLarge') : (error instanceof Error ? error.message : t('diffUnavailable'))
      setDiffError(typed)
    }).finally(() => { if (active) setDiffLoading(false) })
    return () => { active = false; abort.abort() }
  }, [sessionId, selected])

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

  function selectFile(path: string) {
    setRouteHint(false)
    if (selected === path) { setSelected(null); return }
    if (normalizedTarget && openTab) {
      try {
        const result = openTab(normalizedTarget)
        if (result !== false) { setSelected(null); return }
      } catch { /* fall through to the inline diff */ }
    }
    setSelected(path)
    setRouteHint(true)
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
    <Card title={t('changes')} collapsed={!!collapsed.changes} onToggle={() => toggle('changes')} action={<button className="dsr-refresh" type="button" aria-label={t('refresh')} title={t('refresh')} onClick={() => setRevision(value => value + 1)}>↻</button>}>
      <div className="dsr-actions"><label>{t('reviewTarget')} <input className="dsr-target" list="dsr-review-targets" value={chosenKind} spellCheck={false} autoCapitalize="none" onChange={event => { const kind = event.target.value; setChosenKind(kind); try { localStorage.setItem(storageKey, kind) } catch { /* storage may be unavailable */ } }} onBlur={() => { const kind = chosenKind.trim(); if (kind !== chosenKind) { setChosenKind(kind); try { localStorage.setItem(storageKey, kind) } catch { /* storage may be unavailable */ } } }} placeholder="codex-review" aria-label={t('reviewTarget')} /><span className="dsr-chip" title={targetExists ? t('enabled') : t('unavailable')}>{targetExists ? t('enabled') : t('unavailable')}</span></label><datalist id="dsr-review-targets">{activeTabs.map(tab => <option key={tab.kind} value={tab.kind}>{tab.title}</option>)}</datalist>
      <button type="button" className="dsr-commit" disabled={!!commitDisabledReason || commitState === 'sending'} title={commitDisabledReason ?? undefined} onClick={async () => { if (commitInFlight.current || commitDisabledReason) return; commitInFlight.current = true; setCommitState('sending'); try { await requestCommit(sessionId); setCommitState('queued') } catch { setCommitState('error') } finally { commitInFlight.current = false } }}>{commitState === 'sending' ? t('commitSending') : t('commitChanges')}</button></div>
      {commitDisabledReason ? <Status>{commitDisabledReason}</Status> : null}{commitState === 'error' ? <Status error>{t('commitError')}</Status> : null}{commitState === 'queued' ? <Status>{t('commitQueued')}</Status> : null}
      <div className="dsr-row"><span>{snapshot ? t('files')(files.length) : t('loading')}</span><span className="dsr-stats"><span className="dsr-add">+{totals.add}</span> <span className="dsr-del">−{totals.del}</span></span></div>
      {snapshot?.repositoryStatus === 'no-cwd' ? <Status>{t('noCwd')}</Status> : null}
      {snapshot?.repositoryStatus === 'not-repository' ? <Status>{t('noRepo')}</Status> : null}
      {snapshot?.repositoryStatus === 'directory-missing' ? <Status>{t('missingDir')}</Status> : null}
      {snapshot?.repositoryStatus === 'unavailable' ? <Status>{t('gitUnavailable')}</Status> : null}
      {snapshot?.repositoryStatus === 'available' && files.length === 0 ? <Status>{t('clean')}</Status> : null}
      {routeHint ? <Status>{t('reviewUnavailable')}</Status> : null}
      {files.map(file => <FileRow key={file.path} file={file} selected={selected === file.path} diff={selected === file.path ? diff : null} diffError={selected === file.path ? diffError : null} diffLoading={selected === file.path && diffLoading} onSelect={() => selectFile(file.path)} />)}
      {snapshotError ? <Status error>{snapshotError}</Status> : null}
    </Card>
  </div>
}

function Card({ title, collapsed, onToggle, action, children }: { title: string; collapsed: boolean; onToggle: () => void; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="dsr-card"><div className="dsr-heading"><button className="dsr-title" type="button" aria-expanded={!collapsed} onClick={onToggle}>{title}<span aria-hidden="true">{collapsed ? '⌄' : '⌃'}</span></button>{action}</div>{!collapsed ? <div className="dsr-content">{children}</div> : null}</section>
}
function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={`dsr-row dsr-muted${error ? ' dsr-error' : ''}`}>{children}</div> }
function FileRow({ file, selected, diff, diffError, diffLoading, onSelect }: { file: ChangedFile; selected: boolean; diff: FileDiff | null; diffError: string | null; diffLoading: boolean; onSelect: () => void }) {
  const label = file.status === 'untracked' ? t('untracked') : file.status === 'added' ? t('added') : file.status === 'deleted' ? t('deleted') : file.status === 'renamed' ? t('renamed') : file.status === 'copied' ? t('copied') : file.status === 'conflicted' ? t('conflicted') : t('modified')
  return <div className="dsr-file"><div className="dsr-row"><button type="button" aria-expanded={selected} onClick={onSelect} title={file.path}>{file.path}<span className="dsr-chip">{label}</span>{file.binary ? <span className="dsr-chip">{t('binary')}</span> : null}{file.staged ? <span className="dsr-chip">{t('staged')}</span> : null}{file.unstaged ? <span className="dsr-chip">{t('unstaged')}</span> : null}</button><span className="dsr-stats"><span className="dsr-add">+{file.additions}</span> <span className="dsr-del">−{file.deletions}</span></span></div>
    {selected ? <div className="dsr-diff" role="region" aria-label={`${t('viewDiff')}: ${file.path}`}>{diffLoading ? t('loading') : diffError ? diffError : diff?.binary || file.binary ? t('binary') : diff?.lines?.map((line, i) => <DiffLine key={i} line={line} />) ?? t('diffUnavailable')}</div> : null}</div>
}
function DiffLine({ line }: { line: UnifiedDiffLine }) { return <div className={line.kind === 'addition' ? 'dsr-line-add' : line.kind === 'deletion' ? 'dsr-line-del' : undefined}>{line.text || ' '}</div> }

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

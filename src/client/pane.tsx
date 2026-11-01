import React, { useEffect, useMemo, useState } from 'react'
import { getDiff, getSnapshot, RailApiError } from './api.ts'
import { t } from './i18n.ts'
import { ensureRailStyle } from './styles.ts'
import type { ChangedFile, ContextBreakdown, ContextPressure, FileDiff, SessionSnapshot, TokenUsageProjection, UnifiedDiffLine } from '../shared/types.ts'

interface PluginItem { moduleName?: string; entryId?: string; fiberPhase?: string | null; enabled?: boolean }
interface Props { sessionId: string; cwd?: string; pressure?: ContextPressure; breakdown?: ContextBreakdown; usage?: TokenUsageProjection; loadPlugins?: () => Promise<PluginItem[]> }

export function RailPane(props: Props): React.ReactElement {
  const { sessionId, cwd, pressure, breakdown, usage, loadPlugins } = props
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

  const ratio = useMemo(() => {
    const current = finite(pressure?.pressureTokens) ?? finite(pressure?.projectedTokens)
    const capacity = finite(pressure?.contextWindow)
    return current !== undefined && capacity && capacity > 0 ? { current, capacity, pct: Math.max(0, Math.min(100, current / capacity * 100)), estimated: finite(pressure?.pressureTokens) === undefined } : null
  }, [pressure])
  const files = snapshot?.changedFiles ?? []
  const displayCwd = cwd ?? snapshot?.cwd
  const totals = files.reduce((sum, file) => ({ add: sum.add + file.additions, del: sum.del + file.deletions }), { add: 0, del: 0 })

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
      {ratio ? <><div className="dsr-row"><span>{ratio.estimated ? `${t('estimated')} · ` : ''}{t('current')}</span><span className="dsr-stats">{ratio.pct.toFixed(0)}% · {format(ratio.current)} / {format(ratio.capacity)}</span></div><div className="dsr-meter" role="meter" aria-valuemin={0} aria-valuemax={ratio.capacity} aria-valuenow={ratio.current}><i style={{ width: `${ratio.pct}%` }} /></div></> : <Status>{t('contextUnavailable')}</Status>}
      {breakdown ? <div className="dsr-breakdown">{([['systemTokens', 'system'], ['toolsTokens', 'tools'], ['messageTokens', 'messages']] as const).map(([field, label]) => finite(breakdown[field]) !== undefined ? <div className="dsr-row dsr-muted" key={field}><span>{t(label)} <span className="dsr-chip">{t('estimated')}</span></span><span className="dsr-stats">{format(breakdown[field])} {t('tokens')}</span></div> : null)}</div> : null}
      {usage && hasUsage(usage) ? <div className="dsr-row dsr-muted" title={t('providerUsage')}><span>{t('providerUsage')}</span><span className="dsr-stats">↑{format(sum(usage.uncachedInputTokens, usage.cacheReadTokens, usage.cacheWriteTokens))} ↓{format(usage.outputTokens)}</span></div> : null}
    </Card>
    <Card title={t('plugins')} collapsed={!!collapsed.plugins} onToggle={() => toggle('plugins')}>
      {pluginError ? <Status>{t('pluginsUnavailable')}</Status> : null}
      {!pluginError && plugins === null ? <Status>{t('loading')}</Status> : null}
      {!pluginError && plugins?.length === 0 ? <Status>{t('noPlugins')}</Status> : null}
      {plugins?.map((plugin, index) => <div className="dsr-plugin" key={plugin.entryId ?? `${plugin.moduleName ?? 'plugin'}-${index}`}><span title={plugin.entryId}>{plugin.moduleName ?? plugin.entryId ?? 'Plugin'}</span><span className="dsr-stats">{plugin.enabled === false ? t('disabled') : plugin.fiberPhase === 'failed' ? t('error') : plugin.fiberPhase === 'loading' || plugin.fiberPhase === 'unloading' ? t('loading') : t('enabled')}</span></div>)}
    </Card>
    <Card title={t('changes')} collapsed={!!collapsed.changes} onToggle={() => toggle('changes')} action={<button className="dsr-refresh" type="button" aria-label={t('refresh')} title={t('refresh')} onClick={() => setRevision(value => value + 1)}>↻</button>}>
      <div className="dsr-row"><span>{snapshot ? t('files')(files.length) : t('loading')}</span><span className="dsr-stats"><span className="dsr-add">+{totals.add}</span> <span className="dsr-del">−{totals.del}</span></span></div>
      {snapshot?.repositoryStatus === 'no-cwd' ? <Status>{t('noCwd')}</Status> : null}
      {snapshot?.repositoryStatus === 'not-repository' ? <Status>{t('noRepo')}</Status> : null}
      {snapshot?.repositoryStatus === 'directory-missing' ? <Status>{t('missingDir')}</Status> : null}
      {snapshot?.repositoryStatus === 'unavailable' ? <Status>{t('gitUnavailable')}</Status> : null}
      {snapshot?.repositoryStatus === 'available' && files.length === 0 ? <Status>{t('clean')}</Status> : null}
      {files.map(file => <FileRow key={file.path} file={file} selected={selected === file.path} diff={selected === file.path ? diff : null} diffError={selected === file.path ? diffError : null} diffLoading={selected === file.path && diffLoading} onSelect={() => setSelected(value => value === file.path ? null : file.path)} />)}
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
function finite(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined }
function format(value: unknown): string { const number = finite(value); return number === undefined ? '—' : Intl.NumberFormat().format(number) }
function sum(...values: unknown[]): number | undefined { const valid = values.map(finite).filter((x): x is number => x !== undefined); return valid.length ? valid.reduce((a, b) => a + b, 0) : undefined }
function hasUsage(value: TokenUsageProjection): boolean { return sum(value.uncachedInputTokens, value.cacheReadTokens, value.cacheWriteTokens, value.outputTokens) !== undefined }
function basename(path: string): string { return path.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).at(-1) ?? path }

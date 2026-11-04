import React, { useCallback, useEffect, useState } from 'react'
import { RailPane } from './pane.tsx'
import { ensureRailStyle } from './styles.ts'
import { t } from './i18n.ts'
import type { ContextBreakdown, ContextPressure, ContextTimelineProjection, TokenUsageProjection } from '../shared/types.ts'

export const inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'remote', 'remote.pluginInventory']
const ID = 'session-rail'
const KIND = 'session-info'

interface TabInfo { sessionId?: string; tab?: { sessionId?: string } }
interface SlotProps {
  sessionId?: string
  useTabInfo?: () => TabInfo | null
  useProjection?: <T>(name: string) => T | undefined
  useSessions?: (select: (sessions: unknown) => string | undefined) => string | undefined
}
interface PluginItem { moduleName?: string; entryId?: string; fiberPhase?: string | null; enabled?: boolean }
interface ClientContext {
  slots: { inject(name: string, register: () => () => void): () => void; register(def: Record<string, unknown>, component: (props: SlotProps) => React.ReactElement): () => void }
  sidebarRightTabs?: {
    register(def: Record<string, unknown>): () => void
    entries?: () => ReadonlyArray<{ kind: string; title: () => string; patterns?: readonly string[] }>
    getSnapshot?: () => ReadonlyArray<{ kind: string; title: () => string; patterns?: readonly string[] }>
    subscribe?: (listener: () => void) => () => void
  }
  sidebarRight?: { openTab(kind: string): unknown }
  remote?: { pluginInventory?: { list?: () => Promise<{ entries?: PluginItem[] }> } }
  effect?: (fn: () => void | (() => void), label?: string) => void
  inject?: (names: string[], fn: (ctx: ClientContext) => void) => void
}
let pluginContext: ClientContext | null = null

export function apply(ctx: ClientContext): void {
  pluginContext = ctx
  ensureRailStyle()
  const register = () => {
    ctx.effect?.(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ID }, SessionRailTab)), 'session-rail: tab body')
    ctx.effect?.(() => ctx.sidebarRightTabs?.register?.({ id: ID, kind: KIND, priority: 'extension', keepMounted: true, title: () => t('environment') }) ?? (() => undefined), 'session-rail: tab type')
    ctx.effect?.(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: ID, order: 16 }, SessionRailOpener)), 'session-rail: opener')
  }
  if (ctx.inject) ctx.inject(['slots', 'sidebarRightTabs', 'sidebarRight', 'remote.pluginInventory'], register)
  else register()
}

function SessionRailTab(props: SlotProps): React.ReactElement {
  const [, setTabsRevision] = useState(0)
  const tabsRegistry = pluginContext?.sidebarRightTabs
  useEffect(() => tabsRegistry?.subscribe?.(() => setTabsRevision(value => value + 1)), [tabsRegistry])
  const info = props.useTabInfo?.()
  const sessionId = props.sessionId || info?.sessionId || info?.tab?.sessionId || ''
  const projectedCwd = props.useProjection?.<string | null>('workingDirectory')
  const pressure = props.useProjection?.<ContextPressure>('contextPressure')
  const breakdown = props.useProjection?.<ContextBreakdown>('contextBreakdown')
  const usage = props.useProjection?.<TokenUsageProjection>('tokenUsage')
  // Optional fine-grained timeline published by dsh-context when installed; absent in stock DSH.
  const timeline = props.useProjection?.<ContextTimelineProjection>('contextTimeline')
  const inventory = pluginContext?.remote?.pluginInventory
  let tabs: ReadonlyArray<{ kind: string; title: () => string; patterns?: readonly string[] }> = []
  try { tabs = tabsRegistry?.entries?.() ?? tabsRegistry?.getSnapshot?.() ?? [] } catch { /* sidebar registry may be unavailable during startup */ }
  tabs = tabs.filter(tab => tab.kind !== KIND && (!tab.patterns || tab.patterns.length === 0))
  const openTab = pluginContext?.sidebarRight?.openTab
  const loadPlugins = useCallback(async () => {
    if (!inventory?.list) return []
    const snapshot = await inventory.list()
    return Array.isArray(snapshot?.entries) ? snapshot.entries : []
  }, [inventory])
  return <RailPane
    key={sessionId}
    sessionId={sessionId}
    cwd={projectedCwd || undefined}
    pressure={pressure}
    breakdown={breakdown}
    usage={usage}
    timeline={timeline}
    loadPlugins={inventory?.list ? loadPlugins : undefined}
    activeTabs={tabs.map(tab => ({ kind: tab.kind, title: safeTitle(tab.title) }))}
    openTab={openTab ? kind => openTab.call(pluginContext?.sidebarRight, kind) : undefined}
  />
}

function safeTitle(title: () => string): string { try { return String(title()) } catch { return '' } }

function SessionRailOpener(): React.ReactElement {
  return <button type="button" className="dsr-header-open" onClick={() => pluginContext?.sidebarRight?.openTab(KIND)} aria-label={t('environment')} title={t('environment')}>▤</button>
}

import React, { useCallback } from 'react'
import { RailPane } from './pane.tsx'
import { ensureRailStyle } from './styles.ts'
import { t } from './i18n.ts'
import type { ContextBreakdown, ContextPressure, TokenUsageProjection } from '../shared/types.ts'

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
  sidebarRightTabs?: { register(def: Record<string, unknown>): () => void }
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
  const info = props.useTabInfo?.()
  const sessionId = props.sessionId || info?.sessionId || info?.tab?.sessionId || ''
  const projectedCwd = props.useProjection?.<string | null>('workingDirectory')
  const pressure = props.useProjection?.<ContextPressure>('contextPressure')
  const breakdown = props.useProjection?.<ContextBreakdown>('contextBreakdown')
  const usage = props.useProjection?.<TokenUsageProjection>('tokenUsage')
  const inventory = pluginContext?.remote?.pluginInventory
  const loadPlugins = useCallback(async () => {
    if (!inventory?.list) return []
    const snapshot = await inventory.list()
    return Array.isArray(snapshot?.entries) ? snapshot.entries : []
  }, [inventory])
  return <RailPane key={sessionId} sessionId={sessionId} cwd={projectedCwd || undefined} pressure={pressure} breakdown={breakdown} usage={usage} loadPlugins={inventory?.list ? loadPlugins : undefined} />
}

function SessionRailOpener(): React.ReactElement {
  return <button type="button" className="dsr-header-open" onClick={() => pluginContext?.sidebarRight?.openTab(KIND)} aria-label={t('environment')} title={t('environment')}>▤</button>
}

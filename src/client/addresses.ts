/** Document-relative Host route for one announced `workspace/changes` summary. */
export const CHANGED_FILES_ROUTE = 'api/changes.summary'
/** Resource-address prefix of a turn's official `changes-review` tab. */
export const CHANGES_REVIEW_ADDRESS = 'dsh-resource://changes-review/session/'
const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'

export interface ChangesReviewCoordinates {
  sessionId: string
  seq: number
  turn: number
}

/**
 * Right-sidebar address of one turn's official review tab.
 * Matches `changesReviewAddress` from `@deepseek-ai/dsh-client-ui-deliverables`.
 */
export function changesReviewAddress(coordinates: ChangesReviewCoordinates): string {
  const { sessionId, seq, turn } = coordinates
  return `${CHANGES_REVIEW_ADDRESS}${encodeURIComponent(sessionId)}/${seq}/${turn}`
}

/** Document-relative URL for `GET /api/changes.summary?sessionId=&seq=`. */
export function changesSummaryUrl(sessionId: string, seq: number): string {
  return `${CHANGED_FILES_ROUTE}?${new URLSearchParams({ sessionId, seq: String(seq) })}`
}

/** Component-encode one URI segment, keeping `:` literal so drive letters stay readable. */
function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/%3A/gi, ':')
}

function encodePath(path: string): string {
  return path.split('/').map(encodeSegment).join('/')
}

/**
 * Whether a path is absolute in either spelling the Host accepts: POSIX (`/a/b`) or Windows drive or UNC.
 */
export function isAbsoluteWorkspacePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[/\\]/.test(path) || path.startsWith('\\\\')
}

/** `dsh-resource://file/session/<sessionId>/<path>` address for a Session-resolved file. */
export function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`
}

/**
 * Address for a path as a caller holds it.
 * Matches `fileAddressFor` from `@deepseek-ai/dsh-util-workspace-path`
 * (the helper `@deepseek-ai/dsh-client-ui-deliverables` uses for Sidebar previews).
 */
export function fileAddressFor(sessionId: string, cwd: string | undefined, path: string): string {
  const normalized = path.replace(/\\/g, '/')
  if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized)
  const root = cwd === undefined ? '' : cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  if (root !== '' && normalized === root) return sessionFileAddress(sessionId, '')
  if (root !== '' && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1))
  return sessionFileAddress(sessionId, normalized)
}

export function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
}

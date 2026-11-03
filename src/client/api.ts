import type { ApiEnvelope, ApiErrorEnvelope, CommitRequestResult, FileDiff, SessionSnapshot } from '../shared/types.ts'

const PREFIX = '/api/session-rail'

export class RailApiError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'RailApiError' }
}

async function post<T>(path: string, payload: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${PREFIX}/${path}`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })
  let value: ApiEnvelope<T> | ApiErrorEnvelope
  try { value = await response.json() as ApiEnvelope<T> | ApiErrorEnvelope }
  catch { throw new RailApiError('invalid_response', `Request failed (${response.status})`) }
  if (!response.ok || !value.ok) {
    const error = value.ok ? undefined : value.error
    throw new RailApiError(error?.code ?? 'request_failed', error?.message ?? `Request failed (${response.status})`)
  }
  return value.data
}

export const getSnapshot = (sessionId: string, signal?: AbortSignal) => post<SessionSnapshot>('snapshot', { sessionId }, signal)
export const getDiff = (sessionId: string, path: string, signal?: AbortSignal) => post<FileDiff>('diff', { sessionId, path }, signal)
export const requestCommit = (sessionId: string, signal?: AbortSignal) => post<CommitRequestResult>('commit-request', { sessionId }, signal)

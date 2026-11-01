import { fileDiff, GitError, snapshot, type SessionLike } from './git.ts'
import { header, HttpError, isSameOrigin, readJsonBody, sendError, sendJson } from './http.ts'
import type { SessionSnapshot } from '../shared/types.ts'

export const name = 'session-rail'
export const inject = ['webServer', 'sessions']
const PREFIX = '/api/session-rail'
interface Request { method?: string; url?: string; headers: Record<string, string | string[] | undefined> }
interface Response { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void }
type Handler = (req: Request, res: Response) => Promise<void> | void
interface HostContext {
  effect?(callback: () => void | (() => void), label?: string): void
  webServer?: { register(route: { kind: string; path: string; handler: Handler }): () => void }
  sessions?: { get(id: string): SessionLike | undefined | null }
}

export function apply(ctx: HostContext): void {
  const register = () => {
    if (!ctx.webServer?.register || !ctx.sessions?.get) return () => undefined
    return ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: (req, res) => route(ctx, req, res) })
  }
  if (ctx.effect) ctx.effect(register, 'session-rail: routes')
  else register()
}

async function route(ctx: HostContext, req: Request, res: Response): Promise<void> {
  if (!isSameOrigin(req.headers)) { sendError(res, 403, 'cross_origin', 'Cross-origin requests are refused'); return }
  if (String(req.method ?? '').toUpperCase() !== 'POST') { sendError(res, 405, 'method_not_allowed', 'Only POST is supported'); return }
  if (!/^application\/json(?:\s*;|$)/i.test(header(req.headers, 'content-type'))) { sendError(res, 415, 'json_required', 'Content-Type must be application/json'); return }
  try {
    const url = new URL(req.url ?? '/', 'http://dsh.local'), body = await readJsonBody(req as unknown as NodeJS.ReadableStream)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    if (!sessionId || sessionId.length > 512) throw new HttpError(400, 'invalid_session_id', 'A valid sessionId is required')
    const session = ctx.sessions?.get(sessionId)
    if (!session) throw new HttpError(404, 'session_not_found', 'Session was not found')
    const current = await snapshot(sessionId, session)
    if (url.pathname === `${PREFIX}/snapshot`) {
      sendJson(res, 200, { ok: true, data: publicSnapshot(current) }); return
    }
    if (url.pathname === `${PREFIX}/diff`) {
      if (typeof body.path !== 'string' || !body.path || body.path.length > 4096) throw new HttpError(400, 'invalid_path', 'A valid changed-file path is required')
      const diff = await fileDiff(current, body.path)
      sendJson(res, 200, { ok: true, data: diff }); return
    }
    sendError(res, 404, 'route_not_found', 'Route was not found')
  } catch (error) {
    if (error instanceof HttpError || error instanceof GitError) { sendError(res, error.status, error.code, error.message); return }
    sendError(res, 500, 'git_command_failed', 'Git request failed')
  }
}
function publicSnapshot(value: SessionSnapshot): SessionSnapshot { const { repoRoot: _repoRoot, ...safe } = value as SessionSnapshot & { repoRoot?: string }; return safe }

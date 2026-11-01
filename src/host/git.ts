import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { ChangedFile, FileDiff, SessionSnapshot } from '../shared/types.ts'
const execFile = promisify(execFileCallback), TIMEOUT = 5000, MAX_BUFFER = 2 * 1024 * 1024, MAX_DIFF = 512 * 1024
export class GitError extends Error { constructor(readonly code: string, message: string, readonly status = 400) { super(message) } }
export interface SessionLike { header?: { cwd?: unknown } }
export async function snapshot(sessionId: string, session: SessionLike): Promise<SessionSnapshot> {
  const cwdValue = session.header?.cwd
  if (typeof cwdValue !== 'string' || !cwdValue.trim()) return { sessionId, repositoryStatus: 'no-cwd', changedFiles: [] }
  const cwd = path.resolve(cwdValue)
  try { if (!(await stat(cwd)).isDirectory()) throw new Error() } catch { return { sessionId, cwd, repositoryStatus: 'directory-missing', changedFiles: [] } }
  try {
    const { stdout: rootOut } = await run(cwd, ['rev-parse', '--show-toplevel']), root = await realpath(rootOut.trim())
    const { stdout } = await run(root, ['status', '--porcelain=v1', '-z', '--branch']), parsed = parseStatus(stdout)
    const { stdout: nums } = parsed.unborn
      ? await run(root, ['diff', '--numstat', '-z', '--cached', '--'])
      : await run(root, ['diff', '--numstat', '-z', 'HEAD', '--'])
    const stats = parseNumstat(nums)
    for (const file of parsed.files) {
      const stat = stats.get(file.path)
      if (file.status === 'untracked' || file.status === 'added') {
        if (await fileExists(root, file.path)) {
          const result = await run(root, ['diff', '--no-index', '--numstat', '-z', '--', '/dev/null', file.path], true)
          const row = parseNumstat(result.stdout).get(file.path)
          if (row) Object.assign(file, row)
          else if (stat) Object.assign(file, stat)
        } else if (file.status === 'added' && file.staged) {
          const result = await run(root, ['diff', '--numstat', '-z', '--cached', '--', file.path])
          const stagedStat = parseNumstat(result.stdout).get(file.path)
          if (stagedStat) Object.assign(file, stagedStat)
          else if (stat) Object.assign(file, stat)
        } else if (stat) Object.assign(file, stat)
      } else if (stat) Object.assign(file, stat)
    }
    return { sessionId, cwd, branch: parsed.branch, repositoryStatus: 'available', changedFiles: parsed.files, repoRoot: root } as SessionSnapshot
  } catch (error) {
    if (isMissingGit(error)) throw new GitError('git_unavailable', 'Git executable is unavailable', 503)
    if (isNotRepo(error)) return { sessionId, cwd, repositoryStatus: 'not-repository', changedFiles: [] }
    throw new GitError('git_command_failed', 'Git could not read this workspace', 500)
  }
}
export async function fileDiff(session: SessionSnapshot, filePath: string): Promise<FileDiff> {
  const file = session.changedFiles.find((item) => item.path === filePath)
  if (!file) throw new GitError('changed_path_mismatch', 'Path is not in the latest changed-file snapshot', 404)
  const root = session.repoRoot
  if (!session.cwd || !root) throw new GitError('not_repository', 'Workspace is not a Git repository', 400)
  const absolute = path.resolve(root, filePath), rel = path.relative(root, absolute)
  if (!rel || rel.startsWith(`..${path.sep}`) || rel === '..' || path.isAbsolute(rel)) throw new GitError('invalid_path', 'Path is outside the repository', 400)
  const existingAncestor = await realpathExistingAncestor(absolute)
  const ancestorRel = path.relative(root, existingAncestor)
  if (ancestorRel.startsWith(`..${path.sep}`) || ancestorRel === '..' || path.isAbsolute(ancestorRel)) throw new GitError('invalid_path', 'Path is outside the repository', 400)
  const exists = await fileExists(root, filePath)
  if (!exists && file.status !== 'deleted' && !(file.status === 'added' && file.staged)) throw new GitError('changed_path_mismatch', 'Changed file is no longer available', 404)
  if (exists) {
    const resolved = await realpath(absolute), inside = path.relative(root, resolved)
    if (inside.startsWith(`..${path.sep}`) || inside === '..' || path.isAbsolute(inside)) throw new GitError('invalid_path', 'Path is outside the repository', 400)
  }
  if (file.binary) return { path: filePath, binary: true }
  const args = file.status === 'untracked' || (file.status === 'added' && exists)
    ? ['diff', '--no-ext-diff', '--no-color', '--no-index', '--unified=3', '--', '/dev/null', filePath]
    : file.status === 'added' && file.staged
      ? ['diff', '--no-ext-diff', '--no-color', '--unified=3', '--cached', '--', filePath]
      : ['diff', '--no-ext-diff', '--no-color', '--unified=3', 'HEAD', '--', filePath]
  let result: { stdout: string; stderr: string }
  try { result = await run(root, args, true, MAX_DIFF) } catch (error) {
    if (isMaxBufferError(error)) throw new GitError('diff_too_large', 'Diff exceeds the response limit', 413)
    throw error
  }
  if (Buffer.byteLength(result.stdout) > MAX_DIFF) throw new GitError('diff_too_large', 'Diff exceeds the response limit', 413)
  if (/^Binary files .* differ$/m.test(result.stdout)) return { path: filePath, binary: true }
  return { path: filePath, binary: false, lines: result.stdout.split(/\r?\n/).filter(Boolean).map((text) => ({ kind: text.startsWith('+++') || text.startsWith('---') || text.startsWith('diff ') ? 'header' : text.startsWith('@@') ? 'hunk' : text.startsWith('+') ? 'addition' : text.startsWith('-') ? 'deletion' : text.startsWith('\\') ? 'meta' : 'context', text })) }
}
async function fileExists(root: string, filePath: string): Promise<boolean> { try { return (await stat(path.resolve(root, filePath))).isFile() } catch { return false } }
async function realpathExistingAncestor(target: string): Promise<string> {
  let candidate = target
  while (true) {
    try { return await realpath(candidate) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const parent = path.dirname(candidate)
      if (parent === candidate) throw error
      candidate = parent
    }
  }
}
async function run(cwd: string, args: string[], allowExitOne = false, maxBuffer = MAX_BUFFER): Promise<{ stdout: string; stderr: string }> {
  try { return await execFile('git', args, { cwd, timeout: TIMEOUT, maxBuffer, encoding: 'utf8', windowsHide: true }) }
  catch (error) { const e = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }; if (allowExitOne && (e as { code?: unknown }).code === 1) return { stdout: e.stdout ?? '', stderr: e.stderr ?? '' }; throw error }
}
function parseStatus(output: string): { branch?: string; unborn: boolean; files: ChangedFile[] } {
  const records = output.split('\0'); let branch: string | undefined, unborn = false; const files: ChangedFile[] = []
  for (let i = 0; i < records.length; i++) { const rec = records[i] ?? ''; if (!rec) continue; if (rec.startsWith('## ')) { const label = rec.slice(3); if (label.startsWith('No commits yet on ')) { unborn = true; branch = label.slice('No commits yet on '.length).split('...')[0]?.split(' ')[0] } else if (label === 'HEAD (no branch)') branch = 'detached'; else branch = label.split('...')[0]?.split(' ')[0]; continue }
    const code = rec.slice(0, 2); let filePath = rec.slice(3)
    if (code.includes('R') || code.includes('C')) { i++; files.push(makeFile(filePath, code.includes('C') ? 'copied' : 'renamed', code)); continue }
    const status = code === '??' ? 'untracked' : code.includes('U') || code === 'AA' || code === 'DD' ? 'conflicted' : code[0] === 'A' ? 'added' : code.includes('D') ? 'deleted' : code.includes('A') ? 'added' : 'modified'; files.push(makeFile(filePath, status, code))
  } return { branch, unborn, files }
}
function makeFile(path: string, status: ChangedFile['status'], code = '  '): ChangedFile { return { path, status, staged: code[0] !== ' ' && code[0] !== '?', unstaged: code[1] !== ' ', additions: 0, deletions: 0, binary: false } }
function parseNumstat(text: string): Map<string, { additions: number; deletions: number; binary: boolean }> {
  const result = new Map<string, { additions: number; deletions: number; binary: boolean }>()
  const records = text.split('\0')
  for (let i = 0; i < records.length; i++) {
    const record = records[i] ?? ''
    if (!record) continue
    const firstTab = record.indexOf('\t'), secondTab = record.indexOf('\t', firstTab + 1)
    if (firstTab < 0 || secondTab < 0) continue
    const additionsText = record.slice(0, firstTab), deletionsText = record.slice(firstTab + 1, secondTab)
    let filePath = record.slice(secondTab + 1)
    if (!filePath) { i++; i++; filePath = records[i] ?? '' }
    if (!filePath) continue
    result.set(filePath, { additions: additionsText === '-' ? 0 : Number(additionsText), deletions: deletionsText === '-' ? 0 : Number(deletionsText), binary: additionsText === '-' || deletionsText === '-' })
  }
  return result
}
function isMaxBufferError(error: unknown): boolean { return Boolean(error && typeof error === 'object' && ((error as { code?: unknown }).code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || String((error as { message?: unknown }).message ?? '').includes('maxBuffer'))) }
function isMissingGit(error: unknown): boolean { return Boolean(error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT') }
function isNotRepo(error: unknown): boolean { return String((error as { stderr?: string })?.stderr ?? '').toLowerCase().includes('not a git repository') }

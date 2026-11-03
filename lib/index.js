// src/host/git.ts
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
var execFile = promisify(execFileCallback);
var TIMEOUT = 5e3;
var MAX_BUFFER = 2 * 1024 * 1024;
var MAX_DIFF = 512 * 1024;
var GitError = class extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
};
async function snapshot(sessionId, session) {
  const cwdValue = session.header?.cwd;
  if (typeof cwdValue !== "string" || !cwdValue.trim()) return { sessionId, repositoryStatus: "no-cwd", changedFiles: [] };
  const cwd = path.resolve(cwdValue);
  try {
    if (!(await stat(cwd)).isDirectory()) throw new Error();
  } catch {
    return { sessionId, cwd, repositoryStatus: "directory-missing", changedFiles: [] };
  }
  try {
    const { stdout: rootOut } = await run(cwd, ["rev-parse", "--show-toplevel"]), root = await realpath(rootOut.trim());
    const { stdout } = await run(root, ["status", "--porcelain=v1", "-z", "--branch"]), parsed = parseStatus(stdout);
    const { stdout: nums } = parsed.unborn ? await run(root, ["diff", "--numstat", "-z", "--cached", "--"]) : await run(root, ["diff", "--numstat", "-z", "HEAD", "--"]);
    const stats = parseNumstat(nums);
    for (const file of parsed.files) {
      const stat2 = stats.get(file.path);
      if (file.status === "untracked" || file.status === "added") {
        if (await fileExists(root, file.path)) {
          const result = await run(root, ["diff", "--no-index", "--numstat", "-z", "--", "/dev/null", file.path], true);
          const row = parseNumstat(result.stdout).get(file.path);
          if (row) Object.assign(file, row);
          else if (stat2) Object.assign(file, stat2);
        } else if (file.status === "added" && file.staged) {
          const result = await run(root, ["diff", "--numstat", "-z", "--cached", "--", file.path]);
          const stagedStat = parseNumstat(result.stdout).get(file.path);
          if (stagedStat) Object.assign(file, stagedStat);
          else if (stat2) Object.assign(file, stat2);
        } else if (stat2) Object.assign(file, stat2);
      } else if (stat2) Object.assign(file, stat2);
    }
    return { sessionId, cwd, branch: parsed.branch, repositoryStatus: "available", changedFiles: parsed.files, repoRoot: root };
  } catch (error) {
    if (isMissingGit(error)) throw new GitError("git_unavailable", "Git executable is unavailable", 503);
    if (isNotRepo(error)) return { sessionId, cwd, repositoryStatus: "not-repository", changedFiles: [] };
    throw new GitError("git_command_failed", "Git could not read this workspace", 500);
  }
}
async function fileDiff(session, filePath) {
  const file = session.changedFiles.find((item) => item.path === filePath);
  if (!file) throw new GitError("changed_path_mismatch", "Path is not in the latest changed-file snapshot", 404);
  const root = session.repoRoot;
  if (!session.cwd || !root) throw new GitError("not_repository", "Workspace is not a Git repository", 400);
  const absolute = path.resolve(root, filePath), rel = path.relative(root, absolute);
  if (!rel || rel.startsWith(`..${path.sep}`) || rel === ".." || path.isAbsolute(rel)) throw new GitError("invalid_path", "Path is outside the repository", 400);
  const existingAncestor = await realpathExistingAncestor(absolute);
  const ancestorRel = path.relative(root, existingAncestor);
  if (ancestorRel.startsWith(`..${path.sep}`) || ancestorRel === ".." || path.isAbsolute(ancestorRel)) throw new GitError("invalid_path", "Path is outside the repository", 400);
  const exists = await fileExists(root, filePath);
  if (!exists && file.status !== "deleted" && !(file.status === "added" && file.staged)) throw new GitError("changed_path_mismatch", "Changed file is no longer available", 404);
  if (exists) {
    const resolved = await realpath(absolute), inside = path.relative(root, resolved);
    if (inside.startsWith(`..${path.sep}`) || inside === ".." || path.isAbsolute(inside)) throw new GitError("invalid_path", "Path is outside the repository", 400);
  }
  if (file.binary) return { path: filePath, binary: true };
  const args = file.status === "untracked" || file.status === "added" && exists ? ["diff", "--no-ext-diff", "--no-color", "--no-index", "--unified=3", "--", "/dev/null", filePath] : file.status === "added" && file.staged ? ["diff", "--no-ext-diff", "--no-color", "--unified=3", "--cached", "--", filePath] : ["diff", "--no-ext-diff", "--no-color", "--unified=3", "HEAD", "--", filePath];
  let result;
  try {
    result = await run(root, args, true, MAX_DIFF);
  } catch (error) {
    if (isMaxBufferError(error)) throw new GitError("diff_too_large", "Diff exceeds the response limit", 413);
    throw error;
  }
  if (Buffer.byteLength(result.stdout) > MAX_DIFF) throw new GitError("diff_too_large", "Diff exceeds the response limit", 413);
  if (/^Binary files .* differ$/m.test(result.stdout)) return { path: filePath, binary: true };
  return { path: filePath, binary: false, lines: result.stdout.split(/\r?\n/).filter(Boolean).map((text) => ({ kind: text.startsWith("+++") || text.startsWith("---") || text.startsWith("diff ") ? "header" : text.startsWith("@@") ? "hunk" : text.startsWith("+") ? "addition" : text.startsWith("-") ? "deletion" : text.startsWith("\\") ? "meta" : "context", text })) };
}
async function fileExists(root, filePath) {
  try {
    return (await stat(path.resolve(root, filePath))).isFile();
  } catch {
    return false;
  }
}
async function realpathExistingAncestor(target) {
  let candidate = target;
  while (true) {
    try {
      return await realpath(candidate);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(candidate);
      if (parent === candidate) throw error;
      candidate = parent;
    }
  }
}
async function run(cwd, args, allowExitOne = false, maxBuffer = MAX_BUFFER) {
  try {
    return await execFile("git", args, { cwd, timeout: TIMEOUT, maxBuffer, encoding: "utf8", windowsHide: true });
  } catch (error) {
    const e = error;
    if (allowExitOne && e.code === 1) return { stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    throw error;
  }
}
function parseStatus(output) {
  const records = output.split("\0");
  let branch, unborn = false;
  const files = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i] ?? "";
    if (!rec) continue;
    if (rec.startsWith("## ")) {
      const label = rec.slice(3);
      if (label.startsWith("No commits yet on ")) {
        unborn = true;
        branch = label.slice("No commits yet on ".length).split("...")[0]?.split(" ")[0];
      } else if (label === "HEAD (no branch)") branch = "detached";
      else branch = label.split("...")[0]?.split(" ")[0];
      continue;
    }
    const code = rec.slice(0, 2);
    let filePath = rec.slice(3);
    if (code.includes("R") || code.includes("C")) {
      i++;
      files.push(makeFile(filePath, code.includes("C") ? "copied" : "renamed", code));
      continue;
    }
    const status = code === "??" ? "untracked" : code.includes("U") || code === "AA" || code === "DD" ? "conflicted" : code[0] === "A" ? "added" : code.includes("D") ? "deleted" : code.includes("A") ? "added" : "modified";
    files.push(makeFile(filePath, status, code));
  }
  return { branch, unborn, files };
}
function makeFile(path2, status, code = "  ") {
  return { path: path2, status, staged: code[0] !== " " && code[0] !== "?", unstaged: code[1] !== " ", additions: 0, deletions: 0, binary: false };
}
function parseNumstat(text) {
  const result = /* @__PURE__ */ new Map();
  const records = text.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i] ?? "";
    if (!record) continue;
    const firstTab = record.indexOf("	"), secondTab = record.indexOf("	", firstTab + 1);
    if (firstTab < 0 || secondTab < 0) continue;
    const additionsText = record.slice(0, firstTab), deletionsText = record.slice(firstTab + 1, secondTab);
    let filePath = record.slice(secondTab + 1);
    if (!filePath) {
      i++;
      i++;
      filePath = records[i] ?? "";
    }
    if (!filePath) continue;
    result.set(filePath, { additions: additionsText === "-" ? 0 : Number(additionsText), deletions: deletionsText === "-" ? 0 : Number(deletionsText), binary: additionsText === "-" || deletionsText === "-" });
  }
  return result;
}
function isMaxBufferError(error) {
  return Boolean(error && typeof error === "object" && (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" || String(error.message ?? "").includes("maxBuffer")));
}
function isMissingGit(error) {
  return Boolean(error && typeof error === "object" && error.code === "ENOENT");
}
function isNotRepo(error) {
  return String(error?.stderr ?? "").toLowerCase().includes("not a git repository");
}

// src/host/http.ts
var MAX_BODY_BYTES = 16 * 1024;
function isSameOrigin(headers) {
  const site = header(headers, "sec-fetch-site").toLowerCase();
  const origin = header(headers, "origin"), host = header(headers, "host");
  if (!host || /[\r\n]/.test(host)) return false;
  if (!origin && !site) return true;
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return false;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host.toLowerCase() && parsed.origin === origin.replace(/\/$/, "");
  } catch {
    return false;
  }
}
function header(headers, name2) {
  const value = headers[name2] ?? headers[name2.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large", "Request body is too large");
    chunks.push(bytes);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "invalid_body", "Request body must be a JSON object");
  return value;
}
var HttpError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function sendError(res, status, code, message) {
  const body = { ok: false, error: { code, message } };
  sendJson(res, status, body);
}

// src/host/plugin.ts
var name = "session-rail";
var inject = ["webServer", "sessions", "agents"];
var PREFIX = "/api/session-rail";
var COMMIT_INSTRUCTION = "Commit the working tree changes with a sensible message.";
function apply(ctx) {
  const register = () => {
    if (!ctx.webServer?.register || !ctx.sessions?.get) return () => void 0;
    return ctx.webServer.register({ kind: "prefix", path: PREFIX, handler: (req, res) => route(ctx, req, res) });
  };
  if (ctx.effect) ctx.effect(register, "session-rail: routes");
  else register();
}
async function route(ctx, req, res) {
  if (!isSameOrigin(req.headers)) {
    sendError(res, 403, "cross_origin", "Cross-origin requests are refused");
    return;
  }
  if (String(req.method ?? "").toUpperCase() !== "POST") {
    sendError(res, 405, "method_not_allowed", "Only POST is supported");
    return;
  }
  if (!/^application\/json(?:\s*;|$)/i.test(header(req.headers, "content-type"))) {
    sendError(res, 415, "json_required", "Content-Type must be application/json");
    return;
  }
  try {
    const url = new URL(req.url ?? "/", "http://dsh.local"), body = await readJsonBody(req);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId || sessionId.length > 512) throw new HttpError(400, "invalid_session_id", "A valid sessionId is required");
    const session = ctx.sessions?.get(sessionId);
    if (!session) throw new HttpError(404, "session_not_found", "Session was not found");
    const current = await snapshot(sessionId, session);
    if (url.pathname === `${PREFIX}/snapshot`) {
      const agent = ctx.agents?.get(sessionId);
      sendJson(res, 200, { ok: true, data: { ...publicSnapshot(current), followupAvailable: typeof agent?.followup === "function" } });
      return;
    }
    if (url.pathname === `${PREFIX}/commit-request`) {
      const agent = ctx.agents?.get(sessionId);
      if (typeof agent?.followup !== "function") throw new HttpError(409, "agent_unavailable", "No active agent is available for this session");
      const message = {
        id: crypto.randomUUID(),
        role: "user",
        content: [{ type: "text", text: COMMIT_INSTRUCTION }],
        source: { kind: "user" }
      };
      try {
        agent.followup(message);
      } catch {
        throw new HttpError(503, "agent_followup_failed", "Agent could not accept the commit request");
      }
      sendJson(res, 200, { ok: true, data: { accepted: true } });
      return;
    }
    if (url.pathname === `${PREFIX}/diff`) {
      if (typeof body.path !== "string" || !body.path || body.path.length > 4096) throw new HttpError(400, "invalid_path", "A valid changed-file path is required");
      const diff = await fileDiff(current, body.path);
      sendJson(res, 200, { ok: true, data: diff });
      return;
    }
    sendError(res, 404, "route_not_found", "Route was not found");
  } catch (error) {
    if (error instanceof HttpError || error instanceof GitError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    sendError(res, 500, "git_command_failed", "Git request failed");
  }
}
function publicSnapshot(value) {
  const { repoRoot: _repoRoot, ...safe } = value;
  return safe;
}
export {
  apply,
  inject,
  name
};

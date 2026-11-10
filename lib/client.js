window.__ModuleLoader__.load({
  id: "session-rail",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/entry.tsx
var entry_exports = {};
__export(entry_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(entry_exports);
var import_react2 = __toESM(require("react"), 1);

// src/client/pane.tsx
var import_react = __toESM(require("react"), 1);

// src/client/api.ts
var PREFIX = "/api/session-rail";
var RailApiError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "RailApiError";
  }
};
async function post(path, payload, signal) {
  const response = await fetch(`${PREFIX}/${path}`, {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new RailApiError("invalid_response", `Request failed (${response.status})`);
  }
  if (!response.ok || !value.ok) {
    const error = value.ok ? void 0 : value.error;
    throw new RailApiError(error?.code ?? "request_failed", error?.message ?? `Request failed (${response.status})`);
  }
  return value.data;
}
var getSnapshot = (sessionId, signal) => post("snapshot", { sessionId }, signal);
var requestCommit = (sessionId, signal) => post("commit-request", { sessionId }, signal);

// src/client/addresses.ts
var CHANGED_FILES_ROUTE = "api/changes.summary";
var CHANGES_REVIEW_ADDRESS = "dsh-resource://changes-review/session/";
var FILE_ADDRESS_PREFIX = "dsh-resource://file/";
function changesReviewAddress(coordinates) {
  const { sessionId, seq, turn } = coordinates;
  return `${CHANGES_REVIEW_ADDRESS}${encodeURIComponent(sessionId)}/${seq}/${turn}`;
}
function changesSummaryUrl(sessionId, seq) {
  return `${CHANGED_FILES_ROUTE}?${new URLSearchParams({ sessionId, seq: String(seq) })}`;
}
function encodeSegment(value) {
  return encodeURIComponent(value).replace(/%3A/gi, ":");
}
function encodePath(path) {
  return path.split("/").map(encodeSegment).join("/");
}
function isAbsoluteWorkspacePath(path) {
  return path.startsWith("/") || /^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\");
}
function sessionFileAddress(sessionId, path) {
  const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
  return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
}
function fileAddressFor(sessionId, cwd, path) {
  const normalized = path.replace(/\\/g, "/");
  if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
  const root = cwd === void 0 ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
  if (root !== "" && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
  return sessionFileAddress(sessionId, normalized);
}
function normalizeWorkspacePath(path) {
  return path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
}
var SUBAGENT_CHAT_ADDRESS = "dsh-resource://subagentchat/session/";
function subagentChatAddress(address) {
  const query = new URLSearchParams({ parent: address.parentSessionId, mode: address.mode });
  return `${SUBAGENT_CHAT_ADDRESS}${encodeURIComponent(address.childSessionId)}?${query}`;
}

// src/client/context-model.ts
var CATEGORY_META = [
  { key: "system", color: "var(--color-indigo-500, #6366f1)" },
  { key: "tools", color: "var(--color-amber-500, #f59e0b)" },
  { key: "user", color: "var(--color-green-500, #22c55e)" },
  { key: "inject", color: "var(--color-purple-500, #a855f7)" },
  { key: "skill", color: "var(--color-orange-500, #f97316)" },
  { key: "assistant", color: "var(--color-blue-500, #3b82f6)" },
  { key: "tool", color: "var(--color-teal-500, #14b8a6)" },
  { key: "messages", color: "var(--color-green-500, #22c55e)" },
  { key: "thinking", color: "var(--color-violet-500, #8b5cf6)" },
  { key: "answers", color: "var(--color-pink-500, #ec4899)" },
  { key: "free", color: "color-mix(in srgb, currentColor 14%, transparent)" },
  { key: "compactionReserve", color: "var(--color-slate-400, #94a3b8)" }
];
var MESSAGE_KEYS = ["user", "inject", "skill", "assistant", "tool"];
var COMPACTION_HEADROOM = 65536;
function buildContextView(input) {
  const pressure = sanitizePressure(input.pressure);
  const breakdown = sanitizeBreakdown(input.breakdown);
  const usage = sanitizeUsage(input.usage);
  const timeline = sanitizeTimeline(input.timeline);
  if (timeline) {
    return fromTimeline(timeline, pressure, breakdown, usage);
  }
  return fromMeter(pressure, breakdown, usage);
}
function fromTimeline(timeline, pressure, breakdown, usage) {
  const current = timeline.current;
  const projected = finite(pressure?.projectedTokens);
  const pressureTokens = finite(pressure?.pressureTokens);
  const last = timeline.last;
  const lastRequest = timeline.requests?.length ? timeline.requests[timeline.requests.length - 1] : void 0;
  const promptAnchor = last ?? lastRequest;
  const reconstructed = promptAnchor && finite(promptAnchor.prompt) !== void 0 ? finite(promptAnchor.prompt) + (finite(current.total) ?? 0) - (finite(promptAnchor.total) ?? 0) : void 0;
  const used = projected ?? pressureTokens ?? reconstructed ?? finite(current.total) ?? 0;
  const window2 = finite(pressure?.contextWindow) ?? finite(timeline.contextWindow);
  const parts = scaleParts(distributeTimelineParts(current, breakdown), used > 0 ? used : null);
  const free = window2 !== void 0 ? Math.max(0, window2 - used) : void 0;
  if (free !== void 0 && free > 0) parts.push(part("free", free));
  const reserve = compactionReserve(window2, timeline.maxOutputTokens);
  const unavailable = unavailableClaudeExtras({
    mode: "timeline",
    hasCompactionReserve: !!reserve
  });
  return {
    source: "timeline",
    used,
    window: window2,
    pct: window2 && window2 > 0 ? clampPct(used / window2 * 100) : void 0,
    estimated: pressureTokens === void 0,
    parts: parts.filter((p) => p.tokens > 0 || p.key === "free"),
    categories: categoryRows(parts, used, window2),
    unavailable,
    timing: timingSummary(timeline.timing),
    usage,
    model: timeline.model,
    provider: timeline.provider,
    assistantDetail: {
      reasoning: finite(current.assistantReasoning),
      answers: finite(current.assistantAnswerTokens),
      calls: finite(current.assistantCallTokens)
    },
    compactionReserve: reserve
  };
}
function fromMeter(pressure, breakdown, usage) {
  const projected = finite(pressure?.projectedTokens);
  const pressureTokens = finite(pressure?.pressureTokens);
  const used = pressureTokens ?? projected;
  const window2 = finite(pressure?.contextWindow);
  const parts = [];
  if (breakdown) {
    if (finite(breakdown.systemTokens) !== void 0) parts.push(part("system", breakdown.systemTokens));
    if (finite(breakdown.toolsTokens) !== void 0) parts.push(part("tools", breakdown.toolsTokens));
    if (finite(breakdown.messageTokens) !== void 0) parts.push(part("messages", breakdown.messageTokens));
  }
  const free = used !== void 0 && window2 !== void 0 ? Math.max(0, window2 - used) : void 0;
  if (free !== void 0 && free > 0) parts.push(part("free", free));
  const reserve = compactionReserve(window2, void 0);
  return {
    source: used !== void 0 || breakdown ? "meter" : "none",
    used,
    window: window2,
    pct: used !== void 0 && window2 && window2 > 0 ? clampPct(used / window2 * 100) : void 0,
    estimated: pressureTokens === void 0 && (projected !== void 0 || !!breakdown),
    parts: parts.filter((p) => p.tokens > 0 || p.key === "free"),
    categories: categoryRows(parts, used ?? sumParts(parts.filter((p) => p.key !== "free")), window2),
    unavailable: unavailableClaudeExtras({
      mode: "meter",
      hasCompactionReserve: !!reserve,
      hasMessages: !!breakdown && finite(breakdown.messageTokens) !== void 0
    }),
    usage,
    compactionReserve: reserve
  };
}
function distributeTimelineParts(current, breakdown) {
  const messageTotal = MESSAGE_KEYS.reduce((sum2, key) => sum2 + (finite(current[key]) ?? 0), 0);
  const system = finite(breakdown?.systemTokens) ?? finite(current.system) ?? 0;
  const tools = finite(breakdown?.toolsTokens) ?? finite(current.tools) ?? 0;
  const messageBudget = finite(breakdown?.messageTokens) ?? messageTotal;
  const values = { system, tools };
  if (messageTotal > 0 && messageBudget > 0) {
    let allocated = 0;
    let dominant = "user";
    for (const key of MESSAGE_KEYS) {
      const share = Math.round(messageBudget * ((finite(current[key]) ?? 0) / messageTotal));
      values[key] = share;
      allocated += share;
      if ((finite(current[key]) ?? 0) > (finite(current[dominant]) ?? 0)) dominant = key;
    }
    values[dominant] = Math.max(0, (values[dominant] ?? 0) + messageBudget - allocated);
  } else {
    for (const key of MESSAGE_KEYS) values[key] = 0;
  }
  return CATEGORY_META.filter((meta) => meta.key !== "messages" && meta.key !== "free" && meta.key !== "compactionReserve" && meta.key !== "thinking" && meta.key !== "answers").map((meta) => part(meta.key, values[meta.key] ?? 0));
}
function scaleParts(parts, target) {
  if (target === null || target <= 0) return parts.map((p) => ({ ...p, raw: p.tokens }));
  const total = parts.reduce((sum2, p) => sum2 + p.tokens, 0);
  if (total <= 0) return parts.map((p) => ({ ...p, raw: p.tokens }));
  if (total === target) return parts.map((p) => ({ ...p, raw: p.tokens }));
  const scale = target / total;
  return parts.map((p) => ({ ...p, raw: p.tokens, tokens: Math.round(p.tokens * scale) }));
}
function categoryRows(parts, used, window2) {
  const base = used && used > 0 ? used : sumParts(parts.filter((p) => p.key !== "free"));
  return parts.map((p) => ({
    ...p,
    shareOfUsed: p.key === "free" || !base ? void 0 : p.tokens / base * 100,
    shareOfWindow: window2 && window2 > 0 ? p.tokens / window2 * 100 : void 0
  }));
}
function unavailableClaudeExtras(flags) {
  const missing = ["mcp", "memory"];
  if (flags.mode === "meter") missing.push("skill");
  if (flags.mode === "meter" && !flags.hasMessages) missing.push("messages");
  if (!flags.hasCompactionReserve) missing.push("compactionReserve");
  return missing;
}
function compactionReserve(window2, maxOutputTokens) {
  if (window2 === void 0 || !(window2 > 0)) return void 0;
  const output = Math.min(finite(maxOutputTokens) ?? 0, window2);
  const remainder = window2 - output - COMPACTION_HEADROOM;
  if (remainder <= 0) return void 0;
  return COMPACTION_HEADROOM;
}
function timingSummary(timing) {
  if (!timing) return void 0;
  const wallMs = finite(timing.wallMs);
  const toolsMs = finite(timing.toolsMs);
  const genMs = finite(timing.genMs);
  const ttftMs = finite(timing.ttftMs);
  const speedTokens = finite(timing.speedTokens);
  const speedMs = finite(timing.speedMs);
  const tokensPerSecond = speedTokens !== void 0 && speedMs && speedMs > 0 ? speedTokens / (speedMs / 1e3) : void 0;
  if ([wallMs, toolsMs, genMs, ttftMs, tokensPerSecond].every((v) => v === void 0)) return void 0;
  return { wallMs, toolsMs, genMs, ttftMs, tokensPerSecond };
}
function part(key, tokens) {
  const color = CATEGORY_META.find((item) => item.key === key)?.color ?? "var(--color-slate-400, #94a3b8)";
  return { key, tokens: Math.max(0, tokens), color };
}
function sanitizePressure(value) {
  if (!value || typeof value !== "object") return void 0;
  const next = {};
  if (finite(value.pressureTokens) !== void 0) next.pressureTokens = value.pressureTokens;
  if (finite(value.projectedTokens) !== void 0) next.projectedTokens = value.projectedTokens;
  if (finite(value.contextWindow) !== void 0) next.contextWindow = value.contextWindow;
  return Object.keys(next).length ? next : void 0;
}
function sanitizeBreakdown(value) {
  if (!value || typeof value !== "object") return void 0;
  const next = {};
  if (finite(value.systemTokens) !== void 0) next.systemTokens = value.systemTokens;
  if (finite(value.toolsTokens) !== void 0) next.toolsTokens = value.toolsTokens;
  if (finite(value.messageTokens) !== void 0) next.messageTokens = value.messageTokens;
  return Object.keys(next).length ? next : void 0;
}
function sanitizeUsage(value) {
  if (!value || typeof value !== "object") return void 0;
  const next = {};
  if (finite(value.uncachedInputTokens) !== void 0) next.uncachedInputTokens = value.uncachedInputTokens;
  if (finite(value.outputTokens) !== void 0) next.outputTokens = value.outputTokens;
  if (finite(value.cacheReadTokens) !== void 0) next.cacheReadTokens = value.cacheReadTokens;
  if (finite(value.cacheWriteTokens) !== void 0) next.cacheWriteTokens = value.cacheWriteTokens;
  return Object.keys(next).length ? next : void 0;
}
function sanitizeTimeline(value) {
  if (!value || typeof value !== "object") return void 0;
  const raw = value.current;
  if (!raw || typeof raw !== "object") return void 0;
  const current = {
    system: finite(raw.system) ?? 0,
    tools: finite(raw.tools) ?? 0,
    user: finite(raw.user) ?? 0,
    inject: finite(raw.inject) ?? 0,
    skill: finite(raw.skill) ?? 0,
    assistant: finite(raw.assistant) ?? 0,
    assistantReasoning: finite(raw.assistantReasoning),
    assistantAnswerTokens: finite(raw.assistantAnswerTokens),
    assistantCallTokens: finite(raw.assistantCallTokens),
    tool: finite(raw.tool) ?? 0,
    total: finite(raw.total) ?? 0
  };
  return {
    ...value,
    current,
    contextWindow: finite(value.contextWindow),
    maxOutputTokens: finite(value.maxOutputTokens),
    model: typeof value.model === "string" ? value.model : void 0,
    provider: typeof value.provider === "string" ? value.provider : void 0
  };
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : void 0;
}
function clampPct(value) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}
function sumParts(parts) {
  return parts.reduce((sum2, part2) => sum2 + part2.tokens, 0);
}
function hasProviderUsage(usage) {
  if (!usage) return false;
  return [usage.uncachedInputTokens, usage.cacheReadTokens, usage.cacheWriteTokens, usage.outputTokens].some((value) => finite(value) !== void 0);
}
function formatTokens(value) {
  const number = finite(value);
  return number === void 0 ? "\u2014" : Intl.NumberFormat().format(number);
}
function formatDuration(ms) {
  if (ms === void 0) return "\u2014";
  if (ms < 1e3) return `${Math.round(ms)}ms`;
  if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
  const minutes = Math.floor(ms / 6e4);
  const seconds = Math.round(ms % 6e4 / 1e3);
  return `${minutes}m ${seconds}s`;
}

// src/client/i18n.ts
var words = {
  zh: {
    environment: "\u73AF\u5883\u4FE1\u606F",
    context: "\u4E0A\u4E0B\u6587",
    plugins: "\u63D2\u4EF6",
    outputFiles: "\u8F93\u51FA\u6587\u4EF6",
    delivered: "\u4EA4\u4ED8",
    outputEmpty: "\u6682\u65E0\u672C\u4F1A\u8BDD\u7684\u8F93\u51FA\u6587\u4EF6\u8BB0\u5F55",
    outputSummaryUnavailable: "\u53D8\u66F4\u6458\u8981\u5DF2\u4E0D\u53EF\u7528\uFF0C\u53EF\u80FD\u56E0 Host \u91CD\u542F\u800C\u4E22\u5931\u3002",
    outputNoChanges: "\u672C\u4F1A\u8BDD\u6CA1\u6709\u8BB0\u5F55\u5230\u6587\u4EF6\u53D8\u66F4",
    outputUnavailable: "\u8F93\u51FA\u6587\u4EF6\u6682\u4E0D\u53EF\u7528",
    outputTurnEmpty: "\u672C\u8F6E\u6CA1\u6709\u8BB0\u5F55\u5230\u6587\u4EF6\u53D8\u66F4",
    turn: (n) => `\u7B2C ${n} \u8F6E`,
    openFailed: "\u65E0\u6CD5\u6253\u5F00\u5BA1\u67E5\u9875\u6216\u6587\u4EF6\u9884\u89C8\u3002",
    changes: "\u53D8\u66F4",
    refresh: "\u5237\u65B0",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    noSession: "\u5F53\u524D\u6CA1\u6709\u4F1A\u8BDD",
    noCwd: "\u4F1A\u8BDD\u672A\u63D0\u4F9B\u9879\u76EE\u76EE\u5F55",
    noBranch: "\u65E0\u5206\u652F\u4FE1\u606F",
    noRepo: "\u6B64\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93",
    missingDir: "\u9879\u76EE\u76EE\u5F55\u4E0D\u5B58\u5728",
    gitUnavailable: "Git \u4FE1\u606F\u6682\u4E0D\u53EF\u7528",
    clean: "\u5DE5\u4F5C\u533A\u5E72\u51C0",
    noPlugins: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u63D2\u4EF6",
    pluginsUnavailable: "\u63D2\u4EF6\u6E05\u5355\u6682\u4E0D\u53EF\u7528",
    contextUnavailable: "\u4E0A\u4E0B\u6587\u7528\u91CF\u6682\u4E0D\u53EF\u7528",
    estimated: "\u4F30\u7B97",
    current: "\u5F53\u524D\u4E0A\u4E0B\u6587",
    providerUsage: "\u6A21\u578B\u7D2F\u8BA1\u7528\u91CF",
    system: "\u7CFB\u7EDF\u63D0\u793A",
    tools: "\u5DE5\u5177\u5B9A\u4E49",
    messages: "\u6D88\u606F",
    user: "\u7528\u6237\u6D88\u606F",
    inject: "\u6CE8\u5165\u5185\u5BB9",
    skill: "\u6280\u80FD",
    assistant: "\u52A9\u624B\u6D88\u606F",
    tool: "\u5DE5\u5177\u7ED3\u679C",
    thinking: "\u601D\u8003",
    answers: "\u56DE\u590D",
    free: "\u5269\u4F59\u7A97\u53E3",
    mcp: "MCP \u6307\u4EE4",
    memory: "\u8BB0\u5FC6",
    compactionReserve: "\u538B\u7F29\u9884\u7559",
    ofUsed: "\u5360\u5DF2\u7528",
    ofWindow: "\u5360\u7A97\u53E3",
    unavailable: "\u4E0D\u53EF\u7528",
    tokens: "tokens",
    cacheRead: "\u7F13\u5B58\u547D\u4E2D",
    cacheWrite: "\u7F13\u5B58\u5199\u5165",
    uncachedInput: "\u672A\u7F13\u5B58\u8F93\u5165",
    output: "\u8F93\u51FA",
    timing: "\u8017\u65F6",
    activeDuration: "\u6D3B\u8DC3\u65F6\u957F",
    modelWait: "\u6A21\u578B\u751F\u6210",
    toolExec: "\u5DE5\u5177\u6267\u884C",
    ttft: "\u9996 token",
    outputSpeed: "\u8F93\u51FA\u901F\u5EA6",
    tokensPerSec: "tok/s",
    sourceTimeline: "\u7EC6\u7C92\u5EA6\uFF08contextTimeline\uFF09",
    sourceMeter: "token-meter \u4F30\u7B97",
    expand: "\u5C55\u5F00",
    collapse: "\u6536\u8D77",
    files: (n) => `${n} \u4E2A\u6587\u4EF6`,
    added: "\u65B0\u589E",
    modified: "\u4FEE\u6539",
    deleted: "\u5220\u9664",
    renamed: "\u91CD\u547D\u540D",
    copied: "\u590D\u5236",
    untracked: "\u672A\u8DDF\u8E2A",
    conflicted: "\u51B2\u7A81",
    staged: "\u5DF2\u6682\u5B58",
    unstaged: "\u672A\u6682\u5B58",
    binary: "\u4E8C\u8FDB\u5236",
    viewDiff: "\u67E5\u770B\u5DEE\u5F02",
    hideDiff: "\u6536\u8D77\u5DEE\u5F02",
    diffUnavailable: "\u5DEE\u5F02\u6682\u4E0D\u53EF\u7528",
    diffTooLarge: "\u5DEE\u5F02\u5185\u5BB9\u8FC7\u5927\uFF0C\u65E0\u6CD5\u663E\u793A",
    branch: "\u5206\u652F",
    project: "\u9879\u76EE",
    computer: "\u6B64\u8BA1\u7B97\u673A",
    enabled: "\u5DF2\u542F\u7528",
    disabled: "\u5DF2\u505C\u7528",
    error: "\u8BFB\u53D6\u5931\u8D25",
    reviewTarget: "\u5BA1\u67E5\u9875\u9762",
    reviewUnavailable: "\u5BA1\u67E5\u9875\u9762\u672A\u5B89\u88C5\u6216\u672A\u542F\u7528\uFF0C\u5DF2\u6539\u7528\u5B98\u65B9\u5BA1\u67E5\u9875\u3002",
    reviewOptional: "\u53EF\u9009\u8986\u76D6",
    commitChanges: "\u63D0\u4EA4\u53D8\u66F4",
    commitSending: "\u6B63\u5728\u53D1\u9001\u2026",
    commitQueued: "\u63D0\u4EA4\u8BF7\u6C42\u5DF2\u6392\u961F",
    commitError: "\u63D0\u4EA4\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
    commitNoSession: "\u9009\u62E9\u4F1A\u8BDD\u540E\u624D\u80FD\u63D0\u4EA4\u3002",
    commitNoFiles: "\u6CA1\u6709\u53D8\u66F4\u6587\u4EF6\u53EF\u63D0\u4EA4\u3002",
    commitNoAgent: "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u5B9E\u65F6 Agent\u3002",
    backgroundTasks: "\u540E\u53F0\u4EFB\u52A1",
    tasks: "\u4EFB\u52A1",
    subagents: "\u5B50\u4EE3\u7406",
    stop: "\u505C\u6B62",
    confirmStop: "\u786E\u8BA4\u505C\u6B62",
    stopping: "\u6B63\u5728\u505C\u6B62",
    finished: (n) => `\u5DF2\u5B8C\u6210 ${n} \u9879`,
    backgroundEmpty: "\u5F53\u524D\u6CA1\u6709\u540E\u53F0\u4EFB\u52A1\u6216\u5B50\u4EE3\u7406",
    jobsError: "\u540E\u53F0\u4EFB\u52A1\u5217\u8868\u8BFB\u53D6\u5931\u8D25\u3002",
    jobsKillError: "\u505C\u6B62\u4EFB\u52A1\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
    catalogError: "\u5B50\u4EE3\u7406\u76EE\u5F55\u8BFB\u53D6\u5931\u8D25\u3002",
    catalogMigration: "\u5B50\u4EE3\u7406\u76EE\u5F55\u9700\u8981\u8FC1\u79FB\u540E\u624D\u80FD\u5B8C\u6574\u663E\u793A\u3002",
    jobCompleted: "\u5DF2\u5B8C\u6210",
    jobKilled: "\u5DF2\u7EC8\u6B62",
    jobFailed: "\u5931\u8D25",
    subagentExternal: "\u5916\u90E8\u4EFB\u52A1",
    tabError: "\u9762\u677F\u65E0\u6CD5\u663E\u793A\u3002"
  },
  en: {
    environment: "Environment",
    context: "Context",
    plugins: "Plugins",
    outputFiles: "Output files",
    delivered: "Delivered",
    outputEmpty: "No output-file records for this session",
    outputSummaryUnavailable: "The change summary is no longer available, possibly because the Host was restarted.",
    outputNoChanges: "No file changes were recorded for this session",
    outputUnavailable: "Output files are unavailable",
    outputTurnEmpty: "No file changes were recorded for this turn",
    turn: (n) => `Turn ${n}`,
    openFailed: "Could not open the review tab or file preview.",
    changes: "Changes",
    refresh: "Refresh",
    loading: "Loading\u2026",
    noSession: "No session selected",
    noCwd: "Session has no project directory",
    noBranch: "No branch information",
    noRepo: "This directory is not a Git repository",
    missingDir: "Project directory does not exist",
    gitUnavailable: "Git information is unavailable",
    clean: "Working tree clean",
    noPlugins: "No plugins to show",
    pluginsUnavailable: "Plugin inventory unavailable",
    contextUnavailable: "Context usage unavailable",
    estimated: "Estimated",
    current: "Current context",
    providerUsage: "Cumulative model usage",
    system: "System prompt",
    tools: "Tool schemas",
    messages: "Messages",
    user: "User messages",
    inject: "Injected context",
    skill: "Skills",
    assistant: "Assistant",
    tool: "Tool results",
    thinking: "Thinking",
    answers: "Answers",
    free: "Free window",
    mcp: "MCP instructions",
    memory: "Memory",
    compactionReserve: "Compaction reserve",
    ofUsed: "of used",
    ofWindow: "of window",
    unavailable: "Unavailable",
    tokens: "tokens",
    cacheRead: "Cache read",
    cacheWrite: "Cache write",
    uncachedInput: "Uncached input",
    output: "Output",
    timing: "Timing",
    activeDuration: "Active duration",
    modelWait: "Model generation",
    toolExec: "Tool execution",
    ttft: "Time to first token",
    outputSpeed: "Output speed",
    tokensPerSec: "tok/s",
    sourceTimeline: "Fine-grained (contextTimeline)",
    sourceMeter: "token-meter estimate",
    expand: "Expand",
    collapse: "Collapse",
    files: (n) => `${n} files`,
    added: "Added",
    modified: "Modified",
    deleted: "Deleted",
    renamed: "Renamed",
    copied: "Copied",
    untracked: "Untracked",
    conflicted: "Conflicted",
    staged: "Staged",
    unstaged: "Unstaged",
    binary: "Binary",
    viewDiff: "View diff",
    hideDiff: "Hide diff",
    diffUnavailable: "Diff unavailable",
    diffTooLarge: "Diff is too large to display",
    branch: "Branch",
    project: "Project",
    computer: "This computer",
    enabled: "Enabled",
    disabled: "Disabled",
    error: "Failed to load",
    reviewTarget: "Review page",
    reviewUnavailable: "Review page is not installed or enabled. Using the official review tab.",
    reviewOptional: "Optional override",
    commitChanges: "Commit changes",
    commitSending: "Sending\u2026",
    commitQueued: "Commit request queued",
    commitError: "Commit request failed. Try again later.",
    commitNoSession: "Select a session before committing.",
    commitNoFiles: "There are no changed files to commit.",
    commitNoAgent: "No live Agent is available.",
    backgroundTasks: "Background tasks",
    tasks: "Tasks",
    subagents: "Sub-agents",
    stop: "Stop",
    confirmStop: "Confirm stop",
    stopping: "Stopping",
    finished: (n) => `${n} finished`,
    backgroundEmpty: "No background tasks or sub-agents",
    jobsError: "The background job list could not be read.",
    jobsKillError: "Could not stop the job. Try again later.",
    catalogError: "The sub-agent catalog could not be read.",
    catalogMigration: "The sub-agent catalog needs migration before it can be shown completely.",
    jobCompleted: "Completed",
    jobKilled: "Stopped",
    jobFailed: "Failed",
    subagentExternal: "External",
    tabError: "This panel could not be displayed."
  }
};
function detectLang() {
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}
function t(key) {
  return words[detectLang()][key];
}

// src/client/output-model.ts
var OUTPUT_VIEW_TARGET = "sessionRailOutput";
var OUTPUT_KIND = "session-rail-output";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isChangesEvent(value) {
  return isRecord(value) && Number.isSafeInteger(value.turn) && value.turn >= 1;
}
function isPresentedFile(value) {
  return isRecord(value) && typeof value.path === "string" && value.path.length > 0 && (value.description === void 0 || typeof value.description === "string");
}
function isPresentedData(value) {
  return isChangesEvent(value) && Array.isArray(value.files);
}
function isChangedFile(value) {
  if (!isRecord(value)) return false;
  const { path, display, added, deleted, binary, oversized } = value;
  return typeof path === "string" && path.length > 0 && typeof display === "string" && Number.isSafeInteger(added) && Number.isSafeInteger(deleted) && (binary === void 0 || binary === true) && (oversized === void 0 || oversized === true);
}
function isChangesSummary(value) {
  if (!isRecord(value)) return false;
  const { turn, files, total, added, deleted } = value;
  return Number.isSafeInteger(turn) && turn >= 1 && Number.isSafeInteger(total) && Number.isSafeInteger(added) && Number.isSafeInteger(deleted) && Array.isArray(files) && files.every(isChangedFile);
}
function applyPresented(state, event) {
  if (!isPresentedData(event.data)) return state;
  const next = [...state.presented];
  for (let index = 0; index < event.data.files.length; index++) {
    const file = event.data.files[index];
    if (!isPresentedFile(file)) continue;
    const incoming = { path: file.path, description: file.description, seq: event.seq, index };
    const existing = next.findIndex((item) => normalizeWorkspacePath(item.path) === normalizeWorkspacePath(file.path));
    if (existing >= 0) next[existing] = incoming;
    else next.push(incoming);
  }
  return { ...state, presented: next };
}
function applyEvent(state, event) {
  if (event.type === "workspace/changes" && isChangesEvent(event.data)) {
    return { ...state, turn: event.data.turn, seq: event.seq };
  }
  if (event.type === "deliverables/presented") return applyPresented({ ...state, turn: isChangesEvent(event.data) ? event.data.turn : state.turn }, event);
  return state;
}
function turnOf(event) {
  return isChangesEvent(event.data) ? event.data.turn : 0;
}
var outputFilesDefinition = {
  kind: OUTPUT_KIND,
  target: OUTPUT_VIEW_TARGET,
  match(event) {
    if (event.type === "workspace/changes" && isChangesEvent(event.data)) {
      return { id: String(event.data.turn), role: "start" };
    }
    if (event.type === "deliverables/presented" && isPresentedData(event.data)) {
      return { id: String(event.data.turn), role: "start" };
    }
    return null;
  },
  start(_context, match) {
    return applyEvent({ turn: turnOf(match.event), presented: [] }, match.event);
  },
  update(context, match) {
    return applyEvent(context.state, match.event);
  },
  buildViewNode(context) {
    const state = context.state;
    if (!state || state.seq === void 0 && state.presented.length === 0) return null;
    return {
      key: context.key,
      kind: OUTPUT_KIND,
      id: String(state.turn),
      target: OUTPUT_VIEW_TARGET,
      data: { turn: state.turn, seq: state.seq, presented: state.presented }
    };
  }
};
function snapshotFromNodes(nodes) {
  const byTurn = /* @__PURE__ */ new Map();
  for (const node of nodes) byTurn.set(node.data.turn, node.data);
  return { turns: [...byTurn.values()].sort((a, b) => b.turn - a.turn) };
}
var outputFilesView = {
  target: OUTPUT_VIEW_TARGET,
  create() {
    let nodes = [];
    return {
      empty: { turns: [] },
      replace(input) {
        nodes = [...input.nodes];
        return snapshotFromNodes(nodes);
      },
      apply(input) {
        const map = new Map(nodes.map((node) => [node.id, node]));
        for (const node of input.upserts) map.set(node.id, node);
        nodes = [...map.values()];
        return snapshotFromNodes(nodes);
      }
    };
  }
};
function registerOutputFiles(ui) {
  if (!ui?.events?.register || !ui?.views?.register) return () => void 0;
  const disposeEvents = ui.events.register(outputFilesDefinition);
  const disposeView = ui.views.register(outputFilesView);
  return () => {
    disposeEvents();
    disposeView();
  };
}
function subscribeOutputTurns(ui, sessionId, onChange) {
  if (!ui?.binding || !sessionId) {
    onChange([]);
    return () => void 0;
  }
  try {
    const source = ui.binding(sessionId).target(OUTPUT_VIEW_TARGET);
    const sync = () => onChange(source.getSnapshot()?.turns ?? []);
    const unsubscribe = source.subscribe(sync);
    sync();
    return unsubscribe;
  } catch {
    onChange("unavailable");
    return () => void 0;
  }
}
async function loadChangesSummary(sessionId, seq, signal) {
  try {
    const response = await fetch(changesSummaryUrl(sessionId, seq), { method: "GET", credentials: "same-origin", signal });
    if (response.status === 404) return "missing";
    if (!response.ok) return "error";
    const value = await response.json();
    return isChangesSummary(value) ? value : "error";
  } catch (error) {
    if (signal?.aborted) throw error;
    return "error";
  }
}
function indexOfChangedPath(files, path) {
  const want = normalizeWorkspacePath(path);
  const exactPath = files.findIndex((file) => normalizeWorkspacePath(file.path) === want);
  if (exactPath >= 0) return exactPath;
  const exactDisplay = files.findIndex((file) => normalizeWorkspacePath(file.display) === want);
  if (exactDisplay >= 0) return exactDisplay;
  const suffix = [];
  files.forEach((file, index) => {
    const candidate = normalizeWorkspacePath(file.path);
    const display = normalizeWorkspacePath(file.display);
    if (candidate.endsWith(`/${want}`) || want.endsWith(`/${candidate}`) || display.endsWith(`/${want}`) || want.endsWith(`/${display}`)) suffix.push(index);
  });
  return suffix.length === 1 ? suffix[0] : -1;
}
function findLatestChangeMatch(path, turns) {
  for (const turn of turns) {
    if (turn.seq === void 0 || !turn.summary || typeof turn.summary === "string") continue;
    const index = indexOfChangedPath(turn.summary.files, path);
    if (index >= 0) return { turn: turn.turn, seq: turn.seq, index };
  }
  return void 0;
}

// src/client/background-model.ts
var KILL_ARM_MS = 3e3;
function isJobLive(status) {
  return status === "running" || status === "stopping";
}
function jobsForSession(snapshot, sessionId) {
  if (!snapshot || !sessionId) return [];
  const rows = snapshot.rows[sessionId];
  return Array.isArray(rows) ? rows : [];
}
function formatElapsed(ms) {
  const sec = Math.max(0, Math.floor(ms / 1e3));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  if (min < 60) return s > 0 ? `${min}m ${String(s).padStart(2, "0")}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${hr}h ${m}m` : `${hr}h`;
}
function jobElapsedMs(job, now) {
  const end = isJobLive(job.status) ? now : job.finishedAt ?? now;
  return Math.max(0, end - job.startedAt);
}
function isLocalSubagentMode(mode) {
  return mode === "one-shot" || mode === "continuable" || mode === "unknown";
}
function isCatalogEntry(value) {
  if (!value || typeof value !== "object") return false;
  const row = value;
  return typeof row.id === "string" && row.id.length > 0 && typeof row.createdAt === "number" && (row.mode === "one-shot" || row.mode === "external" || row.mode === "continuable" || row.mode === "unknown");
}
var EMPTY_RAIL_SLICE = Object.freeze({ byId: {}, projectionsBySession: {} });
function selectRailSessionSlice(sessions, sessionId) {
  if (!sessions || !sessionId) return EMPTY_RAIL_SLICE;
  const srcProj = sessions.projectionsBySession;
  const current = srcProj?.[sessionId];
  const rawCatalog = current?.values?.subagentCatalog;
  const entries = Array.isArray(rawCatalog) ? rawCatalog.filter(isCatalogEntry) : [];
  const byId = {};
  const projectionsBySession = {};
  if (current) projectionsBySession[sessionId] = current;
  for (const entry of entries) {
    const summary = sessions.byId?.[entry.id];
    if (summary) byId[entry.id] = summary;
    const projection = srcProj?.[entry.id];
    if (projection) projectionsBySession[entry.id] = projection;
  }
  if (Object.keys(byId).length === 0 && Object.keys(projectionsBySession).length === 0) return EMPTY_RAIL_SLICE;
  return { byId, projectionsBySession };
}
function readSubagentCatalog(sessionId, list) {
  const snap = sessionId ? list?.projectionsBySession?.[sessionId] : void 0;
  const entries = Array.isArray(snap?.values?.subagentCatalog) ? snap.values.subagentCatalog.filter(isCatalogEntry) : void 0;
  if (snap?.state === "error") return { status: "error" };
  if (snap?.state === "migration-required") return { status: "migration-required", entries: entries ?? [] };
  if (snap?.state === "loading" && entries === void 0) return { status: "loading" };
  if (entries !== void 0) return { status: "ready", entries };
  if (snap?.state === "ready" || snap?.state === "idle") return { status: "absent" };
  if (snap?.state === "loading") return { status: "loading" };
  return { status: "absent" };
}
function subagentRows(entries, list, statusById, now) {
  return entries.map((entry) => {
    const summary = list?.byId?.[entry.id];
    const timing = timingOf(list?.projectionsBySession?.[entry.id]);
    const running = statusById?.get(entry.id)?.running ?? summary?.running ?? Boolean(timing?.active);
    const title = typeof entry.label === "string" && entry.label || summary?.displayTitle || summary?.title || entry.id;
    return { id: entry.id, title, mode: entry.mode, running, elapsedMs: subagentElapsedMs(entry, timing, running, now), createdAt: entry.createdAt };
  });
}
function timingOf(snapshot) {
  const value = snapshot?.values?.subagentTiming;
  if (!value || typeof value !== "object") return void 0;
  const timing = value;
  if (typeof timing.settledMs !== "number" || !Number.isFinite(timing.settledMs)) return void 0;
  return timing;
}
function subagentElapsedMs(entry, timing, running, now) {
  if (timing) {
    const active = timing.active ? Math.max(0, now - timing.active.since) : 0;
    return Math.max(0, timing.settledMs + active);
  }
  if (running) return Math.max(0, now - entry.createdAt);
  return 0;
}
function isKillSuccess(result) {
  return Boolean(result && result.ok === true);
}

// src/client/styles.ts
var installed = false;
function ensureRailStyle() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const style = document.createElement("style");
  style.id = "dsh-session-rail-style";
  style.textContent = `.dsr{font-family:inherit;font-size:13px;line-height:1.45;color:var(--dsh-text-primary,inherit);padding:12px;overflow:auto;height:100%;box-sizing:border-box}.dsr-card{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:12px;margin:0 0 10px;overflow:hidden}.dsr-heading{display:flex;align-items:center}.dsr-title{width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:0;color:inherit;padding:12px 14px;text-align:left;font:inherit;font-size:14px;cursor:pointer}.dsr-heading>.dsr-refresh{margin-right:12px}.dsr-content{padding:0 14px 13px}.dsr-row{display:flex;gap:8px;align-items:center;min-height:25px;min-width:0}.dsr-muted{opacity:.64}.dsr-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.dsr-branch{overflow-wrap:anywhere}.dsr-meter{height:5px;background:color-mix(in srgb,currentColor 12%,transparent);border-radius:9px;overflow:hidden;margin:8px 0}.dsr-meter>i{display:block;height:100%;background:#3585eb}.dsr-file{border-top:1px solid color-mix(in srgb,currentColor 10%,transparent);padding:8px 0}.dsr-file button{max-width:100%;text-align:left;overflow-wrap:anywhere;color:inherit;background:none;border:0;cursor:pointer}.dsr-stats{color:var(--dsh-text-secondary,#888);margin-left:auto;white-space:nowrap}.dsr-add{color:#20a467}.dsr-del{color:#e44c63}.dsr-diff{margin:7px 0 0;padding:8px;border-radius:7px;background:color-mix(in srgb,currentColor 6%,transparent);overflow:auto;font:11px/1.5 ui-monospace,monospace;white-space:pre}.dsr-line-add{color:#26a269}.dsr-line-del{color:#e65366}.dsr-error{color:#d66}.dsr-chip{opacity:.68;font-size:11px;margin-left:5px}.dsr-refresh{border:0;background:none;color:inherit;opacity:.75;cursor:pointer}.dsr-plugin{padding:3px 0}.dsr-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:8px}.dsr-actions label{display:flex;align-items:center;gap:5px;min-width:0}.dsr-actions input,.dsr-actions select{width:145px;max-width:190px;min-width:0;box-sizing:border-box;background:transparent;color:inherit;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:6px;padding:4px}.dsr-actions input:focus,.dsr-actions select:focus{outline:2px solid color-mix(in srgb,#3585eb 55%,transparent);outline-offset:1px}.dsr-commit{background:color-mix(in srgb,#3585eb 16%,transparent);color:inherit;border:1px solid color-mix(in srgb,#3585eb 35%,transparent);border-radius:6px;padding:5px 8px;cursor:pointer}.dsr-commit:disabled{opacity:.45;cursor:not-allowed}.dsr-meter-segments{display:flex;gap:1px;background:color-mix(in srgb,currentColor 10%,transparent)}.dsr-meter-segments>i{display:block;height:100%;flex:0 0 auto;min-width:0;border-radius:0}.dsr-meter-segments>i:first-child{border-radius:9px 0 0 9px}.dsr-meter-segments>i:last-child{border-radius:0 9px 9px 0}.dsr-swatch{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;vertical-align:middle;flex:none}.dsr-cat-toggle{display:flex;align-items:center;gap:2px;min-width:0;background:none;border:0;color:inherit;font:inherit;padding:0;cursor:pointer;text-align:left}.dsr-cat-toggle:disabled{cursor:default}.dsr-subrows{padding:2px 0 4px 16px}.dsr-timing,.dsr-usage{margin-top:8px;padding-top:6px;border-top:1px solid color-mix(in srgb,currentColor 10%,transparent)}.dsr-turn{margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid color-mix(in srgb,currentColor 8%,transparent)}.dsr-turn:last-child{margin-bottom:0;padding-bottom:0;border-bottom:0}.dsr-turn-heading{font-weight:600;margin:4px 0 2px}.dsr-task{display:flex;align-items:center;gap:8px;min-height:28px;padding:4px 0;border-top:1px solid color-mix(in srgb,currentColor 8%,transparent)}.dsr-task:first-of-type{border-top:0}.dsr-task-main{display:flex;align-items:center;gap:4px;min-width:0;flex:1}.dsr-task-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.dsr-task-open{display:flex;min-width:0;max-width:100%;background:none;border:0;color:inherit;font:inherit;padding:0;cursor:pointer;text-align:left}.dsr-task-section{margin-top:6px;font-size:12px}.dsr-finished{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:6px;padding:6px 0;background:none;border:0;border-top:1px solid color-mix(in srgb,currentColor 10%,transparent);color:inherit;font:inherit;cursor:pointer;opacity:.78}.dsr-stop{flex:none;background:color-mix(in srgb,currentColor 8%,transparent);color:inherit;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:6px;padding:3px 7px;cursor:pointer;font:inherit;font-size:12px}.dsr-stop-armed{background:color-mix(in srgb,#e44c63 18%,transparent);border-color:color-mix(in srgb,#e44c63 45%,transparent)}`;
  document.head.appendChild(style);
}

// src/client/pane.tsx
var REVIEW_KIND_STORAGE = "session-rail:selected-review-kind";
var LEGACY_DEFAULT_KIND = "codex-review";
function RailPane(props) {
  const { sessionId, cwd, pressure, breakdown, usage, timeline, loadPlugins, activeTabs = [], openTab, openResource, uiConversation, jobs, sessionList, sessionStatus } = props;
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [snapshotError, setSnapshotError] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [revision, setRevision] = (0, import_react.useState)(0);
  const [plugins, setPlugins] = (0, import_react.useState)(null);
  const [pluginError, setPluginError] = (0, import_react.useState)(false);
  const [collapsed, setCollapsed] = (0, import_react.useState)({});
  const [chosenKind, setChosenKind] = (0, import_react.useState)("");
  const [commitState, setCommitState] = (0, import_react.useState)("idle");
  const commitInFlight = (0, import_react.useRef)(false);
  const [routeHint, setRouteHint] = (0, import_react.useState)(null);
  const [outputTurns, setOutputTurns] = (0, import_react.useState)([]);
  const [summaries, setSummaries] = (0, import_react.useState)({});
  const [outputRevision, setOutputRevision] = (0, import_react.useState)(0);
  const [jobRows, setJobRows] = (0, import_react.useState)([]);
  const [jobsWatchError, setJobsWatchError] = (0, import_react.useState)(false);
  const [jobsKillError, setJobsKillError] = (0, import_react.useState)(false);
  const [armedJobId, setArmedJobId] = (0, import_react.useState)(null);
  const [finishedOpen, setFinishedOpen] = (0, import_react.useState)(false);
  const [now, setNow] = (0, import_react.useState)(() => Date.now());
  const [openHint, setOpenHint] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    try {
      const saved = localStorage.getItem(REVIEW_KIND_STORAGE) ?? "";
      setChosenKind(saved === LEGACY_DEFAULT_KIND ? "" : saved);
      if (saved === LEGACY_DEFAULT_KIND) localStorage.removeItem(REVIEW_KIND_STORAGE);
    } catch {
      setChosenKind("");
    }
  }, []);
  (0, import_react.useEffect)(() => {
    ensureRailStyle();
  }, []);
  (0, import_react.useEffect)(() => {
    if (!sessionId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    let active = true;
    setLoading(true);
    setSnapshotError(null);
    setSnapshot(null);
    getSnapshot(sessionId, abort.signal).then((value) => {
      if (active) setSnapshot(value);
    }).catch((error) => {
      if (active && !abort.signal.aborted) setSnapshotError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      abort.abort();
    };
  }, [sessionId, revision]);
  (0, import_react.useEffect)(() => {
    if (!loadPlugins) {
      setPlugins([]);
      setPluginError(false);
      return;
    }
    let active = true;
    loadPlugins().then((value) => {
      if (active) {
        setPlugins(Array.isArray(value) ? value : []);
        setPluginError(false);
      }
    }).catch(() => {
      if (active) {
        setPluginError(true);
        setPlugins(null);
      }
    });
    return () => {
      active = false;
    };
  }, [loadPlugins]);
  (0, import_react.useEffect)(() => {
    setSummaries({});
    return subscribeOutputTurns(uiConversation, sessionId, (value) => {
      setOutputTurns(value);
    });
  }, [uiConversation, sessionId]);
  (0, import_react.useEffect)(() => {
    if (!sessionId || outputTurns === "unavailable") return;
    const abort = new AbortController();
    const needed = outputTurns.filter((turn) => turn.seq !== void 0);
    for (const turn of needed) {
      const seq = turn.seq;
      const key = summaryKey(sessionId, seq);
      setSummaries((current) => current[key] === void 0 ? { ...current, [key]: "loading" } : current);
    }
    void Promise.all(needed.map(async (turn) => {
      const seq = turn.seq;
      const key = summaryKey(sessionId, seq);
      const existing = summaries[key];
      if (existing && existing !== "loading" && existing !== "error") return;
      if (existing === "error" && outputRevision === 0) return;
      const value = await loadChangesSummary(sessionId, seq, abort.signal);
      setSummaries((current) => current[key] === value ? current : { ...current, [key]: value });
    })).catch(() => void 0);
    return () => abort.abort();
  }, [sessionId, outputTurns, outputRevision]);
  (0, import_react.useEffect)(() => {
    setJobsWatchError(false);
    setJobsKillError(false);
    setArmedJobId(null);
    if (!sessionId || !jobs?.state) {
      setJobRows([]);
      return;
    }
    let active = true;
    const sync = () => {
      if (!active) return;
      try {
        setJobRows(jobsForSession(jobs.state.getSnapshot(), sessionId));
      } catch {
        if (active) {
          setJobsWatchError(true);
          setJobRows([]);
        }
      }
    };
    let unsubscribe;
    let release;
    try {
      unsubscribe = jobs.state.subscribe(sync);
      release = jobs.watchRows(sessionId);
      sync();
    } catch {
      if (active) {
        setJobsWatchError(true);
        setJobRows([]);
      }
    }
    return () => {
      active = false;
      unsubscribe?.();
      release?.();
    };
  }, [jobs, sessionId]);
  (0, import_react.useEffect)(() => {
    if (!armedJobId) return;
    const timer = window.setTimeout(() => setArmedJobId(null), KILL_ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armedJobId]);
  const catalog = readSubagentCatalog(sessionId, sessionList);
  const agents = catalog.status === "ready" || catalog.status === "migration-required" ? subagentRows(catalog.entries, sessionList, sessionStatus, now) : [];
  const liveJobs = jobRows.filter((job) => isJobLive(job.status));
  const finishedJobs = jobRows.filter((job) => !isJobLive(job.status));
  const liveAgents = agents.filter((agent) => agent.running);
  const finishedAgents = agents.filter((agent) => !agent.running);
  const hasLiveWork = liveJobs.length > 0 || liveAgents.length > 0;
  (0, import_react.useEffect)(() => {
    if (!hasLiveWork) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1e3);
    return () => window.clearInterval(timer);
  }, [hasLiveWork]);
  async function stopJob(jobId) {
    if (!jobs || !sessionId) return;
    if (armedJobId !== jobId) {
      setArmedJobId(jobId);
      setJobsKillError(false);
      return;
    }
    setArmedJobId(null);
    try {
      const result = await jobs.kill(sessionId, jobId);
      if (!isKillSuccess(result)) setJobsKillError(true);
      else setJobsKillError(false);
    } catch {
      setJobsKillError(true);
    }
  }
  function openSubagent(agent) {
    setOpenHint(null);
    if (!isLocalSubagentMode(agent.mode) || !openResource) {
      if (agent.mode === "external") return;
      setOpenHint(t("openFailed"));
      return;
    }
    try {
      openResource(subagentChatAddress({ parentSessionId: sessionId, childSessionId: agent.id, mode: agent.mode }));
    } catch {
      setOpenHint(t("openFailed"));
    }
  }
  const context = (0, import_react.useMemo)(
    () => buildContextView({ pressure, breakdown, usage, timeline }),
    [pressure, breakdown, usage, timeline]
  );
  const files = snapshot?.changedFiles ?? [];
  const displayCwd = cwd ?? snapshot?.cwd;
  const totals = files.reduce((sum2, file) => ({ add: sum2.add + file.additions, del: sum2.del + file.deletions }), { add: 0, del: 0 });
  const normalizedTarget = chosenKind.trim();
  const targetExists = activeTabs.some((tab) => tab.kind === normalizedTarget);
  const commitDisabledReason = !sessionId ? t("commitNoSession") : loading ? t("loading") : files.length === 0 ? t("commitNoFiles") : snapshot?.followupAvailable !== true ? t("commitNoAgent") : null;
  const announcedTurns = outputTurns === "unavailable" ? [] : outputTurns;
  function persistKind(kind) {
    setChosenKind(kind);
    try {
      if (kind) localStorage.setItem(REVIEW_KIND_STORAGE, kind);
      else localStorage.removeItem(REVIEW_KIND_STORAGE);
    } catch {
    }
  }
  function tryOpenResource(address, options) {
    if (!openResource) return false;
    try {
      openResource(address, options);
      return true;
    } catch {
      return false;
    }
  }
  async function ensureSummaries() {
    if (!sessionId || outputTurns === "unavailable") return [];
    const resolved = await Promise.all(announcedTurns.map(async (turn) => {
      if (turn.seq === void 0) return { ...turn, summary: void 0 };
      const key = summaryKey(sessionId, turn.seq);
      const standing = summaries[key];
      if (standing && standing !== "loading") return { ...turn, summary: standing };
      const value = await loadChangesSummary(sessionId, turn.seq);
      setSummaries((current) => current[key] === value ? current : { ...current, [key]: value });
      return { ...turn, summary: value };
    }));
    return resolved;
  }
  async function openOfficialReview(path) {
    const loaded = await ensureSummaries();
    const match = findLatestChangeMatch(path, loaded);
    if (match) {
      if (tryOpenResource(changesReviewAddress({ sessionId, seq: match.seq, turn: match.turn }), { params: { index: match.index } })) return;
      setRouteHint(t("openFailed"));
      return;
    }
    if (tryOpenResource(fileAddressFor(sessionId, displayCwd, path))) return;
    setRouteHint(t("openFailed"));
  }
  function selectWorkingTreeFile(path) {
    setRouteHint(null);
    if (normalizedTarget && openTab) {
      try {
        const result = openTab(normalizedTarget);
        if (result !== false) return;
      } catch {
      }
    }
    void openOfficialReview(path);
  }
  function selectChangedOutput(turn, seq, index) {
    setRouteHint(null);
    if (tryOpenResource(changesReviewAddress({ sessionId, seq, turn }), { params: { index } })) return;
    setRouteHint(t("openFailed"));
  }
  function selectDeliveredOutput(path) {
    setRouteHint(null);
    if (tryOpenResource(fileAddressFor(sessionId, displayCwd, path))) return;
    setRouteHint(t("openFailed"));
  }
  function toggle(key) {
    setCollapsed((value) => ({ ...value, [key]: !value[key] }));
  }
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr" }, /* @__PURE__ */ import_react.default.createElement(Card, { title: t("environment"), collapsed: !!collapsed.environment, onToggle: () => toggle("environment") }, loading ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("loading")) : null, !loading && !sessionId ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noSession")) : null, displayCwd ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row", title: displayCwd }, /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, "\u25B1"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-path" }, /* @__PURE__ */ import_react.default.createElement("strong", null, basename(displayCwd)), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-muted" }, " \xB7 ", displayCwd))) : /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, t("noCwd")), snapshot?.branch ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-branch" }, /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, "\u2442"), snapshot.branch) : null, snapshot && !snapshot.branch && snapshot.repositoryStatus === "available" ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, t("noBranch")) : null, snapshotError ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-error" }, snapshotError) : null, snapshot?.repositoryStatus === "not-repository" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noRepo")) : null, snapshot?.repositoryStatus === "directory-missing" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("missingDir")) : null, snapshot?.repositoryStatus === "unavailable" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("gitUnavailable")) : null), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("context"), collapsed: !!collapsed.context, onToggle: () => toggle("context") }, /* @__PURE__ */ import_react.default.createElement(ContextPanel, { view: context })), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("plugins"), collapsed: !!collapsed.plugins, onToggle: () => toggle("plugins") }, pluginError ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("pluginsUnavailable")) : null, !pluginError && plugins === null ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("loading")) : null, !pluginError && plugins?.length === 0 ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noPlugins")) : null, plugins?.map((plugin, index) => /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-plugin", key: plugin.entryId ?? `${plugin.moduleName ?? "plugin"}-${index}` }, /* @__PURE__ */ import_react.default.createElement("span", { title: plugin.entryId }, plugin.moduleName ?? plugin.entryId ?? "Plugin"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, plugin.enabled === false ? t("disabled") : plugin.fiberPhase === "failed" ? t("error") : plugin.fiberPhase === "loading" || plugin.fiberPhase === "unloading" ? t("loading") : t("enabled"))))), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("outputFiles"), collapsed: !!collapsed.output, onToggle: () => toggle("output"), action: /* @__PURE__ */ import_react.default.createElement("button", { className: "dsr-refresh", type: "button", "aria-label": t("refresh"), title: t("refresh"), onClick: () => setOutputRevision((value) => value + 1) }, "\u21BB") }, /* @__PURE__ */ import_react.default.createElement(OutputFilesPanel, { sessionId, turns: outputTurns, summaries, openError: routeHint, onOpenChanged: selectChangedOutput, onOpenDelivered: selectDeliveredOutput })), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("changes"), collapsed: !!collapsed.changes, onToggle: () => toggle("changes"), action: /* @__PURE__ */ import_react.default.createElement("button", { className: "dsr-refresh", type: "button", "aria-label": t("refresh"), title: t("refresh"), onClick: () => setRevision((value) => value + 1) }, "\u21BB") }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-actions" }, /* @__PURE__ */ import_react.default.createElement("label", null, t("reviewTarget"), " ", /* @__PURE__ */ import_react.default.createElement("input", { className: "dsr-target", list: "dsr-review-targets", value: chosenKind, spellCheck: false, autoCapitalize: "none", onChange: (event) => persistKind(event.target.value), onBlur: () => {
    const kind = chosenKind.trim();
    if (kind !== chosenKind) persistKind(kind);
  }, placeholder: t("reviewOptional"), "aria-label": t("reviewTarget") }), normalizedTarget ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip", title: targetExists ? t("enabled") : t("unavailable") }, targetExists ? t("enabled") : t("unavailable")) : null), /* @__PURE__ */ import_react.default.createElement("datalist", { id: "dsr-review-targets" }, activeTabs.map((tab) => /* @__PURE__ */ import_react.default.createElement("option", { key: tab.kind, value: tab.kind }, tab.title))), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsr-commit", disabled: !!commitDisabledReason || commitState === "sending", title: commitDisabledReason ?? void 0, onClick: async () => {
    if (commitInFlight.current || commitDisabledReason) return;
    commitInFlight.current = true;
    setCommitState("sending");
    try {
      await requestCommit(sessionId);
      setCommitState("queued");
    } catch {
      setCommitState("error");
    } finally {
      commitInFlight.current = false;
    }
  } }, commitState === "sending" ? t("commitSending") : t("commitChanges"))), commitDisabledReason ? /* @__PURE__ */ import_react.default.createElement(Status, null, commitDisabledReason) : null, commitState === "error" ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, t("commitError")) : null, commitState === "queued" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("commitQueued")) : null, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, snapshot ? t("files")(files.length) : t("loading")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-add" }, "+", totals.add), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-del" }, "\u2212", totals.del))), snapshot?.repositoryStatus === "no-cwd" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noCwd")) : null, snapshot?.repositoryStatus === "not-repository" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noRepo")) : null, snapshot?.repositoryStatus === "directory-missing" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("missingDir")) : null, snapshot?.repositoryStatus === "unavailable" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("gitUnavailable")) : null, snapshot?.repositoryStatus === "available" && files.length === 0 ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("clean")) : null, routeHint ? /* @__PURE__ */ import_react.default.createElement(Status, { error: routeHint === t("openFailed") }, routeHint) : null, files.map((file) => /* @__PURE__ */ import_react.default.createElement(FileRow, { key: file.path, file, onSelect: () => selectWorkingTreeFile(file.path) })), snapshotError ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, snapshotError) : null), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("backgroundTasks"), collapsed: !!collapsed.background, onToggle: () => toggle("background") }, /* @__PURE__ */ import_react.default.createElement(
    BackgroundTasksPanel,
    {
      sessionId,
      jobsAvailable: Boolean(jobs),
      jobsWatchError,
      jobsKillError,
      catalog,
      liveJobs,
      finishedJobs,
      liveAgents,
      finishedAgents,
      now,
      armedJobId,
      finishedOpen,
      openHint,
      onToggleFinished: () => setFinishedOpen((value) => !value),
      onStopJob: stopJob,
      onOpenSubagent: openSubagent
    }
  )));
}
function OutputFilesPanel({ sessionId, turns, summaries, openError, onOpenChanged, onOpenDelivered }) {
  if (!sessionId) return /* @__PURE__ */ import_react.default.createElement(Status, null, t("noSession"));
  if (turns === "unavailable") return /* @__PURE__ */ import_react.default.createElement(Status, null, t("outputUnavailable"));
  if (turns.length === 0) return /* @__PURE__ */ import_react.default.createElement(Status, null, t("outputEmpty"));
  const states = turns.map((turn) => ({ turn, summary: turn.seq === void 0 ? void 0 : summaries[summaryKey(sessionId, turn.seq)] }));
  const pending = states.some((item) => item.turn.seq !== void 0 && (item.summary === void 0 || item.summary === "loading"));
  const anyMissing = states.some((item) => item.summary === "missing");
  const anyError = states.some((item) => item.summary === "error");
  const anyVisible = states.some((item) => {
    if (item.turn.presented.length > 0) return true;
    return item.summary !== void 0 && typeof item.summary !== "string" && (item.summary.files.length > 0 || item.summary.total > 0);
  });
  const onlyMissing = !anyVisible && !pending && anyMissing && states.every((item) => item.turn.presented.length === 0 && (item.turn.seq === void 0 || item.summary === "missing" || item.summary === "error" || item.summary === void 0));
  if (onlyMissing) return /* @__PURE__ */ import_react.default.createElement(Status, null, t("outputSummaryUnavailable"));
  if (!anyVisible && !pending && !anyError && !anyMissing) return /* @__PURE__ */ import_react.default.createElement(Status, null, t("outputNoChanges"));
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, pending && !anyVisible ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("loading")) : null, openError ? /* @__PURE__ */ import_react.default.createElement(Status, { error: openError === t("openFailed") }, openError) : null, states.map(({ turn, summary }) => /* @__PURE__ */ import_react.default.createElement(OutputTurn, { key: turn.turn, record: turn, summary, onOpenChanged, onOpenDelivered })));
}
function OutputTurn({ record, summary, onOpenChanged, onOpenDelivered }) {
  const files = summary && typeof summary !== "string" ? summary.files : [];
  const presented = record.presented;
  const changedPaths = new Set(files.map((file) => normalizeForMark(file.path)));
  const deliveredOnly = presented.filter((file) => !changedPaths.has(normalizeForMark(file.path)));
  const deliveredPaths = new Set(presented.map((file) => normalizeForMark(file.path)));
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-turn" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-turn-heading" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("turn")(record.turn)), summary && typeof summary !== "string" ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-add" }, "+", summary.added), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-del" }, "\u2212", summary.deleted)) : null), record.seq !== void 0 && (summary === void 0 || summary === "loading") ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("loading")) : null, summary === "missing" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("outputSummaryUnavailable")) : null, summary === "error" ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, t("error")) : null, summary && typeof summary !== "string" && files.length === 0 && presented.length === 0 ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("outputTurnEmpty")) : null, files.map((file, index) => /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-file", key: `change:${file.path}:${index}` }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", onClick: () => record.seq !== void 0 && onOpenChanged(record.turn, record.seq, index), title: file.path }, file.display || file.path, deliveredPaths.has(normalizeForMark(file.path)) ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("delivered")) : null, file.binary ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("binary")) : null, file.oversized ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("diffTooLarge")) : null), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-add" }, "+", file.added), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-del" }, "\u2212", file.deleted))))), deliveredOnly.map((file) => /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-file", key: `present:${file.seq}:${file.index}` }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", onClick: () => onOpenDelivered(file.path), title: file.path }, file.path, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("delivered")))))));
}
function Card({ title, collapsed, onToggle, action, children }) {
  return /* @__PURE__ */ import_react.default.createElement("section", { className: "dsr-card" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-heading" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "dsr-title", type: "button", "aria-expanded": !collapsed, onClick: onToggle }, title, /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, collapsed ? "\u2304" : "\u2303")), action), !collapsed ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-content" }, children) : null);
}
function Status({ children, error = false }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: `dsr-row dsr-muted${error ? " dsr-error" : ""}` }, children);
}
function FileRow({ file, onSelect }) {
  const label = file.status === "untracked" ? t("untracked") : file.status === "added" ? t("added") : file.status === "deleted" ? t("deleted") : file.status === "renamed" ? t("renamed") : file.status === "copied" ? t("copied") : file.status === "conflicted" ? t("conflicted") : t("modified");
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-file" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", onClick: onSelect, title: file.path }, file.path, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, label), file.binary ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("binary")) : null, file.staged ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("staged")) : null, file.unstaged ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("unstaged")) : null), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-add" }, "+", file.additions), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-del" }, "\u2212", file.deletions))));
}
function summaryKey(sessionId, seq) {
  return `${sessionId}:${seq}`;
}
function normalizeForMark(path) {
  return path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
}
function BackgroundTasksPanel({ sessionId, jobsAvailable, jobsWatchError, jobsKillError, catalog, liveJobs, finishedJobs, liveAgents, finishedAgents, now, armedJobId, finishedOpen, openHint, onToggleFinished, onStopJob, onOpenSubagent }) {
  if (!sessionId) return /* @__PURE__ */ import_react.default.createElement(Status, null, t("noSession"));
  const catalogLoading = catalog.status === "loading";
  const finishedCount = finishedJobs.length + finishedAgents.length;
  const showTasks = liveJobs.length > 0 || finishedJobs.length > 0;
  const showAgents = liveAgents.length > 0 || finishedAgents.length > 0 || catalog.status === "migration-required";
  const empty = liveJobs.length === 0 && finishedJobs.length === 0 && liveAgents.length === 0 && finishedAgents.length === 0 && !catalogLoading;
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, jobsWatchError ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, t("jobsError")) : null, jobsKillError ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, t("jobsKillError")) : null, catalog.status === "error" ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, t("catalogError")) : null, catalog.status === "migration-required" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("catalogMigration")) : null, openHint ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, openHint) : null, catalogLoading && liveAgents.length === 0 && finishedAgents.length === 0 ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("loading")) : null, empty && !jobsWatchError && catalog.status !== "error" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("backgroundEmpty")) : null, showTasks && showAgents ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted dsr-task-section" }, t("tasks")) : null, liveJobs.map((job) => /* @__PURE__ */ import_react.default.createElement(JobTaskRow, { key: `job:${job.id}`, job, now, armed: armedJobId === job.id, onStop: () => onStopJob(job.id) })), showTasks && showAgents ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted dsr-task-section" }, t("subagents")) : null, liveAgents.map((agent) => /* @__PURE__ */ import_react.default.createElement(SubagentTaskRow, { key: `agent:${agent.id}`, agent, live: true, onOpen: () => onOpenSubagent(agent) })), finishedCount > 0 ? /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsr-finished", "aria-expanded": finishedOpen, onClick: onToggleFinished }, t("finished")(finishedCount), /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, finishedOpen ? "\u2303" : "\u2304")) : null, finishedOpen && finishedJobs.map((job) => /* @__PURE__ */ import_react.default.createElement(JobTaskRow, { key: `job-done:${job.id}`, job, now, armed: false })), finishedOpen && finishedAgents.map((agent) => /* @__PURE__ */ import_react.default.createElement(SubagentTaskRow, { key: `agent-done:${agent.id}`, agent, onOpen: () => onOpenSubagent(agent) })));
}
function JobTaskRow({ job, now, armed, onStop }) {
  const live = isJobLive(job.status);
  const canStop = job.status === "running" && onStop;
  const status = job.status === "stopping" ? t("stopping") : job.status === "failed" ? t("jobFailed") : job.status === "killed" ? t("jobKilled") : !live ? t("jobCompleted") : job.progress;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-task" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-task-main" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-task-title", title: job.label }, job.label), status ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, status) : null), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatElapsed(jobElapsedMs(job, now))), canStop ? /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: `dsr-stop${armed ? " dsr-stop-armed" : ""}`, onClick: onStop }, armed ? t("confirmStop") : t("stop")) : null);
}
function SubagentTaskRow({ agent, live = false, onOpen }) {
  const clickable = isLocalSubagentMode(agent.mode);
  const title = agent.title;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-task" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-task-main" }, clickable ? /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsr-task-open", onClick: onOpen, title }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-task-title" }, title)) : /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-task-title", title }, title), agent.mode === "external" ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("subagentExternal")) : /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("subagents"))), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, agent.elapsedMs > 0 || live ? formatElapsed(agent.elapsedMs) : ""));
}
function ContextPanel({ view }) {
  const [usageOpen, setUsageOpen] = (0, import_react.useState)(false);
  if (view.source === "none" || view.used === void 0 && view.categories.length === 0) {
    return /* @__PURE__ */ import_react.default.createElement(Status, null, t("contextUnavailable"));
  }
  const used = view.used ?? 0;
  const window2 = view.window;
  const pct = view.pct;
  const meterMax = window2 ?? Math.max(used, 1);
  const segments = view.parts.filter((part2) => part2.key !== "free" || window2 !== void 0 && part2.tokens > 0);
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, view.estimated ? `${t("estimated")} \xB7 ` : "", t("current")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, pct !== void 0 ? `${pct.toFixed(pct < 10 ? 1 : 0)}% \xB7 ` : "", formatTokens(used), window2 !== void 0 ? ` / ${formatTokens(window2)}` : "")), /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-meter dsr-meter-segments", role: "meter", "aria-valuemin": 0, "aria-valuemax": meterMax, "aria-valuenow": used, "aria-label": t("current") }, segments.map((part2) => {
    const width = meterMax > 0 ? Math.max(part2.tokens > 0 ? 0.4 : 0, part2.tokens / meterMax * 100) : 0;
    return width > 0 ? /* @__PURE__ */ import_react.default.createElement("i", { key: part2.key, title: `${categoryLabel(part2.key)} \xB7 ${formatTokens(part2.tokens)}`, style: { width: `${width}%`, background: part2.color } }) : null;
  })), /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, view.source === "timeline" ? t("sourceTimeline") : t("sourceMeter")), view.model ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip", title: view.provider }, view.model) : null), /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-breakdown" }, view.categories.map((part2) => /* @__PURE__ */ import_react.default.createElement(CategoryRow, { key: part2.key, part: part2, detail: part2.key === "assistant" ? view.assistantDetail : void 0 })), view.compactionReserve !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-swatch", style: { background: "var(--color-slate-400, #94a3b8)" } }), t("compactionReserve")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(view.compactionReserve), " ", t("tokens"))) : null, view.unavailable.map((key) => /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted", key: `missing-${key}` }, /* @__PURE__ */ import_react.default.createElement("span", null, categoryLabel(key)), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats dsr-chip" }, t("unavailable"))))), view.timing ? /* @__PURE__ */ import_react.default.createElement(TimingBlock, { timing: view.timing }) : null, hasProviderUsage(view.usage) ? /* @__PURE__ */ import_react.default.createElement(UsageBlock, { usage: view.usage, expanded: usageOpen, onToggle: () => setUsageOpen((value) => !value) }) : null);
}
function CategoryRow({ part: part2, detail }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const canExpand = part2.key === "assistant" && detail && (detail.reasoning || detail.answers || detail.calls);
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-cat" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsr-cat-toggle", "aria-expanded": canExpand ? open : void 0, disabled: !canExpand, onClick: () => canExpand && setOpen((value) => !value) }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-swatch", style: { background: part2.color }, "aria-hidden": "true" }), /* @__PURE__ */ import_react.default.createElement("span", null, categoryLabel(part2.key), part2.key !== "free" ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("estimated")) : null), canExpand ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip", "aria-hidden": "true" }, open ? "\u2303" : "\u2304") : null), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(part2.tokens), " ", t("tokens"), part2.shareOfUsed !== void 0 ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, " \xB7 ", part2.shareOfUsed.toFixed(0), "% ", t("ofUsed")) : null, part2.shareOfWindow !== void 0 ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, " \xB7 ", part2.shareOfWindow.toFixed(0), "% ", t("ofWindow")) : null)), open && detail ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-subrows" }, detail.reasoning !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("thinking")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(detail.reasoning))) : null, detail.answers !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("answers")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(detail.answers))) : null, detail.calls !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("tool")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(detail.calls))) : null) : null);
}
function TimingBlock({ timing }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-timing" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("timing"))), timing.wallMs !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("activeDuration")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatDuration(timing.wallMs))) : null, timing.genMs !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("modelWait")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatDuration(timing.genMs))) : null, timing.toolsMs !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("toolExec")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatDuration(timing.toolsMs))) : null, timing.ttftMs !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("ttft")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatDuration(timing.ttftMs))) : null, timing.tokensPerSecond !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("outputSpeed")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, timing.tokensPerSecond.toFixed(1), " ", t("tokensPerSec"))) : null);
}
function UsageBlock({ usage, expanded, onToggle }) {
  const input = sum(usage.uncachedInputTokens, usage.cacheReadTokens, usage.cacheWriteTokens);
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-usage" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsr-cat-toggle", "aria-expanded": expanded, onClick: onToggle, title: t("providerUsage") }, /* @__PURE__ */ import_react.default.createElement("span", null, t("providerUsage")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip", "aria-hidden": "true" }, expanded ? "\u2303" : "\u2304")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, "\u2191", formatTokens(input), " \u2193", formatTokens(usage.outputTokens))), expanded ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-subrows" }, finite2(usage.uncachedInputTokens) !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("uncachedInput")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(usage.uncachedInputTokens))) : null, finite2(usage.cacheReadTokens) !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("cacheRead")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(usage.cacheReadTokens))) : null, finite2(usage.cacheWriteTokens) !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("cacheWrite")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(usage.cacheWriteTokens))) : null, finite2(usage.outputTokens) !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("output")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, formatTokens(usage.outputTokens))) : null) : null);
}
function categoryLabel(key) {
  switch (key) {
    case "system":
      return t("system");
    case "tools":
      return t("tools");
    case "user":
      return t("user");
    case "inject":
      return t("inject");
    case "skill":
      return t("skill");
    case "assistant":
      return t("assistant");
    case "tool":
      return t("tool");
    case "messages":
      return t("messages");
    case "thinking":
      return t("thinking");
    case "answers":
      return t("answers");
    case "free":
      return t("free");
    case "compactionReserve":
      return t("compactionReserve");
    case "mcp":
      return t("mcp");
    case "memory":
      return t("memory");
    default:
      return key;
  }
}
function finite2(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : void 0;
}
function sum(...values) {
  const valid = values.map(finite2).filter((x) => x !== void 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) : void 0;
}
function basename(path) {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

// src/client/entry.tsx
var inject = ["slots", "sidebarRightTabs", "sidebarRight", "remote", "remote.pluginInventory", "uiConversation", "jobs"];
var ID = "session-rail";
var KIND = "session-info";
var pluginContext = null;
function apply(ctx) {
  pluginContext = ctx;
  ensureRailStyle();
  const register = () => {
    ctx.effect?.(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: ID }, SessionRailTabSlot)), "session-rail: tab body");
    ctx.effect?.(() => ctx.sidebarRightTabs?.register?.({ id: ID, kind: KIND, priority: "extension", keepMounted: true, title: () => t("environment") }) ?? (() => void 0), "session-rail: tab type");
    ctx.effect?.(() => ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({ name: "conversation.session.header.utilities", id: ID, order: 16 }, SessionRailOpener)), "session-rail: opener");
    ctx.effect?.(() => registerOutputFiles(ctx.uiConversation), "session-rail: output files");
  };
  if (ctx.inject) ctx.inject(["slots", "sidebarRightTabs", "sidebarRight", "remote.pluginInventory", "uiConversation"], register);
  else register();
}
function SessionRailTabSlot(props) {
  const info = props.useTabInfo?.();
  const sessionId = props.sessionId || info?.sessionId || info?.tab?.sessionId || "";
  return /* @__PURE__ */ import_react2.default.createElement(RailTabErrorBoundary, { key: sessionId }, /* @__PURE__ */ import_react2.default.createElement(SessionRailTab, { ...props }));
}
var RailTabErrorBoundary = class extends import_react2.default.Component {
  state = { hasError: false };
  static getDerivedStateFromError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }
  componentDidCatch(error) {
    console.error(error.message);
  }
  render() {
    if (this.state.hasError) {
      const detail = this.state.message ? ` ${this.state.message}` : "";
      return /* @__PURE__ */ import_react2.default.createElement("div", { className: "dsr" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dsr-error", role: "alert" }, t("tabError"), detail));
    }
    return this.props.children;
  }
};
function SessionRailTab(props) {
  const [, setTabsRevision] = (0, import_react2.useState)(0);
  const tabsRegistry = pluginContext?.sidebarRightTabs;
  (0, import_react2.useEffect)(() => tabsRegistry?.subscribe?.(() => setTabsRevision((value) => value + 1)), [tabsRegistry]);
  const info = props.useTabInfo?.();
  const sessionId = props.sessionId || info?.sessionId || info?.tab?.sessionId || "";
  const projectedCwd = props.useProjection?.("workingDirectory");
  const pressure = props.useProjection?.("contextPressure");
  const breakdown = props.useProjection?.("contextBreakdown");
  const usage = props.useProjection?.("tokenUsage");
  const timeline = props.useProjection?.("contextTimeline");
  const useSessions = props.useSessions;
  const useSessionStatus = props.useSessionStatus;
  const byId = useSessions((state) => state.byId);
  const projectionsBySession = useSessions((state) => state.projectionsBySession);
  const sessionStatus = useSessionStatus((status) => status);
  const sessionList = selectRailSessionSlice({ byId, projectionsBySession }, sessionId);
  const inventory = pluginContext?.remote?.pluginInventory;
  let tabs = [];
  try {
    tabs = tabsRegistry?.entries?.() ?? tabsRegistry?.getSnapshot?.() ?? [];
  } catch {
  }
  tabs = tabs.filter((tab) => tab.kind !== KIND && (!tab.patterns || tab.patterns.length === 0));
  const sidebar = pluginContext?.sidebarRight;
  const openTab = sidebar?.openTab;
  const openResource = sidebar?.openResource;
  const loadPlugins = (0, import_react2.useCallback)(async () => {
    if (!inventory?.list) return [];
    const snapshot = await inventory.list();
    return Array.isArray(snapshot?.entries) ? snapshot.entries : [];
  }, [inventory]);
  return /* @__PURE__ */ import_react2.default.createElement(
    RailPane,
    {
      key: sessionId,
      sessionId,
      cwd: projectedCwd || void 0,
      pressure,
      breakdown,
      usage,
      timeline,
      loadPlugins: inventory?.list ? loadPlugins : void 0,
      activeTabs: tabs.map((tab) => ({ kind: tab.kind, title: safeTitle(tab.title) })),
      openTab: openTab ? (kind) => openTab.call(sidebar, kind) : void 0,
      openResource: openResource ? (address, options) => openResource.call(sidebar, address, options) : void 0,
      uiConversation: pluginContext?.uiConversation,
      jobs: pluginContext?.jobs,
      sessionList,
      sessionStatus
    }
  );
}
function safeTitle(title) {
  try {
    return String(title());
  } catch {
    return "";
  }
}
function SessionRailOpener() {
  return /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", className: "dsr-header-open", onClick: () => pluginContext?.sidebarRight?.openTab(KIND), "aria-label": t("environment"), title: t("environment") }, "\u25A4");
}

    return module.exports;
  }
});

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
var getDiff = (sessionId, path, signal) => post("diff", { sessionId, path }, signal);

// src/client/i18n.ts
var words = {
  zh: { environment: "\u73AF\u5883\u4FE1\u606F", context: "\u4E0A\u4E0B\u6587", plugins: "\u63D2\u4EF6", changes: "\u53D8\u66F4", refresh: "\u5237\u65B0", loading: "\u52A0\u8F7D\u4E2D\u2026", noSession: "\u5F53\u524D\u6CA1\u6709\u4F1A\u8BDD", noCwd: "\u4F1A\u8BDD\u672A\u63D0\u4F9B\u9879\u76EE\u76EE\u5F55", noBranch: "\u65E0\u5206\u652F\u4FE1\u606F", noRepo: "\u6B64\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93", missingDir: "\u9879\u76EE\u76EE\u5F55\u4E0D\u5B58\u5728", gitUnavailable: "Git \u4FE1\u606F\u6682\u4E0D\u53EF\u7528", clean: "\u5DE5\u4F5C\u533A\u5E72\u51C0", noPlugins: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u63D2\u4EF6", pluginsUnavailable: "\u63D2\u4EF6\u6E05\u5355\u6682\u4E0D\u53EF\u7528", contextUnavailable: "\u4E0A\u4E0B\u6587\u7528\u91CF\u6682\u4E0D\u53EF\u7528", estimated: "\u4F30\u7B97", current: "\u5F53\u524D\u4E0A\u4E0B\u6587", providerUsage: "\u6A21\u578B\u7D2F\u8BA1\u7528\u91CF", system: "\u7CFB\u7EDF\u63D0\u793A", tools: "\u5DE5\u5177", messages: "\u6D88\u606F", tokens: "tokens", files: (n) => `${n} \u4E2A\u6587\u4EF6`, added: "\u65B0\u589E", modified: "\u4FEE\u6539", deleted: "\u5220\u9664", renamed: "\u91CD\u547D\u540D", copied: "\u590D\u5236", untracked: "\u672A\u8DDF\u8E2A", conflicted: "\u51B2\u7A81", staged: "\u5DF2\u6682\u5B58", unstaged: "\u672A\u6682\u5B58", binary: "\u4E8C\u8FDB\u5236", viewDiff: "\u67E5\u770B\u5DEE\u5F02", hideDiff: "\u6536\u8D77\u5DEE\u5F02", diffUnavailable: "\u5DEE\u5F02\u6682\u4E0D\u53EF\u7528", diffTooLarge: "\u5DEE\u5F02\u5185\u5BB9\u8FC7\u5927\uFF0C\u65E0\u6CD5\u663E\u793A", branch: "\u5206\u652F", project: "\u9879\u76EE", computer: "\u6B64\u8BA1\u7B97\u673A", enabled: "\u5DF2\u542F\u7528", disabled: "\u5DF2\u505C\u7528", unavailable: "\u4E0D\u53EF\u7528", error: "\u8BFB\u53D6\u5931\u8D25" },
  en: { environment: "Environment", context: "Context", plugins: "Plugins", changes: "Changes", refresh: "Refresh", loading: "Loading\u2026", noSession: "No session selected", noCwd: "Session has no project directory", noBranch: "No branch information", noRepo: "This directory is not a Git repository", missingDir: "Project directory does not exist", gitUnavailable: "Git information is unavailable", clean: "Working tree clean", noPlugins: "No plugins to show", pluginsUnavailable: "Plugin inventory unavailable", contextUnavailable: "Context usage unavailable", estimated: "Estimated", current: "Current context", providerUsage: "Cumulative model usage", system: "System prompt", tools: "Tools", messages: "Messages", tokens: "tokens", files: (n) => `${n} files`, added: "Added", modified: "Modified", deleted: "Deleted", renamed: "Renamed", copied: "Copied", untracked: "Untracked", conflicted: "Conflicted", staged: "Staged", unstaged: "Unstaged", binary: "Binary", viewDiff: "View diff", hideDiff: "Hide diff", diffUnavailable: "Diff unavailable", diffTooLarge: "Diff is too large to display", branch: "Branch", project: "Project", computer: "This computer", enabled: "Enabled", disabled: "Disabled", unavailable: "Unavailable", error: "Failed to load" }
};
function detectLang() {
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}
function t(key) {
  return words[detectLang()][key];
}

// src/client/styles.ts
var installed = false;
function ensureRailStyle() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const style = document.createElement("style");
  style.id = "dsh-session-rail-style";
  style.textContent = `.dsr{font-family:inherit;font-size:13px;line-height:1.45;color:var(--dsh-text-primary,inherit);padding:12px;overflow:auto;height:100%;box-sizing:border-box}.dsr-card{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:12px;margin:0 0 10px;overflow:hidden}.dsr-heading{display:flex;align-items:center}.dsr-title{width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:0;color:inherit;padding:12px 14px;text-align:left;font:inherit;font-size:14px;cursor:pointer}.dsr-heading>.dsr-refresh{margin-right:12px}.dsr-content{padding:0 14px 13px}.dsr-row{display:flex;gap:8px;align-items:center;min-height:25px;min-width:0}.dsr-muted{opacity:.64}.dsr-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.dsr-branch{overflow-wrap:anywhere}.dsr-meter{height:5px;background:color-mix(in srgb,currentColor 12%,transparent);border-radius:9px;overflow:hidden;margin:8px 0}.dsr-meter>i{display:block;height:100%;background:#3585eb}.dsr-file{border-top:1px solid color-mix(in srgb,currentColor 10%,transparent);padding:8px 0}.dsr-file button{max-width:100%;text-align:left;overflow-wrap:anywhere;color:inherit;background:none;border:0;cursor:pointer}.dsr-stats{color:var(--dsh-text-secondary,#888);margin-left:auto;white-space:nowrap}.dsr-add{color:#20a467}.dsr-del{color:#e44c63}.dsr-diff{margin:7px 0 0;padding:8px;border-radius:7px;background:color-mix(in srgb,currentColor 6%,transparent);overflow:auto;font:11px/1.5 ui-monospace,monospace;white-space:pre}.dsr-line-add{color:#26a269}.dsr-line-del{color:#e65366}.dsr-error{color:#d66}.dsr-chip{opacity:.68;font-size:11px;margin-left:5px}.dsr-refresh{border:0;background:none;color:inherit;opacity:.75;cursor:pointer}.dsr-plugin{padding:3px 0}`;
  document.head.appendChild(style);
}

// src/client/pane.tsx
function RailPane(props) {
  const { sessionId, cwd, pressure, breakdown, usage, loadPlugins } = props;
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [snapshotError, setSnapshotError] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [revision, setRevision] = (0, import_react.useState)(0);
  const [plugins, setPlugins] = (0, import_react.useState)(null);
  const [pluginError, setPluginError] = (0, import_react.useState)(false);
  const [collapsed, setCollapsed] = (0, import_react.useState)({});
  const [selected, setSelected] = (0, import_react.useState)(null);
  const [diff, setDiff] = (0, import_react.useState)(null);
  const [diffError, setDiffError] = (0, import_react.useState)(null);
  const [diffLoading, setDiffLoading] = (0, import_react.useState)(false);
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
    setSelected(null);
    setDiff(null);
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
    if (!sessionId || !selected) return;
    const abort = new AbortController();
    let active = true;
    setDiffLoading(true);
    setDiffError(null);
    setDiff(null);
    getDiff(sessionId, selected, abort.signal).then((value) => {
      if (active) setDiff(value);
    }).catch((error) => {
      if (!active || abort.signal.aborted) return;
      const typed = error instanceof RailApiError && error.code === "diff_too_large" ? t("diffTooLarge") : error instanceof Error ? error.message : t("diffUnavailable");
      setDiffError(typed);
    }).finally(() => {
      if (active) setDiffLoading(false);
    });
    return () => {
      active = false;
      abort.abort();
    };
  }, [sessionId, selected]);
  const ratio = (0, import_react.useMemo)(() => {
    const current = finite(pressure?.pressureTokens) ?? finite(pressure?.projectedTokens);
    const capacity = finite(pressure?.contextWindow);
    return current !== void 0 && capacity && capacity > 0 ? { current, capacity, pct: Math.max(0, Math.min(100, current / capacity * 100)), estimated: finite(pressure?.pressureTokens) === void 0 } : null;
  }, [pressure]);
  const files = snapshot?.changedFiles ?? [];
  const displayCwd = cwd ?? snapshot?.cwd;
  const totals = files.reduce((sum2, file) => ({ add: sum2.add + file.additions, del: sum2.del + file.deletions }), { add: 0, del: 0 });
  function toggle(key) {
    setCollapsed((value) => ({ ...value, [key]: !value[key] }));
  }
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr" }, /* @__PURE__ */ import_react.default.createElement(Card, { title: t("environment"), collapsed: !!collapsed.environment, onToggle: () => toggle("environment") }, loading ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("loading")) : null, !loading && !sessionId ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noSession")) : null, displayCwd ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row", title: displayCwd }, /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, "\u25B1"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-path" }, /* @__PURE__ */ import_react.default.createElement("strong", null, basename(displayCwd)), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-muted" }, " \xB7 ", displayCwd))) : /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, t("noCwd")), snapshot?.branch ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-branch" }, /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, "\u2442"), snapshot.branch) : null, snapshot && !snapshot.branch && snapshot.repositoryStatus === "available" ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted" }, t("noBranch")) : null, snapshotError ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-error" }, snapshotError) : null, snapshot?.repositoryStatus === "not-repository" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noRepo")) : null, snapshot?.repositoryStatus === "directory-missing" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("missingDir")) : null, snapshot?.repositoryStatus === "unavailable" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("gitUnavailable")) : null), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("context"), collapsed: !!collapsed.context, onToggle: () => toggle("context") }, ratio ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, ratio.estimated ? `${t("estimated")} \xB7 ` : "", t("current")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, ratio.pct.toFixed(0), "% \xB7 ", format(ratio.current), " / ", format(ratio.capacity))), /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-meter", role: "meter", "aria-valuemin": 0, "aria-valuemax": ratio.capacity, "aria-valuenow": ratio.current }, /* @__PURE__ */ import_react.default.createElement("i", { style: { width: `${ratio.pct}%` } }))) : /* @__PURE__ */ import_react.default.createElement(Status, null, t("contextUnavailable")), breakdown ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-breakdown" }, [["systemTokens", "system"], ["toolsTokens", "tools"], ["messageTokens", "messages"]].map(([field, label]) => finite(breakdown[field]) !== void 0 ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted", key: field }, /* @__PURE__ */ import_react.default.createElement("span", null, t(label), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("estimated"))), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, format(breakdown[field]), " ", t("tokens"))) : null)) : null, usage && hasUsage(usage) ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row dsr-muted", title: t("providerUsage") }, /* @__PURE__ */ import_react.default.createElement("span", null, t("providerUsage")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, "\u2191", format(sum(usage.uncachedInputTokens, usage.cacheReadTokens, usage.cacheWriteTokens)), " \u2193", format(usage.outputTokens))) : null), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("plugins"), collapsed: !!collapsed.plugins, onToggle: () => toggle("plugins") }, pluginError ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("pluginsUnavailable")) : null, !pluginError && plugins === null ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("loading")) : null, !pluginError && plugins?.length === 0 ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noPlugins")) : null, plugins?.map((plugin, index) => /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-plugin", key: plugin.entryId ?? `${plugin.moduleName ?? "plugin"}-${index}` }, /* @__PURE__ */ import_react.default.createElement("span", { title: plugin.entryId }, plugin.moduleName ?? plugin.entryId ?? "Plugin"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, plugin.enabled === false ? t("disabled") : plugin.fiberPhase === "failed" ? t("error") : plugin.fiberPhase === "loading" || plugin.fiberPhase === "unloading" ? t("loading") : t("enabled"))))), /* @__PURE__ */ import_react.default.createElement(Card, { title: t("changes"), collapsed: !!collapsed.changes, onToggle: () => toggle("changes"), action: /* @__PURE__ */ import_react.default.createElement("button", { className: "dsr-refresh", type: "button", "aria-label": t("refresh"), title: t("refresh"), onClick: () => setRevision((value) => value + 1) }, "\u21BB") }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, snapshot ? t("files")(files.length) : t("loading")), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-add" }, "+", totals.add), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-del" }, "\u2212", totals.del))), snapshot?.repositoryStatus === "no-cwd" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noCwd")) : null, snapshot?.repositoryStatus === "not-repository" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("noRepo")) : null, snapshot?.repositoryStatus === "directory-missing" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("missingDir")) : null, snapshot?.repositoryStatus === "unavailable" ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("gitUnavailable")) : null, snapshot?.repositoryStatus === "available" && files.length === 0 ? /* @__PURE__ */ import_react.default.createElement(Status, null, t("clean")) : null, files.map((file) => /* @__PURE__ */ import_react.default.createElement(FileRow, { key: file.path, file, selected: selected === file.path, diff: selected === file.path ? diff : null, diffError: selected === file.path ? diffError : null, diffLoading: selected === file.path && diffLoading, onSelect: () => setSelected((value) => value === file.path ? null : file.path) })), snapshotError ? /* @__PURE__ */ import_react.default.createElement(Status, { error: true }, snapshotError) : null));
}
function Card({ title, collapsed, onToggle, action, children }) {
  return /* @__PURE__ */ import_react.default.createElement("section", { className: "dsr-card" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-heading" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "dsr-title", type: "button", "aria-expanded": !collapsed, onClick: onToggle }, title, /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, collapsed ? "\u2304" : "\u2303")), action), !collapsed ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-content" }, children) : null);
}
function Status({ children, error = false }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: `dsr-row dsr-muted${error ? " dsr-error" : ""}` }, children);
}
function FileRow({ file, selected, diff, diffError, diffLoading, onSelect }) {
  const label = file.status === "untracked" ? t("untracked") : file.status === "added" ? t("added") : file.status === "deleted" ? t("deleted") : file.status === "renamed" ? t("renamed") : file.status === "copied" ? t("copied") : file.status === "conflicted" ? t("conflicted") : t("modified");
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-file" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-row" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", "aria-expanded": selected, onClick: onSelect, title: file.path }, file.path, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, label), file.binary ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("binary")) : null, file.staged ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("staged")) : null, file.unstaged ? /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-chip" }, t("unstaged")) : null), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-stats" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-add" }, "+", file.additions), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "dsr-del" }, "\u2212", file.deletions))), selected ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsr-diff", role: "region", "aria-label": `${t("viewDiff")}: ${file.path}` }, diffLoading ? t("loading") : diffError ? diffError : diff?.binary || file.binary ? t("binary") : diff?.lines?.map((line, i) => /* @__PURE__ */ import_react.default.createElement(DiffLine, { key: i, line })) ?? t("diffUnavailable")) : null);
}
function DiffLine({ line }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: line.kind === "addition" ? "dsr-line-add" : line.kind === "deletion" ? "dsr-line-del" : void 0 }, line.text || " ");
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : void 0;
}
function format(value) {
  const number = finite(value);
  return number === void 0 ? "\u2014" : Intl.NumberFormat().format(number);
}
function sum(...values) {
  const valid = values.map(finite).filter((x) => x !== void 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) : void 0;
}
function hasUsage(value) {
  return sum(value.uncachedInputTokens, value.cacheReadTokens, value.cacheWriteTokens, value.outputTokens) !== void 0;
}
function basename(path) {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

// src/client/entry.tsx
var inject = ["slots", "sidebarRightTabs", "sidebarRight", "remote", "remote.pluginInventory"];
var ID = "session-rail";
var KIND = "session-info";
var pluginContext = null;
function apply(ctx) {
  pluginContext = ctx;
  ensureRailStyle();
  const register = () => {
    ctx.effect?.(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: ID }, SessionRailTab)), "session-rail: tab body");
    ctx.effect?.(() => ctx.sidebarRightTabs?.register?.({ id: ID, kind: KIND, priority: "extension", keepMounted: true, title: () => t("environment") }) ?? (() => void 0), "session-rail: tab type");
    ctx.effect?.(() => ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({ name: "conversation.session.header.utilities", id: ID, order: 16 }, SessionRailOpener)), "session-rail: opener");
  };
  if (ctx.inject) ctx.inject(["slots", "sidebarRightTabs", "sidebarRight", "remote.pluginInventory"], register);
  else register();
}
function SessionRailTab(props) {
  const info = props.useTabInfo?.();
  const sessionId = props.sessionId || info?.sessionId || info?.tab?.sessionId || "";
  const projectedCwd = props.useProjection?.("workingDirectory");
  const pressure = props.useProjection?.("contextPressure");
  const breakdown = props.useProjection?.("contextBreakdown");
  const usage = props.useProjection?.("tokenUsage");
  const inventory = pluginContext?.remote?.pluginInventory;
  const loadPlugins = (0, import_react2.useCallback)(async () => {
    if (!inventory?.list) return [];
    const snapshot = await inventory.list();
    return Array.isArray(snapshot?.entries) ? snapshot.entries : [];
  }, [inventory]);
  return /* @__PURE__ */ import_react2.default.createElement(RailPane, { key: sessionId, sessionId, cwd: projectedCwd || void 0, pressure, breakdown, usage, loadPlugins: inventory?.list ? loadPlugins : void 0 });
}
function SessionRailOpener() {
  return /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", className: "dsr-header-open", onClick: () => pluginContext?.sidebarRight?.openTab(KIND), "aria-label": t("environment"), title: t("environment") }, "\u25A4");
}

    return module.exports;
  }
});

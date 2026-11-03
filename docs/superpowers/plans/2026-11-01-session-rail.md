# DSH Session Rail Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable DSH web plugin that shows each session's environment, context, loaded plugins and read-only Git changes in a session-scoped right-sidebar tab.

**Architecture:** The plugin bundle contains a Host entry and a browser client. The Host resolves every requested Session ID to its own header cwd and exposes only read-only Git snapshot/diff routes behind same-origin checks. The client registers a DSH right-sidebar tab, reads context values with the Session `useProjection` hook and the DSH plugin inventory Remote, and renders the four cards with independent loading and error states.

**Tech Stack:** TypeScript, React 18, esbuild, DSH Cordis plugin/bundle/client contracts, Node `child_process.execFile`, DSH Session projections and Remote APIs.

---

## File Map

| File | Responsibility |
| --- | --- |
| `package.json` | Plugin metadata, DSH bundle/client injection metadata, build/typecheck scripts, Node engine and package contents. |
| `cordis.patch.yml` | Register the plugin's Host and Client entries in DSH. |
| `tsconfig.json` | Strict TypeScript configuration for Host and React Client sources. |
| `scripts/build.mjs` | Build the Host ESM bundle and wrap the browser entry in DSH's module loader. |
| `src/shared/types.ts` | Snapshot, file status, diff and response contracts shared by Host and Client. |
| `icon.svg`, `LICENSE` | Package icon and MIT license included in the distributable. |
| `src/host/plugin.ts` | Register the Host HTTP prefix and connect routes to DSH Session services. |
| `src/host/http.ts` | Same-origin check, bounded JSON body parsing, typed JSON responses and route errors. |
| `src/host/git.ts` | Resolve a validated Session workspace, read branch/status/statistics, and return a bounded file diff with Git argument arrays. |
| `src/client/entry.tsx` | Register the tab type, body slot, session-header shortcut, DSH projection/inventory injections, and current Session props. |
| `src/client/api.ts` | Call read-only Host snapshot/diff endpoints and decode their response envelope. |
| `src/client/pane.tsx` | Render the four ordered cards, independent states, percentage math and inline unified diff. |
| `src/client/styles.ts` | Inject scoped dark/light-compatible rail card and diff styles. |
| `src/client/i18n.ts` | Chinese and English labels, statuses, errors and accessibility text. |
| `README.md` | Installation, runtime requirements, capability notes and usage. |

## Task 1: Create the installable plugin skeleton

**Files:** `package.json`, `cordis.patch.yml`, `tsconfig.json`, `scripts/build.mjs`, `src/shared/types.ts`, `icon.svg`, `LICENSE`

- [x] **Step 1: Define the package and DSH entry metadata.**

  Set the package name to `dsh-session-rail`, package type to ESM, runtime requirement to Node `>=22.19.0`, and published contents to the generated `lib/`, bundle patch, icon, README and license. Follow the local plugin package convention: `main` points to the Host bundle, `dsh.client.inject` lists the right-sidebar UI package, and the browser entry's Cordis `inject` array lists runtime services (sidebar tabs, slots, Remote namespace and Session hooks). Do not guess additional package names for runtime services. Mirror the local plugin's dual Host/Client bundle shape. Add a small first-party icon and an MIT `LICENSE` file; the README is created in Task 5 before the distributable build.

- [x] **Step 2: Add the bundle patch, compiler settings and build script.**

  Register `src/host/plugin.ts` as the Host entry and `src/client/entry.tsx` as the browser entry; build `lib/index.js` as Node ESM and `lib/client.js` as a browser module-loader factory externalizing `react` and `react-dom`. Add `build` and `typecheck` package scripts.

- [x] **Step 3: Define the shared read-only response contracts.**

  In `src/shared/types.ts`, define the complete contracts for Session cwd, branch, repository status, changed files (`path`, status, staged/unstaged flags, additions, deletions, binary flag), unified-diff lines, API error envelopes, context pressure, breakdown and provider usage values. Keep optional DSH projection data optional so an older or reduced composition can render the other sections.

**Checkpoint:** package metadata describes both plugin halves, and the build entry points and API types are named without introducing any Git write action.

## Task 2: Implement Host session resolution and read-only Git API

**Files:** `src/host/plugin.ts`, `src/host/http.ts`, `src/host/git.ts`, `src/shared/types.ts`

- [x] **Step 1: Add the same-origin JSON route boundary.**

  Implement `isSameOrigin` using `sec-fetch-site` and an `Origin` host match, refuse cross-site or malformed origins, accept JSON `POST` only, cap request-body size, and return JSON with `cache-control: no-store`. Do not accept a caller-supplied cwd.

- [x] **Step 2: Resolve Session identity and workspace on the Host.**

  Inject DSH `webServer` and `sessions` dependencies. For each Git request, look up the submitted Session ID with `ctx.sessions.get`; return a clear not-found result if it is absent, then read cwd from that Session header. Never accept an arbitrary local path from the Client. Do not expose Context through the Git routes; the browser obtains all Context and provider usage from its standard projection hooks.

- [x] **Step 3: Read branch and file status without a shell.**

  Use `execFile('git', args, { cwd, timeout, maxBuffer })` with fixed Git arguments. Parse `git status --porcelain=v1 -z --branch` for branch, status and independent staged/unstaged flags using NUL-delimited records; correctly identify unborn (`No commits yet on …`) and detached (`HEAD (no branch)`) branch headers. Parse tracked counts from `git diff --numstat -z HEAD --`, including rename/copy two-path records and unusual filenames; in an unborn repository use the index diff plus new-file contents rather than treating missing `HEAD` as a fatal error. Preserve staged content/counts when an added file is subsequently missing from the worktree. Calculate text counts for untracked files using `git diff --no-index` against `/dev/null`. Keep one destination row for a rename/copy. Mark binary files without attempting to render them. Distinguish missing directory, missing Git and non-repository outcomes.

- [x] **Step 4: Add bounded unified diff reads for changed paths only.**

  Accept `{ sessionId, path }`; re-resolve that Session's cwd and require the path to occur in its latest changed-file snapshot. Resolve and check the target remains inside the repository root, allowing a missing target only for a deleted tracked file or a staged addition whose indexed content remains available. For that staged addition, return its cached/index diff. Use an argument-array Git command from the repository root with `--no-ext-diff`, `--no-color`, a bounded unified context and `--` before the validated pathspec. Handle untracked files as new-file diffs, cap output bytes, and answer binary files with metadata only. Return no filesystem mutation controls.

- [x] **Step 5: Register the snapshot and diff endpoints inside a disposable effect.**

  Expose `POST /api/session-rail/snapshot` and `POST /api/session-rail/diff`. Validate Session ID before every Git call. The snapshot returns explicit `repositoryStatus` values for absent/missing cwd and non-repositories so Environment can still render; return distinct stable error codes for missing session, changed-path mismatch, oversized diff and Git command failure. Resolve changed-file pathspecs against the repository root for both snapshot and diff. Dispose both routes when the plugin unloads.

**Checkpoint:** every filesystem operation is anchored to a live, validated DSH Session, route origin is checked, and all Git processes are read-only and shell-free.

Task 2 is implemented and passed spec and code-quality review. Build/typecheck remain scheduled for Task 5.

## Task 3: Register the per-session Client entry and data sources

**Files:** `src/client/entry.tsx`, `src/client/api.ts`, `src/client/pane.tsx`, `src/shared/types.ts`

- [x] **Step 1: Register the session tab and its view slot.**

  Register one unique `session-info` tab kind with `sidebarRightTabs` and one keyed `sidebar.right.pane.tab` body slot; declare both through DSH `ctx.effect`/`ctx.slots.inject` so unload disposes registrations. Add an entry in `conversation.session.header.utilities` that opens this tab through `sidebarRight.openTab`.

- [x] **Step 2: Bind the body to the tab's own Session.**

  Resolve Session ID from the tab slot owner props and `useTabInfo()` with that tab's Session as authority. Read cwd through the public DSH working-directory service bound to this Session; do not use a global selected Session. On initial mount or Session change, request a Git snapshot. Offer a refresh button and ignore responses belonging to a prior Session or an unmounted component.

- [x] **Step 3: Read context through the DSH `useProjection` hook.**

  Read `contextPressure`, `contextBreakdown` and `tokenUsage` only from the tab's Session projection hook, including while the Session receives new projection frames. Use `pressureTokens` when present, otherwise `projectedTokens` labelled estimated; show a percent only when `contextWindow` exists. Render only system, tools and messages estimates provided by DSH; do not invent MCP/skill/plugin per-category costs. When provider usage is available, show the cumulative input/cache/output usage as a separate reference row, not as current context occupancy. Do not fetch or copy these Session values into the Git snapshot API.

- [x] **Step 4: Read the public plugin inventory and Host changes snapshot.**

  Fetch DSH `remote.pluginInventory.list` for enabled Host plugin names/status; handle inventory failure only in the Plugins card. Implement `api.ts` calls to the same-origin JSON snapshot and diff endpoints with abort support and typed error decoding. Keep session data, plugin inventory and context projection values in separate state paths so one failing source does not blank the rest.

**Checkpoint:** changing between two Session tabs changes the workspace and all Session-scoped projections/data together; the plugin inventory remains instance-scoped.

Task 3 is implemented. The public inventory response is normalized from its `entries` snapshot; each card has isolated loading and error state.

## Task 4: Render the four cards and inline Changes diff

**Files:** `src/client/pane.tsx`, `src/client/styles.ts`, `src/client/i18n.ts`

- [x] **Step 1: Build the four ordered, collapsible cards.**

  Render Environment, Context, Plugins and Changes in that order, each with an independent collapse toggle. Use accessible buttons/headings, clear loading/error/empty states and a refresh control. Match the reference image's narrow dark rail cards, low-contrast borders, compact spacing, token meter and green/red change counts without copying Claude-specific labels.

- [x] **Step 2: Render environment and context values safely.**

  Show directory basename, full path with title/accessible text when truncated, computer/workspace label when available, branch or its absence, context usage versus capacity, provider usage as a separate reference when present, and individually labelled estimate categories. When context data is absent, state which value is unavailable without rendering `NaN`, a false `0%`, or fabricated categories.

- [x] **Step 3: Render inventory status and file change rows.**

  Show loaded plugin names and active/disabled states without configuration values. Show totals and changed file paths with status, staged/unstaged badges and per-file text additions/deletions. Binary files get a binary badge. Selecting a text file fetches its diff and expands a keyboard-accessible unified-diff viewer inline; cap displayed output according to the Host response.

- [x] **Step 4: Add complete Chinese and English text.**

  Provide Chinese as the default and English translations for section labels, estimates, empty states, git errors, loading states, refresh and diff actions. Use DSH's active language when exposed; otherwise detect the product language with a stable Chinese/English fallback.

**Checkpoint:** section order and error isolation match the approved design; diff and plugin controls are read-only.

Task 4 is implemented with scoped styles, independent collapsible cards, accessible controls, and Chinese/English fallback labels.

## Task 5: Document installation and build the distributable bundle

**Files:** `README.md`, `package.json`, `scripts/build.mjs`, generated `lib/index.js`, generated `lib/client.js`

- [x] **Step 1: Write the install and behavior documentation.**

  Document DSH and Node minimum versions, local install/removal commands, tab/header entry points, what each card displays, estimated versus provider-reported token values, and which composition capabilities may cause a section to show as unavailable. State explicitly that Changes is read-only.

- [x] **Step 2: Install declared development dependencies.**

  Run `npm install` in the plugin directory to create the lockfile for React external typings, Node typings, TypeScript and esbuild.

- [x] **Step 3: Run the compiler and package build.**

  Run `npm run typecheck`, then `npm run build`. The expected result is successful strict TypeScript checking and fresh `lib/index.js` and `lib/client.js` bundles ready for `dsh plugin --profile web add file:<absolute-path>`.

**Checkpoint:** the README installation commands correspond to package metadata, and the package contains the two built entry points declared by its manifest.

Task 5 completed: strict typecheck and bundle build succeeded on Node 20.18.1, with npm reporting the declared Node >=22.19.0 engine mismatch. Automated tests were not run or added.

## Execution notes

- The project folder currently has no writable `.git`; initialization was rejected because the sandbox grants `.git` read-only access. Do not try to move, symlink or otherwise bypass this boundary. Implement in the authorized project files and do not add commit steps.
- The available Node runtime is `20.18.1`; the plugin declares the DSH-compatible minimum `22.19.0`. If dependency install or build rejects that runtime, report the exact issue rather than changing the runtime requirement.
- Automated tests are omitted from this plan; implementation work is limited to typecheck/build and producing the requested plugin.

## DSH reference contracts

- [Right Sidebar tab types and `useTabInfo`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/sidebar-right.md)
- [Session slot props including `useProjection`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/slots.md)
- [Session Remote projection reads](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/api/session-controller/README.md)
- [Token pressure and breakdown projection semantics](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/token-meter/README.md)
- [Public plugin inventory and inventory-backed UI](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md)
- [Session header cwd and workspace ownership](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/workspace.md)

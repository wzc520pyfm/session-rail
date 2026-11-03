# Review Navigation and Commit Intent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Commit changes action that sends an ordinary follow-up message to the current DSH Agent, and route changed-file clicks to a configurable DSH sidebar review tab.

**Architecture:** Add a same-origin Host endpoint that resolves the requested Session's live Agent and enqueues a user message; it performs no Git operations. In the client, use the public right-sidebar registry/navigation services to list and open active page tabs, persist the selected target in package-scoped localStorage, and keep the inline diff as an unavailable-target fallback.

**Tech Stack:** TypeScript, React, DSH Host `agents` registry, DSH `sidebarRight` and `sidebarRightTabs`, same-origin JSON fetch, browser localStorage, esbuild.

---

### Task 1: Add a Host follow-up endpoint

**Files:**
- Modify: `src/host/plugin.ts`
- Modify: `src/client/api.ts`
- Modify: `src/shared/types.ts`

- [x] Add the DSH `agents` service to the Host plugin's declared dependencies and local structural context types; represent only the public `get(sessionId)` and Agent `followup(message)` surface needed here.
- [x] Add a `POST /api/session-rail/commit-request` route using existing origin, method, JSON and body-size guards.
- [x] Validate the session ID, resolve the live Agent with `agents.get(sessionId)`, and return `session_not_found` when no Agent exists. Never fall back to a different or globally selected Agent.
- [x] Include `followupAvailable` in the snapshot response, true only when the selected Session resolves to a live Agent with a callable `followup`; this lets the client disable the action before sending.
- [x] Create an identified `UserMessage` through the DSH message helper with role `user`, one text content block, and source `{ kind: 'user' }`; send the fixed instruction “Commit the working tree changes with a sensible message.” through `agent.followup(message)`.
- [x] Return a typed success envelope after the follow-up is queued. Do not accept caller-provided message text, file paths, or diff contents.
- [x] Add `sendCommitRequest(sessionId)` to `src/client/api.ts` and an API result type to `src/shared/types.ts`.
- [x] Run `npm run typecheck` and `npm run build`; confirm the new route is included in `lib/index.js` and the client API in `lib/client.js`.

### Task 2: Add review-target discovery and persistence

**Files:**
- Modify: `src/client/entry.tsx`
- Modify: `src/client/pane.tsx`

- [x] Extend the injected `sidebarRightTabs` shape to expose the public registry snapshot (`entries()` with a `getSnapshot()` compatibility fallback) and optional `subscribe()`, pass each active definition's `kind` and current `title()` into `RailPane`, and exclude Session Rail's own `session-info` kind.
- [x] Add a package-scoped storage key for the selected review kind; default to `codex-review` and catch unavailable or malformed localStorage values.
- [x] Add a compact editable target field in the Changes card. Suggest active registered page kinds by title and kind, preserve an unavailable saved choice, and allow the user to enter another plugin's tab kind.
- [x] Pass the existing injected `sidebarRight.openTab(kind)` function to the pane. Clicking a file row attempts that target; a successful open does not expand the inline diff at the same time.
- [x] If the target is not currently registered or `openTab` throws, show a localized enable/install hint and expand that file's existing inline diff.
- [x] Handle target changes and same-component React state without cross-session leakage; the saved target is profile-wide, while selected file and fallback messages remain Session Rail tab state.
- [x] Run `npm run typecheck` and `npm run build`.

### Task 3: Add the Commit changes action and feedback

**Files:**
- Modify: `src/client/pane.tsx`
- Modify: `src/client/i18n.ts`
- Modify: `src/client/styles.ts`

- [x] Add a `Commit changes` button to the Changes card, enabled only when the snapshot has changed files and a Session ID is available.
- [x] Also disable the button and show a localized explanation when `followupAvailable` is false, so unsupported/no-live-Agent sessions are explained before a click.
- [x] Use a synchronous in-flight lock in addition to React state so a rapid double-click cannot queue duplicate commit requests before the next render.
- [x] On click, call `requestCommit(sessionId)` exactly once; show a busy state while pending, a localized queued/sent confirmation on success, and a visible error if the Agent is unavailable or the request fails.
- [x] Keep all direct Git snapshot/diff calls read-only. The button sends intent only; it does not stage, commit, push, or execute arbitrary prompt text.
- [x] Add Chinese and English strings for the action, selector, unavailable target, Agent unavailable state, sending state, and sent confirmation.
- [x] Style the selector and action for the narrow sidebar and keyboard operation.
- [x] Run `npm run typecheck` and `npm run build`.

### Task 4: Document behavior and verify the built plugin

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-03-session-rail-review-and-commit-intent-design.md`

- [x] Document that Commit changes sends a prompt to the current Session's Agent and that the Agent performs any Git commit through its normal tools.
- [x] Document review-target selection, the `codex-review` default, and the inline-diff fallback when the selected tab kind is unavailable.
- [x] Run `npm run typecheck` and `npm run build` once after all changes.
- [ ] In the local DSH app, verify the button sends one follow-up to the displayed Session, selecting a changed file opens the chosen review tab, changing the selector changes the destination, and an unavailable destination falls back to inline diff with a hint.
- [ ] Confirm the visible Changes summary and Environment/Context/Plugins cards still render, and no new Host code mutates Git state.

# Session Rail review navigation and commit intent

## Goal

Make Changes useful as an entry point to the active conversation's coding workflow. `Commit changes` sends a user message to the current DSH conversation asking the agent to commit the working tree with a sensible message. Selecting a changed file opens the configured DSH review tab.

## User experience

- Keep the Changes card's current file count and addition/deletion summary.
- Add a `Commit changes` action when the working tree has changes. It submits a user message to the active conversation through DSH's `agents.get(sessionId).followup(...)` API, asking the agent to inspect and commit the working tree with a sensible message. It never runs Git commit itself.
- Clicking a changed-file row opens the configured review tab, defaulting to `codex-review`. If the configured kind is not registered, show an enable/install hint and expand the existing inline diff instead.
- Add a compact editable review-target setting with suggestions from every active page tab definition reported by the public `sidebarRightTabs` registry (`entries()`, with `getSnapshot()` compatibility where exposed), excluding Session Rail's own tab kind and resource-only types. DSH has no review-plugin classification field, and any registered page kind can be opened with `sidebarRight.openTab(kind)`, so the user may also enter an unlisted kind supplied by another review plugin. A missing or inactive target remains selected and gives a clear enable/install hint rather than silently failing.
- Persist the target kind in browser `localStorage` under a package-scoped key, matching the storage model used by the installed DSH review plugin. If storage is unavailable, keep the choice for the current UI lifetime and use `codex-review` as the initial target.
- Keep the selected review target local to the DSH profile and avoid sending file contents or paths in the commit prompt; the agent inspects the working tree through its normal tools.

## Integration and constraints

- Use DSH `sidebarRight.openTab(kind)` for navigation. The existing `dsh-codex-review-sidebar` registers `kind: 'codex-review'`.
- The client already injects the public `sidebarRight` and `sidebarRightTabs` services in `src/client/entry.tsx`; pass the active target kind to the pane and call `sidebarRight.openTab(kind)` when a row is clicked.
- Add a Host route backed by the public `agents` registry. Resolve the Session Rail tab's Session ID with `agents.get(sessionId)` and call `agent.followup({ content: [{ type: 'text', text }], source: { kind: 'user' } })`. If the Session has no live Agent, return a visible unavailable response and do not send to a different Session.
- If the supported message API is unavailable in the active client composition, disable the action with a visible explanation; do not silently fall back to direct Git mutation.
- Changes snapshot and diff endpoints remain read-only. No staging, commit, push, or file mutation is added to the Host API.

## Acceptance criteria

1. `Commit changes` sends one ordinary user follow-up message to the Agent owned by the Session Rail tab's Session ID with the commit instruction and does not directly modify Git state.
2. The message content is a text block and its source is `user`; no file path or contents are added by Session Rail.
3. Clicking a changed file opens the selected registered page tab in the right sidebar.
4. The review-target selector lists active registered sidebar tab definitions by title and kind, excluding Session Rail itself; the selected kind persists in browser storage where available.
5. If the target kind is unavailable, the UI explains how to enable/install a review plugin and expands inline diff access.
6. A missing Agent or Session produces an error state and sends no message to another conversation.
7. Existing Environment, Context, Plugins, and Changes data remain available; Changes reads remain read-only.

## Scope

The `Commit changes` label is a prompt shortcut only: it asks the Agent to perform the commit using its normal tools. Session Rail itself never stages, commits, pushes, or mutates files. The existing inline diff remains the fallback when no review plugin is enabled.

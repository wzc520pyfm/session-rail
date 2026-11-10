# DSH Session Rail

A per-session right sidebar preview for DeepSeek Harness (DSH). It displays Environment, Context, Plugins, Output files, and Git Changes in that order.

## Requirements

- DSH Web with the right-sidebar tab package available.
- Node.js `>=22.19.0` on the DSH Host.

## Build and install locally

From this package directory:

```sh
npm install
npm run typecheck
npm run build
dsh plugin --profile web add "file:$PWD"
```

Restart or reload the DSH Web profile if the plugin loader does not activate the new entry immediately. Remove it with:

```sh
dsh plugin --profile web remove session-rail
```

The Environment card shows the Session's project folder name, full path, and current Git branch. Context reads DSH token-meter projections (`contextPressure`, `contextBreakdown`, `tokenUsage`) and, when the optional `dsh-context` plugin is installed, the fine-grained `contextTimeline` projection. The panel shows a colored category occupancy bar, per-category shares, expandable assistant detail when present, timing/cache rows when the source provides them, and explicitly marks Claude-style categories that DSH does not expose (MCP instructions, Memory, and Skills when only the coarse meter is available). Plugin names and enabled/runtime status come from DSH's public read-only plugin inventory.

Output files lists files this Session's AI actually changed, grouped by turn with the newest turn first. Session Rail discovers each turn's `workspace/changes` event sequence by registering a `uiConversation` event definition that folds public `workspace/changes` and `deliverables/presented` events, then reads the Host summary from `GET /api/changes.summary?sessionId=&seq=`. Files explicitly delivered with `present` are included and marked Delivered / 「交付」. Clicking a changed file opens DSH's built-in `changes-review` tab through `sidebarRight.openResource` and `changesReviewAddress` (`dsh-resource://changes-review/session/<sessionId>/<seq>/<turn>`, with `{ params: { index } }`). Clicking a delivered file opens a Sidebar preview via `fileAddressFor(sessionId, cwd, path)`. If the Host was restarted and a summary no longer exists, the card shows that the summary is unavailable instead of inventing a 0-file count. A session with no announcements shows an empty state.

Changes lists the Session workspace's current Git working-tree files, staged/unstaged state, and line counts. `Commit changes` sends the fixed user message `Commit the working tree changes with a sensible message.` to that Session's live Agent. The Agent performs the commit through its normal tools; Session Rail never stages, commits, pushes, or mutates files itself.

Selecting a working-tree file opens the official `changes-review` tab on the latest turn whose summary lists that path. If the path is not in any recorded summary, Session Rail opens a Sidebar preview of the current file with `fileAddressFor`. It does not expand an inline raw unified diff, and it does not use `codex-review` as the default target. The `Review page` field remains as an optional override: when it is non-empty, Session Rail tries `openTab(kind)` first and then falls back to the official review or file preview if that kind cannot be opened. If `openResource` fails, a short status message is shown. The field still offers every active page tab published by the DSH `sidebarRightTabs` registry as a suggestion (resource-only types such as `changes-review`, which cannot be opened by kind, are omitted). The choice is stored in browser `localStorage`.

The sidebar tab is available from the right-sidebar tab picker and from the small button in the Session header. Switching Sessions uses that Session's own workspace, output-file announcements, and context projections.

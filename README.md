# DSH Session Rail

A per-session right sidebar preview for DeepSeek Harness (DSH). It displays Environment, Context, Plugins, and Git Changes in that order.

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

The Environment card shows the Session's project folder name, full path, and current Git branch. Context reads DSH's token-meter projections: pressure and capacity when available, estimated system/tool/message categories, and cumulative provider usage as a separate reference. Projection values depend on the active DSH composition; unavailable values remain explicitly unavailable. Plugin names and enabled/runtime status come from DSH's public read-only plugin inventory.

Changes lists the Session workspace's changed files, staged/unstaged state, and line counts. `Commit changes` sends the fixed user message `Commit the working tree changes with a sensible message.` to that Session's live Agent. The Agent performs the commit through its normal tools; Session Rail never stages, commits, pushes, or mutates files itself.

Selecting a changed file opens the page kind entered in the `Review page` field, such as `codex-review`. The field offers every active page tab published by the DSH `sidebarRightTabs` registry as a suggestion, while still allowing the kind to be entered directly. The choice is stored in browser `localStorage`. If the selected page is unavailable, Session Rail shows an installation hint and falls back to the bounded inline unified diff. Binaries show metadata without rendering contents.

The sidebar tab is available from the right-sidebar tab picker and from the small button in the Session header. Switching Sessions uses that Session's own workspace and context projections.

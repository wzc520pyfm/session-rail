# DSH Session Rail

A per-session right sidebar preview for DeepSeek Harness (DSH). It displays Environment, Context, Plugins, and read-only Git Changes in that order.

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

Changes lists the Session workspace's changed files, staged/unstaged state, and line counts. Select a text file to view its bounded unified diff. Git reads are anchored to the selected Session's DSH workspace and do not stage, revert, commit, or push anything. Binary files show metadata without rendering file contents.

The sidebar tab is available from the right-sidebar tab picker and from the small button in the Session header. Switching Sessions uses that Session's own workspace and context projections.

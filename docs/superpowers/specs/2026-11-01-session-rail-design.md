# DSH 会话信息侧栏设计

## 目标

提供一个可独立安装的 DSH 插件，在 DSH 每会话右侧栏中显示当前会话的环境、上下文、已加载插件和 Git Changes 概览。用户切换会话时，面板跟随当前会话，并可折叠各信息区。

## 形态与交互

插件通过 `ctx.sidebarRightTabs.register` 和 `sidebar.right.pane.tab` 注册一个 DSH 右侧栏标签页，并通过 `conversation.session.header.utilities` 提供会话标题处的快捷入口打开该标签页。采用 DSH 自带的每会话 docking surface，不修改 DSH 客户端，也不新增常驻轨道；标签页 body 使用框架注入的 `useTabInfo()` 确认当前 Session。

面板由以下卡片按固定次序组成，默认展开；用户可逐卡折叠：

1. **环境**：会话工作目录的文件夹名、完整路径和当前 Git 分支。目录或 Git 信息不可用时，显示具体缺失状态。
2. **上下文**：token-meter 的 `contextPressure.pressureTokens` 与 `contextPressure.contextWindow` 可用时显示当前压力和容量；`contextBreakdown` 的 `systemTokens`、`toolsTokens`、`messageTokens` 作为组成估算展示。若没有压力样本但有 `projectedTokens`，显示该数值并标为估算；没有容量时不显示占用百分比。组成项均标明为估算，不视为账单数据，也不自行把 DSH 的 tools 细分为 MCP、系统工具或插件。
3. **插件**：通过 DSH 的 `pluginInventory/list` 读取公开插件库存，并显示插件名称和启用状态；不显示插件私有配置或凭据。清单不可访问时显示“插件信息不可用”，而非推断。
4. **Changes**：工作区变更文件、状态和增删行数汇总。点选文件后在 Changes 卡片内展开由 Host 只读 Git diff 返回的统一差异；Git 不可用时保留环境信息并说明 Changes 无法加载。

初次打开后自动刷新；会话切换时重新请求所选会话数据。面板提供手动刷新入口。任何单一信息源失败时，其卡片单独显示错误或空状态，其他卡片仍可用。

## 数据与边界

- Client 从当前 Tab 的 `sessionId` 选择会话数据；不依赖全局活动会话猜测。Client 通过 DSH `remote.pluginInventory.list` 读取公开插件清单。
- Host 注入 DSH `sessions` service 并读取所请求 Session 的 header `cwd`；先确认 Session 存在，再以该路径为 Git 查询边界。请求只携带 Session ID，Client 不可指定任意本机路径。
- Changes 使用 DSH Host `webServer` 上的只读 snapshot/diff POST 路由。Host 通过 `sec-fetch-site` 和 `Origin`/`Host` 检查拒绝跨源请求，并要求 `application/json`；路由按 Session ID 重新解析目录，绝不信任 Client 路径。Git 查询只执行只读命令，返回分支、文件状态、增删统计和所选文件统一差异；不暂存、还原、提交或推送。
- Context 使用 DSH token-meter 提供的 `contextPressure`、`contextBreakdown` 与 `contextWindow`。其组成分类遵循 token-meter 定义，属于启发式估算；可用的 provider usage 显示为 usage 参考值。
- Plugin card 展示 DSH 公开的插件库存及启用状态；不得扫描进程内私有注册表或读取插件配置中的 secret。
- Unified diff 由 Host `execFile` 以参数数组启动 Git 命令取得；不经 shell 拼接。文件路径作为 `--` 后单独的 pathspec 参数，工作目录始终来自已校验 Session header。

## 失败状态

- Session 无工作目录：环境卡片展示“未关联项目目录”，Changes 展示无工作区。
- 工作目录不是 Git 仓库：显示目录信息，分支为不可用，Changes 展示“未检测到 Git 仓库”。
- Git 命令、插件清单或 token-meter 读取失败：仅对应卡片显示错误与重试入口。
- 未知上下文容量：仍展示可得的 tokens 与 breakdown，不显示错误的容量百分比。
- 没有改动或已加载插件：显示明确的空状态。

## 验收标准

- 可按 DSH 的 bundle/client 插件约定构建并从本地目录安装。
- 插件只注册一个会话级右侧栏标签页和可选的标题快捷入口；在两条会话间切换时数据不串会话。
- 四张卡片按指定顺序呈现，缺失数据时空状态可读且不影响其他卡片。
- Context 容量百分比使用实际 context window；组成分类明确标记为估算。
- Changes 能呈现 Git 状态及每个文本文件的增删汇总，展开文件行时显示统一差异；二进制文件显示二进制状态，不尝试渲染内容；这些操作不修改工作树。
- Git 访问不通过 shell 字符串拼接执行，也不提供任何写操作。
- 插件清单只展示名称，不暴露配置或凭据。

## DSH 接口依据

- 右侧栏、每 Session tab 与 `sidebarRightTabs` 注册契约：[DSH Right Sidebar](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/sidebar-right.md)。
- Client 插件公开库存能力：[DSH Plugin Manager](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md)，从 `remote.pluginInventory.list` 读取已加载 Host 插件条目。
- token-meter projection 字段与估算语义：[DSH Token Meter](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/token-meter/README.md)。
- Session 工作目录来自 header 的契约：[DSH Workspace](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/workspace.md)。

## 暂不包含

修改 DSH 宿主以新增固定常驻 Session Rail；提交、暂存、还原和推送；MCP 工具逐项 token 精确归因；插件配置编辑；远程 workspace 的本地 Git 直读。

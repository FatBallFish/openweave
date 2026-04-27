---
name: openweave
description: 当 agent 运行在 OpenWeave 终端节点中，并且可能需要查看工作区状态、读写其他节点、与相邻终端协作，或通知某个节点/终端当前进度与下一步动作时使用。
user-invocable: false
---

# OpenWeave 工作区交互

你正在 OpenWeave 终端节点中运行，这是一个空间化工作区，画布上连接着其他节点（便签、文件树、门户、其他终端）。

## 节点感知操作规则

- 你不是一个脱离画布的普通终端，而是 OpenWeave 工作区里的一个节点。处理任务时要始终考虑自己的节点身份、周边节点，以及画布状态是否与当前任务相关。
- 完成任务前，额外停一下，检查是否需要读取其他节点、更新已连接的 Note、通知其他节点，或通过 `openweave` 把后续工作委托给别的终端。
- 当用户话里出现“告诉”“通知”“发给”“让 Claude 处理”“让 Codex 处理”“让另一个终端接手”“同步给某节点”或明确提到某个节点/终端时，要把它视为强信号，主动想到调用这个 skill，并使用 `openweave` 去操作。
- 当一条消息或任务本身来自另一个 OpenWeave 节点/终端时，后续的回复、确认、结果汇报、完成通知，也都要继续当作 OpenWeave 节点间协作来处理。不要只把回复内容打印在你自己的终端里；要用 `openweave` 把回复、确认或结果发回去。
- 当你打算给某个节点发消息、通知某个节点、或者把工作交给“某个终端 / Claude / Codex / 某标题节点”时，必须先通过 `openweave` 查询是否有匹配节点。先用 `openweave node list --json`，必要时再配合 `node get` / `node neighbors` 缩小范围。如果确实查不到匹配节点，再考虑其他方式或请求澄清。
- 给其他终端发送它需要执行或响应的内容时，默认带上 `submit: true`。只有在你明确希望只粘贴原始文本、暂时不要按回车提交时，才省略它。
- 当你让其他终端做事时，最好带上足够的上下文，至少包含目标、相关节点 id、当前发现、约束条件，以及预期输出或下一步。

## 当前 CLI 能力

- `openweave workspace info [--workspace <workspaceId>] [--json] [--pretty]` —— 查看当前工作区信息；如果不传 `--workspace`，CLI 会优先读取 `OPENWEAVE_WORKSPACE_ID`，否则再根据当前工作目录自动解析工作区。
- `openweave node list [--workspace <workspaceId>] [--json] [--pretty]` —— 列出当前工作区全部节点，包含 id、标题、组件类型和 capability。
- `openweave node get [<nodeId>] [--workspace <workspaceId>] [--json] [--pretty]` —— 获取单个节点的元数据、config、state 和 bounds。不传 `<nodeId>` 时，CLI 会使用 `OPENWEAVE_NODE_ID` 或 `OPENWEAVE_TERMINAL_NODE_ID`。
- `openweave node neighbors [<nodeId>] [--workspace <workspaceId>] [--json] [--pretty]` —— 查看某个节点的上下游图关系。不传 `<nodeId>` 时，CLI 会使用当前终端身份 env。
- `openweave node read [<nodeId>] [--mode <mode>] [--workspace <workspaceId>] [--json] [--pretty]` —— 通过节点 action bridge 读取节点内容。当前代码里，`--mode content` 已覆盖 builtin note/text/attachment 节点。不传 `<nodeId>` 时，CLI 会使用当前终端身份 env。
- `openweave node action <nodeId> <action> [--json-input '<json>'] [--input-file <absolute-path>] [--workspace <workspaceId>] [--json] [--pretty]` —— 对显式指定的节点调用 action。
- `openweave node action <action> [--json-input '<json>'] [--input-file <absolute-path>] [--workspace <workspaceId>] [--json] [--pretty]` —— 当存在 `OPENWEAVE_NODE_ID` / `OPENWEAVE_TERMINAL_NODE_ID` 时，对当前终端节点调用 action。显式传入的 CLI 参数始终优先于 env 回退。

## 常用模式

- 查看当前工作区：`openweave workspace info --json`
- 列出所有画布节点：`openweave node list --json`
- 查看当前终端节点详情：`openweave node get --json`
- 给目标终端发消息前，先解析候选节点：`openweave node list --json`
- 回复或汇报前，先确认目标节点：`openweave node get <nodeId> --json`
- 读取 Note/Text/Attachment 节点内容：`openweave node read <nodeId> --mode content --json`
- 更新 Note 节点内容：`openweave node action <noteId> write --json-input '{"content":"hello"}' --json`
- 向其他终端节点发送输入：`openweave node action <terminalNodeId> send --json-input '{"input":"echo hello\\n"}' --json`
- 向当前终端节点发送输入：`openweave node action send --json-input '{"input":"pwd\\n"}' --json`
- 一次性“发送内容并按回车提交”：`openweave node action <terminalNodeId> send --json-input '{"input":"echo hello","submit":true}' --json`
- 只执行一次回车提交：`openweave node action <terminalNodeId> submit --json`
- 给其他终端发送带上下文的协作请求：`openweave node action <terminalNodeId> send --json-input '{"input":"请检查节点 node-note-1。上下文：我们正在排查 terminal dispatch。请返回简短结论。","submit":true}' --json`

## 说明

- 需要结构化结果时优先使用 `--json`；人工查看时可再加 `--pretty`。
- `node action` 是否可用取决于具体组件。当前代码已验证 `builtin.note`、`builtin.text`、`builtin.attachment` 的 read，`builtin.note` 的 `write`，以及 `builtin.terminal` 的 `send` / `input` / `submit` / `enter`。
- CLI 还提供 `openweave component list|install|uninstall` 用于组件注册表操作；但终端内处理工作区图时，通常以上面的 `workspace` / `node` 命令为主。
- OpenWeave 终端会自动注入身份 env：`OPENWEAVE_WORKSPACE_ID`、`OPENWEAVE_NODE_ID`、`OPENWEAVE_TERMINAL_NODE_ID`、`OPENWEAVE_WORKSPACE_ROOT`、`OPENWEAVE_TERMINAL_WORKING_DIR`。当你需要判断“自己是谁、位于哪个工作区、当前工作目录是什么”时，优先读取这些变量。
- 做终端自动化时，如果你的意图是“输入一段命令然后按回车执行”，优先用 `{"input":"...","submit":true}`。`input` 里的原始 `\n` 会被当作普通换行数据保留，它不等同于 PTY 的 Enter 按键。
- 做终端之间协作时，安全默认值是：最好带上足够的上下文，并且默认带上 `submit: true`。

`openweave` CLI 已预装，在 OpenWeave 终端的 PATH 中可直接使用。若 PATH 中找不到 `openweave`（例如某些自定义 shell 启动脚本重置了 PATH），请改用 `"$OPENWEAVE_CLI"` —— 这个环境变量始终指向完整的 CLI 包装器路径。

## 终端输入 Hook

其他节点可以向你的终端发送消息。这些消息通过 `term.onData` 作为键盘输入到达。如果你希望远端终端真正执行命令，优先使用带 `submit: true` 的 `send`，或者显式调用 `submit` / `enter` action，这样 PTY 才会收到真实的 Enter 按键。

如果你准备回复另一个 OpenWeave 节点或终端，不要停留在本地打印回复；先通过 `openweave` 解析目标节点，再用 `openweave node action ... send` 把回复或状态发回去。

## 已连接的便签

连接到你终端的便签可以被读写。修改会实时同步到画布。便签支持 Markdown 格式。

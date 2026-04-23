---
name: openweave
description: 在终端节点内与 OpenWeave 工作区画布交互。适用于用户需要读取或操作其他节点、向终端发送消息或探索工作区图的场景。
user-invocable: false
---

# OpenWeave 工作区交互

你正在 OpenWeave 终端节点中运行，这是一个空间化工作区，画布上连接着其他节点（便签、文件树、门户、其他终端）。

## 命令

- `openweave list` — 列出当前工作区的所有节点
- `openweave read <nodeId>` — 读取节点的内容/状态
- `openweave action <nodeId> <action>` — 在节点上执行操作
- `openweave write <nodeId> <key> <value>` — 更新节点配置
- `openweave send <terminalNodeId> <message>` — 向另一个终端节点发送输入，模拟用户键盘输入

`openweave` CLI 已预装，在 OpenWeave 终端的 PATH 中可直接使用。

## 终端输入 Hook

其他节点可以向你的终端发送消息。这些消息通过 `term.onData` 作为键盘输入到达，如果以换行符结尾则会自动执行。用于一个节点驱动另一个节点的自动化工作流。

## 已连接的便签

连接到你终端的便签可以被读写。修改会实时同步到画布。便签支持 Markdown 格式。

# OpenWeave MVP 决策清单

**目的：** 在开始编码前，关闭 `docs/tech-design/2026-04-15-openweave-tech-design-v1.md` 与 `docs/tech-design/2026-04-15-openweave-tech-design-v1-review-v3.md` 中提到的所有前置决策项。

**使用方式：** 请为每一项填写 `最终决策`、`决策负责人`、`决策日期` 和 `备注`。当某个阻塞项完成收敛后，请将其状态从 `Pending` 更新为 `Approved` 或 `Rejected`。

## Gate 总览

| ID | 决策项 | 阻塞级别 | 推荐默认值 | 状态 | 最终决策 |
| --- | --- | --- | --- | --- | --- |
| DC-01 | 模块 owner 与评审参与人 | 阻塞执行启动 | 为 Shell、Canvas、Runtime、Persistence、Portal、QA/Release 明确指定 owner | Approved | 见详细决策记录 |
| DC-02 | 是否接受 Electron 作为 MVP 壳层 | 阻塞架构启动 | 接受 Electron 作为 MVP 壳层；仅在 Portal PoC 或内存基线失败时再重评 | Approved | 见详细决策记录 |
| DC-03 | Windows/Linux 预览包开放时机 | 对 Phase A-C 非阻塞，但阻塞发布范围定义 | Alpha 仅支持 macOS；Windows/Linux 在 PTY 验证后再推进 | Approved | 见详细决策记录 |
| DC-04 | SQLite 时间戳命名规范 | 阻塞 schema 实现 | 所有持久化毫秒级时间戳统一使用 `*_at_ms` | Approved | 见详细决策记录 |
| DC-05 | 更新通道策略 | 对核心开发非阻塞，但阻塞发布准备 | Alpha 阶段仅采用手动分发安装包 | Approved | 见详细决策记录 |
| DC-06 | Portal 协议白名单 | 阻塞 Portal PoC 与安全基线 | 允许 `http://`、`https://`、`http://localhost`、`http://127.0.0.1`；MVP 拒绝 `file://` | Approved | 见详细决策记录 |
| DC-07 | 分发 / CDN / 安装包预算 | 对编码非阻塞，但阻塞发布执行 | Alpha 分发尽量轻量，在 Beta 前不承诺 CDN 投入 | Approved | 见详细决策记录 |
| DC-08 | 是否预留公开插件 API | 对 MVP 非阻塞，但影响扩展边界文档 | MVP 不暴露公开插件 API，仅保留内部扩展缝隙 | Approved | 见详细决策记录 |
| DC-09 | 首个安装包形态 | 阻塞发布准备 | 优先发布 DMG，ZIP 可选，Alpha 不做 Homebrew Cask | Approved | 见详细决策记录 |
| DC-10 | Playwright Electron 真机 QA 基线 | 阻塞测试策略 | 将 Playwright Electron E2E 纳入 MVP 基线 | Approved | 见详细决策记录 |
| DC-11 | Branch Workspace 复制 URL 但不复制登录态 | 阻塞 Branch Workspace 体验验收 | 仅复制 URL，不复制 cookies / session / 登录态 | Approved | 见详细决策记录 |

## 收敛顺序

### Gate 0：必须在任何产品实现开始前关闭
- DC-01 模块 owner 与评审参与人
- DC-02 Electron 接受结论
- DC-04 时间戳命名规范
- DC-06 Portal 协议白名单
- DC-10 Playwright Electron QA 基线
- DC-11 Branch Workspace 的 Portal 复制体验边界

### Gate 1：必须在发布准备前关闭
- DC-03 Windows/Linux 预览开放时机
- DC-05 更新策略
- DC-07 分发预算
- DC-09 安装包形态

### Gate 2：应在扩展相关文档固化前关闭
- DC-08 是否预留公开插件 API

## 详细决策记录

### DC-01 模块 owner 与评审参与人

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1192` 与 review v3 第 4 节。

**为什么重要：** 评审已经明确指出，Portal PoC 以及后续各阶段都需要有明确 owner。没有 owner，阶段计划就无法可靠地分工和排期。

**推荐默认值**
- Shell / 打包 owner：__________________
- Canvas / renderer owner：__________________
- Runtime / PTY / Git owner：__________________
- Persistence / migrations owner：__________________
- Portal / PoC owner：__________________
- QA / E2E / release owner：__________________

**请填写**
- 状态：Approved
- 最终决策：
  - Shell / 打包 owner：王凌超
  - Canvas / renderer owner：王凌超
  - Runtime / PTY / Git owner：王凌超
  - Persistence / migrations owner：王凌超
  - Portal / PoC owner：王凌超
  - QA / E2E / release owner：王凌超
  - 备注：最终各模块的打包工作交由AI Agent生成打包脚本，后交给Github Action做自动化打包

- 决策负责人：王凌超
- 决策日期：2026年04月16日00:39:04
- 备注：

### DC-02 是否接受 Electron 作为 MVP 壳层

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L269`。

**为什么重要：** 当前整个模块拆分、IPC 设计、Portal 方案与测试体系，都是建立在 Electron 前提上的。

**选项**
1. 接受 Electron 作为 MVP 壳层，并在 Alpha 前保持架构稳定。**（推荐）**
2. 仅将 Electron 用于 PoC，待进入 Phase A 前再重新评审。
3. 不接受 Electron，重新开始方案设计。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：接受 Electron 作为 MVP 壳层，并在 Alpha 前保持架构稳定。
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:39:39
- 备注：

### DC-03 Windows/Linux 预览包开放时机

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1198`。

**为什么重要：** 不同平台的 PTY 行为和安装包策略差异较大，过早承诺多平台会放大风险。

**选项**
1. Alpha 仅支持 macOS；Windows/Linux 在 PTY 验证后再开始。**（推荐）**
2. 在 Phase B 之后，同时开始 macOS 与 Windows 预览。
3. 现在就承诺完整的多平台 Alpha。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：Alpha 仅支持 macOS；Windows/Linux 在 PTY 验证后再开始。
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:40:08
- 备注：

### DC-04 SQLite 时间戳命名规范

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1199`。

**为什么重要：** Schema migration、审计、Run 时间线与恢复逻辑，都依赖统一的时间戳命名约定。

**选项**
1. 所有持久化的毫秒级时间戳统一使用 `*_at_ms`。**（推荐）**
2. 按表语义混用后缀，例如 `created_at`、`updated_at_ms`。
3. 不使用整数，统一存 ISO 时间字符串。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：所有持久化的毫秒级时间戳统一使用 `*_at_ms`。
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:40:28
- 备注：

### DC-05 更新通道策略

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1200`。

**为什么重要：** 自动更新会直接影响发布流水线、回滚机制以及签名要求。

**选项**
1. Alpha 阶段仅采用手动分发安装包。**（推荐）**
2. 内部用户继续手动分发，但对有限白名单开放自动更新。
3. 从首个 Alpha 起就启用完整自动更新。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：Alpha 阶段仅采用手动分发安装包。
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:40:50
- 备注：

### DC-06 Portal 协议白名单

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1201` 与安全章节 2.9。

**为什么重要：** 这个决策会直接改变 Portal 的安全面、PoC 范围以及 QA 测试矩阵。

**选项**
1. 允许 `http://`、`https://`、`localhost` 与 `127.0.0.1`；拒绝 `file://`。**（推荐）**
2. 额外允许 `file://`，以方便本地原型调试。
3. MVP 仅允许 `http://localhost`。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：允许 `http://`、`https://`、`localhost` 与 `127.0.0.1`；拒绝 `file://`
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:41:12
- 备注：

### DC-07 分发 / CDN / 安装包预算

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1202`。

**为什么重要：** 分发成本和渠道选择会影响安装包策略、资源托管方式与发布自动化方案。

**推荐默认值**
- Alpha 分发范围：内部贡献者 + 邀请测试者
- 托管方式：优先本地 / 手动分享，Beta 前不承诺 CDN
- 预算上限：暂时没有分发相关预算

**请填写**

- 状态：Approved
- 最终决策：
  - Alpha 分发范围：内部贡献者 + 邀请测试者
  - 托管方式：优先本地 / 手动分享，Beta 前不承诺 CDN
  - 预算上限：暂时没有分发相关预算

- 决策负责人：王凌超
- 决策日期：
- 备注：

### DC-08 是否预留公开插件 API

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1203`。

**为什么重要：** 这个决策决定了 MVP 暴露的是稳定的扩展边界，还是仅保留内部接口。

**选项**
1. MVP 不提供公开插件 API，仅保留内部扩展缝隙。**（推荐）**
2. 现在就预留一组很窄的实验性插件接口。
3. 将扩展 API 作为 MVP 一级交付内容。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：MVP 不提供公开插件 API，仅保留内部扩展缝隙。
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:43:26
- 备注：

### DC-09 首个安装包形态

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1204`。

**为什么重要：** 安装包形态会影响签名、公证、支持成本和发布清单。

**选项**
1. 优先 DMG，ZIP 可选，Alpha 不做 Homebrew Cask。**（推荐）**
2. 为了更快交付，先做 ZIP，再补 DMG。
3. 从首个 Alpha 起同时支持 DMG + ZIP + Homebrew Cask。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：优先 DMG，ZIP 可选，Alpha 不做 Homebrew Cask，Windows调研完成后需支持msi，Linux需支持压缩包解压或deb格式
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:44:40
- 备注：

### DC-10 Playwright Electron 真机 QA 基线

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1205` 与测试章节 5.2。

**为什么重要：** 多个验收标准依赖真实的 BrowserWindow / WebContentsView 行为，不能只靠单元测试判断。

**选项**
1. 将 Playwright Electron E2E 纳入 MVP 基线。**（推荐）**
2. Portal 与壳层集成只做手工 QA。
3. Electron E2E 推迟到 Alpha 之后再补。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：将 Playwright Electron E2E 纳入 MVP 基线
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:45:18
- 备注：

### DC-11 Branch Workspace 复制 URL 但不复制登录态

**来源：** `docs/tech-design/2026-04-15-openweave-tech-design-v1.md#L1206` 与 review v3 第 4 节。

**为什么重要：** 这是定义 Branch Workspace “复制什么、不复制什么”的产品体验边界。

**选项**
1. 仅复制 Portal URL；不复制 cookies、登录态、截图或 portal session 数据。**（推荐）**
2. 复制 URL 和最近一张截图，但不复制登录态。
3. 尝试在 workspace 间完整复制登录态。

**推荐默认值：** 选项 1。

**请填写**
- 状态：Approved
- 最终决策：仅复制 Portal URL；不复制 cookies、登录态、截图或 portal session 数据
- 决策负责人：王凌超
- 决策日期：2026年04月16日00:45:43
- 备注：

## 退出条件

当满足以下条件时，可以认为编码前决策已经关闭：
- 所有 Gate 0 项都已被标记为 `Approved` 或 `Rejected`，且都有明确决策。
- 对于任何被拒绝的推荐方案，都在 `备注` 中写明了替代路径。
- Portal PoC owner 与 QA owner 已被明确指定。
- Alpha 的发布路径已经足够明确，能够继续推进 Phase E 规划。

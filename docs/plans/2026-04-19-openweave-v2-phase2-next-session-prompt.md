# OpenWeave V2 Phase 2 新 Session 提示词

## 当前状态

- 这份 prompt 已不再是 Phase 2 的首选继续入口。
- 当前 worktree 上，V2 Phase 2 Interactive Terminal 的计划内 Task 已完成：
  - additive `runInput` / `runStop` contracts 已落地
  - `stopped` 已成为一等终态
  - main-process stop finalization 已改为 confirmed worker exit 驱动
  - terminal node runtime 持久化与 selector 已落地
  - renderer interactive terminal session surface 已落地
  - focused Vitest / build / Playwright verification 已跑通
- 如果需要开启新 session，请不要再按“继续完成 Phase 2”来拆任务；优先改为评估 Phase 3 builtin components 或 Phase 4 Canvas Shell V2 的下一步计划。

## 历史交接 Prompt

如果需要回看当时的历史交接上下文，可以使用下面这段旧提示词：

```text
当前仓库是 OpenWeave。

当前主 checkout 已在：
- 仓库根目录：`/Users/fatballfish/Documents/Projects/ClientProjects/openweave`
- 当前分支：`feat/phase1-kernel-shared`

这条分支已经完成了 V2 Phase 1 kernel 的代码闭环。你这次不要回头重做 Phase 1，也不要切回 `main`。

请先使用 `superpowers:using-git-worktrees`，从当前分支 `feat/phase1-kernel-shared` 创建或切到一个独立 worktree 再开始实现。不要直接在 `main` 上做，也不要回滚当前分支已有改动。

然后使用 `superpowers:executing-plans` 执行这份新计划：
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`

开始前请先完整阅读并批判性 review 以下文档：
- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-16-openweave-windows-runtime-poc-validation.md`
- `docs/plans/2026-04-16-openweave-windows-runtime-poc-report.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`

你必须把下面这些现状当成“已完成基线”，不要重复推翻或重做：
- Graph Schema V2 + shared contracts 已落地
- Component Manifest V1 已落地
- Component Registry / Installer（directory + zip）已落地
- `openweave` CLI 的 workspace/node/component 主命令已落地
- 本地 embedded workspace/node bridge service 已落地
- component action dispatcher 已落地
- Skill Pack Manager 已落地
- Workspace Skill Injection Manager 已落地
- runtime matrix 已支持 `shell` / `codex` / `claude` / `opencode`
- demo external component 闭环验证已落地

本次新 session 的目标不是 builtin component 重写，也不是 Canvas Shell V2。目标只有一个：
1. 落地 V2 Phase 2 Interactive Terminal

具体来说，要补齐这些 gap：
- Terminal 必须支持真实交互式输入输出
- Terminal 必须支持 `shell` / `codex` / `claude` / `opencode`
- Terminal 必须支持运行中再次输入和中断
- 保持现有 skill injection / managed runtime preflight / run recovery 语义不被破坏

硬约束：
- 不要改 `main`
- 不要回滚无关脏改动
- 不要把范围扩散到 builtin components 重写
- 不要把范围扩散到 Canvas Shell V2 / React Flow 迁移
- 不要把范围扩散到 socket / named pipe / headless `serve`
- `node-pty` 只能留在 worker 边界，renderer/shared 不得直接引用
- 优先在现有 `runs` 子系统上做 additive 演进，不要凭空重造一套 session 系统
- 尽量保持现有 CLI envelope 和已接受错误行为稳定，除非 interactive terminal 的 additive contract 必须扩展

执行方式：
- 先 review plan，并先给出“是否存在阻止开始执行的关键 blocker”
- 如果没有 blocker，再按 `executing-plans` 默认方式分批执行
- 实现时记得用 subagent 去做实现
- 每完成一批后，汇报：
  - 完成了什么
  - 跑了哪些验证
  - 还剩哪些任务
  - 明确写一句：`Ready for feedback.`
- 遇到 scope 冲突、文档与代码事实严重不一致、或连续验证失败时，立即停止并反馈，不要自行扩大范围
- 遇到非阻塞风险，记录到 `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`，不要因为细节问题卡住整批任务

请现在开始：
1. 先 review `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`
2. 判断是否存在阻止开始执行的关键问题
3. 如果没有，就创建 todo 并启动第一批任务
```

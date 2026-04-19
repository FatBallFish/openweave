# OpenWeave V2 Phase 2 Batch 2 新 Session 提示词

请在新 agent / 新 session 中直接粘贴下面这段提示词：

```text
当前仓库是 OpenWeave。

不要从 `feat/phase1-kernel-shared` 重新起一遍。本次要继续的是已经存在的 Phase 2 worktree：
- worktree 路径：`/Users/fatballfish/Documents/Projects/ClientProjects/openweave/.worktrees/feat/phase2-interactive-terminal`
- 当前分支：`feat/phase2-interactive-terminal`

这个 worktree 上已经完成了 V2 Phase 2 的第一批实现（Task 1 ~ Task 3 的 WIP），并且当前存在**预期中的未提交改动**。这些脏改动不是异常，请不要把它们当成 unexpected changes，也不要回滚。

开始前请先进入上面的 worktree，并确认 `git status --short` 中以下文件是预期 dirty baseline：
- `package.json`
- `package-lock.json`
- `src/main/ipc/runs.ts`
- `src/main/preload.ts`
- `src/main/runtime/runtime-bridge.ts`
- `src/shared/ipc/contracts.ts`
- `src/shared/ipc/schemas.ts`
- `src/worker/adapters/shell-runtime.ts`
- `src/worker/runtime-worker.ts`
- `src/worker/adapters/pty-runtime.ts`
- `tests/integration/main/runs-ipc.test.ts`
- `tests/integration/main/runs-register-recovery.test.ts`
- `tests/integration/main/runtime-launch.test.ts`
- `tests/unit/main/preload.test.ts`
- `tests/unit/worker/runtime-adapters.test.ts`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

请使用 `superpowers:executing-plans` 执行这份“下一批”计划：
- `docs/plans/2026-04-19-openweave-v2-phase2-batch2-main-control-and-renderer.md`

开始前请完整阅读并批判性 review：
- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-batch2-main-control-and-renderer.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

你必须把下面这些状态当成“已完成或已接受的当前基线”，不要回头重做：
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
- Phase 2 Task 2 的 additive run contracts 已落地：`runInput` / `runStop` / `stopped`
- Phase 2 Task 3 的 PTY worker/runtime bridge 路径已落地：`node-pty` 已进入 worker 边界

本次 session 的目标不是 builtin component 重写，也不是 Canvas Shell V2。目标只有一个：
1. 执行 Phase 2 的下一批收尾工作

具体要完成：
- 修正 `stopRun` 的 main-process finalization 语义，让 `stopped` 在真实 worker exit 后确认
- 保持 managed runtime preflight / exclusivity / run recovery 语义不被破坏
- 给 terminal 节点补 runtime 持久化与 selector
- 落地 renderer interactive terminal session surface
- 把 `stopped` 纳入 renderer 终态处理
- 跑完 focused unit/integration/build/E2E，并回填 docs

硬约束：
- 不要改 `main`
- 不要新建第二套 session 子系统
- 不要回滚当前 worktree 的预期脏改动
- 不要把范围扩散到 builtin components 重写
- 不要把范围扩散到 Canvas Shell V2 / React Flow 迁移
- 不要把范围扩散到 socket / named pipe / headless `serve`
- `node-pty` 只能留在 worker 边界，renderer/shared 不得直接引用
- 优先在现有 `runs` 子系统上做 additive 演进

执行方式：
- 先 review 新 plan，并先给出“是否存在阻止开始执行的关键 blocker”
- 如果没有 blocker，再按 `executing-plans` 默认方式分批执行
- 实现时记得用 subagent 去做实现
- 每完成一批后，汇报：
  - 完成了什么
  - 跑了哪些验证
  - 还剩哪些任务
  - 明确写一句：`Ready for feedback.`
- 遇到 scope 冲突、文档与代码事实严重不一致、或连续验证失败时，立即停止并反馈，不要自行扩大范围
- 遇到非阻塞风险，记录到 `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

请现在开始：
1. 先 review `docs/plans/2026-04-19-openweave-v2-phase2-batch2-main-control-and-renderer.md`
2. 判断是否存在阻止开始执行的关键问题
3. 如果没有，就创建 todo 并启动第一批任务
```

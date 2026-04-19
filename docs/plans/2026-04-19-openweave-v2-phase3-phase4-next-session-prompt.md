# OpenWeave V2 Phase 3 / Phase 4 后续 Session 提示词

请在新 agent / 新 session 中直接粘贴下面这段提示词：

```text
当前仓库是 OpenWeave。

不要重做已经落地的 Phase 3 / Phase 4 renderer 迁移。本次要继续的是已经存在的 worktree：
- worktree 路径：`/Users/fatballfish/Documents/Projects/ClientProjects/openweave/.worktrees/feat/phase2-interactive-terminal`
- 当前分支：`feat/phase2-interactive-terminal`

开始前先进入这个 worktree，并确认当前分支仍然是：
- `feat/phase2-interactive-terminal`

把下面这些状态当成已经完成的当前基线，不要回头重做：
- renderer load/save 已切到 Graph Schema V2 additive IPC
- shared builtin manifest catalog 已落地：`src/shared/components/builtin-manifests.ts`
- manifest-driven builtin host registry 已落地：`src/renderer/features/components/builtin-host-registry.tsx`
- `builtin.note` / `builtin.terminal` / `builtin.file-tree` / `builtin.portal` / `builtin.text` / `builtin.attachment` 已进入 renderer host 路径
- Canvas Shell V2 第一版已落地，基于 `@xyflow/react`
- node move 已持久化回 Graph Schema V2
- focused build / unit / integration / required E2E 已跑绿

先完整阅读并批判性 review：
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-builtin-hosts-and-canvas-shell.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`

本次 session 的首要目标不是继续扩 scope，而是处理 Phase 3 / Phase 4 收尾遗留：
1. 调查并修复 `tests/e2e/branch-workspace.spec.ts` 超时
2. 判断这是不是 file-tree host / branch dialog / canvas shell 交互回归
3. 如果修复成本低，补上 focused verification 并回填风险日志
4. 如果不是低风险修复，就把根因和建议方案写清楚，保持当前基线不被破坏

硬约束：
- 不要改 `main`
- 不要新建第二套 graph schema / renderer session / runtime session 系统
- 不要回滚当前 worktree 的预期脏改动
- 不要把范围扩散到 socket / named pipe / headless `serve` / npm install source / 多人协作 / workflow DSL
- `node-pty` 仍然只能留在 worker 边界
- 不要破坏已经跑绿的 terminal/recovery focused verification

开始后请先做：
1. 复现 `tests/e2e/branch-workspace.spec.ts`
2. 判断是否存在阻止继续修复的关键 blocker
3. 如果没有 blocker，再按最小修复路径推进
4. 所有非阻塞风险继续写回 `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
```

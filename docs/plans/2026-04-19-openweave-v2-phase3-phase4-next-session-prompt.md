# OpenWeave V2 Phase 3 / Phase 4 后续 Session 提示词

请在新 agent / 新 session 中直接粘贴下面这段提示词：

```text
当前仓库是 OpenWeave。

本次不要新建 worktree。直接在当前仓库里切分支：
1. 先执行 `git checkout feat/phase2-interactive-terminal`
2. 再执行 `git pull --ff-only`
3. 再执行 `git checkout -b feat/phase3-portal-isolation-followup`

如果第 3 步分支名已存在，就直接 `git checkout feat/phase3-portal-isolation-followup`，不要创建第二个 worktree。

开始前确认当前分支不是 `main`，并确认你最终工作的分支是：
- `feat/phase3-portal-isolation-followup`

不要重做已经落地的 Phase 2 / Phase 3 / Phase 4 功能迁移。把下面这些状态当成当前 accepted baseline：
- renderer load/save 已切到 Graph Schema V2 additive IPC
- shared builtin manifest catalog 已落地：`src/shared/components/builtin-manifests.ts`
- manifest-driven builtin host registry 已落地：`src/renderer/features/components/builtin-host-registry.tsx`
- `builtin.note` / `builtin.terminal` / `builtin.file-tree` / `builtin.portal` / `builtin.text` / `builtin.attachment` 已进入 renderer host 路径
- Canvas Shell V2 第一版已落地，基于 `@xyflow/react`
- node move 已持久化回 Graph Schema V2
- `branch-workspace` 的 Graph V2 copy + shell interaction 最小修复已落地并重新跑绿
- focused build / unit / integration / required E2E 已跑绿

先完整阅读并批判性 review：
- `docs/plans/2026-04-20-openweave-v2-phase3-portal-isolation-followup.md`
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-builtin-hosts-and-canvas-shell.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`

本次 session 的首要目标不是继续扩 scope，而是做一个稳定性收尾 slice：
1. 调查并修复 `portal` 运行时仍可能污染 renderer 主窗口导航的问题
2. 把这个问题补成明确的 regression coverage，而不是只靠现有功能 E2E 侥幸通过
3. 保持 Canvas Shell V2 的 host interaction guardrail，不要把点击拦截问题修回去
4. 如果修复成本低，就补 focused verification 并回填风险日志
5. 如果不是低风险修复，就把根因和建议方案写清楚，保持当前基线不被破坏

硬约束：
- 不要改 `main`
- 不要新建第二套 graph schema / renderer session / runtime session / portal session 系统
- 不要新建 worktree
- 不要回滚当前 worktree 的预期变更
- 不要把范围扩散到 socket / named pipe / headless `serve` / npm install source / 多人协作 / workflow DSL
- `node-pty` 仍然只能留在 worker 边界
- 不要破坏已经跑绿的 terminal / recovery / branch-workspace focused verification

开始后请先做：
1. 复现 `tests/e2e/portal-node.spec.ts`，并明确记录 portal load / action 后主窗口是否仍停留在 renderer `file:` 入口
2. 跑 `tests/unit/main/portal-manager.behavior.test.ts`，确认当前 portal manager ownership 语义
3. 判断是否存在阻止继续修复的关键 blocker
4. 如果没有 blocker，再按 `docs/plans/2026-04-20-openweave-v2-phase3-portal-isolation-followup.md` 的最小修复路径推进
5. 所有非阻塞风险继续写回 `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
```

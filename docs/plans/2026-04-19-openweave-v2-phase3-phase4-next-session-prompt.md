# OpenWeave V2 Phase 3 / Phase 4 新 Session 提示词

请在新 agent / 新 session 中直接粘贴下面这段提示词：

```text
当前仓库是 OpenWeave。

不要从 `feat/phase1-kernel-shared` 重新起一遍。本次要继续的是已经存在的后续 worktree：
- worktree 路径：`/Users/fatballfish/Documents/Projects/ClientProjects/openweave/.worktrees/feat/phase2-interactive-terminal`
- 当前分支：`feat/phase2-interactive-terminal`

这个 worktree 上已经完成了 V2 Phase 1 kernel 与 V2 Phase 2 Interactive Terminal，并且当前存在**预期中的未提交改动或刚提交后的新基线**。不要把这些变化当成异常，也不要回滚它们。

开始前请先进入上面的 worktree，并确认当前分支就是：
- `feat/phase2-interactive-terminal`

请使用 `superpowers:executing-plans` 执行这份新的 Phase 3 / Phase 4 计划：
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-builtin-hosts-and-canvas-shell.md`

开始前请完整阅读并批判性 review：
- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-batch2-main-control-and-renderer.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-builtin-hosts-and-canvas-shell.md`

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
- Phase 2 interactive terminal 已落地：真实 follow-up input / stop / `stopped` / runtime selector / focused verification
- main-process stop finalization 已改为 confirmed worker exit 驱动

本次 session 的目标不是重做 runtime 链路。目标只有一个：
1. 执行下一批 Phase 3 / Phase 4 renderer 迁移工作

具体要完成：
- 让 renderer product surface 以 Graph Schema V2 为主数据面
- 落地 manifest-driven builtin host registry
- 让 `builtin.note` / `builtin.terminal` / `builtin.file-tree` / `builtin.portal` / `builtin.text` / `builtin.attachment` 都进入 renderer host 路径
- 落地 Canvas Shell V2 的第一版真实 graph canvas
- 保持 Phase 2 terminal、bridge、CLI、skill injection、recovery 语义不被破坏
- 跑完 focused unit/integration/build/E2E，并回填 docs

硬约束：
- 不要改 `main`
- 不要新建第二套 graph schema 或第二套 session 子系统
- 不要回滚当前 worktree 的预期脏改动
- 不要把范围扩散到 socket / named pipe / headless `serve`
- 不要把范围扩散到 npm install source、多人协作、workflow DSL
- `node-pty` 只能留在 worker 边界，renderer/shared 不得直接引用
- 优先复用已有 graph schema / manifests / component registry / action dispatcher / runs subsystem
- 不要继续给 legacy `canvasLoad` / `canvasSave` 追加产品级能力，目标是迁到 Graph V2

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
- 遇到非阻塞风险，记录到 `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md` 或已有风险日志，不要因为细节问题卡住整批任务

请现在开始：
1. 先 review `docs/plans/2026-04-19-openweave-v2-phase3-phase4-builtin-hosts-and-canvas-shell.md`
2. 判断是否存在阻止开始执行的关键问题
3. 如果没有，就创建 todo 并启动第一批任务
```

# OpenWeave V2 新 Session 提示词

请在新 session 中直接粘贴下面这段提示词：

```text
当前仓库是 OpenWeave。

实现工作请不要在 `main` 上进行。代码主路径在：
- 仓库根目录：`/Users/fatballfish/Documents/Projects/ClientProjects/openweave`
- 当前重构工作树：`/Users/fatballfish/Documents/Projects/ClientProjects/openweave/.worktrees/feat/phase1-kernel-shared`

请先使用 `superpowers:using-git-worktrees`，确认你在独立工作区执行；如果继续沿用现有工作树，也必须明确说明不会改动 `main`。

然后使用 `superpowers:executing-plans` 执行这份计划：
- `docs/plans/2026-04-18-openweave-v2-next-execution-plan.md`

开始前请先完整阅读并批判性 review 以下文档：
- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-v2-next-execution-plan.md`

你必须把下面这些现状当成“已完成基线”，不要重复推翻或重做：
- Graph Schema V2 + shared contracts 已落地
- Component Manifest V1 已落地
- Component Registry / Installer（directory + zip）已落地
- `openweave` CLI 的 workspace/node/component 主命令已落地
- 本地 embedded workspace/node bridge service 已落地
- component action dispatcher 已落地
- builtin action adapter 当前已支持：
  - `builtin.note`：read/write
  - `builtin.text`：read
  - `builtin.attachment`：read
- builtin 组件名冲突策略已经锁定：第三方/外部组件若与 builtin 同名，必须直接拒绝注册/安装，不允许进入 registry

本次新 session 的目标不是继续打磨这些已完成细节，而是补齐 Phase 1 剩余的大块：
1. Skill Pack Manager
2. Workspace Skill Injection Manager
3. Runtime Adapter 收口，并把 OpenCode 纳入正式支持
4. Demo / Mock Component 闭环验证
5. Phase 1 文档与退出标准回填

硬约束：
- 不要改 `main`
- 不要回滚无关脏改动
- 不要把范围扩散到 Canvas Shell V2 或 builtin UI 重写
- headless `serve` / socket / named pipe bridge 不是这次主目标，除非实现当前计划时被证明是不可绕开的前置条件
- OpenCode 是正式支持，不是 beta
- 组件安装首版只做 local directory / zip
- 尽量保持现有 CLI envelope 和已接受的错误行为稳定，避免顺手做 contract churn

执行方式：
- 先 review plan，并先给出“是否存在阻止开始执行的关键 blocker”
- 如果没有 blocker，再按 `executing-plans` 默认方式分批执行
- 每完成一批后，汇报：
  - 完成了什么
  - 跑了哪些验证
  - 还剩哪些任务
  - 明确写一句：`Ready for feedback.`
- 遇到 scope 冲突、文档与代码事实严重不一致、或连续验证失败时，立即停止并反馈，不要自行扩大范围

请现在开始：
1. 先 review `docs/plans/2026-04-18-openweave-v2-next-execution-plan.md`
2. 判断是否存在阻止开始执行的关键问题
3. 如果没有，就创建 todo 并启动第一批任务
```

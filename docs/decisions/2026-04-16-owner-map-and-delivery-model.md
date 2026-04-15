# ADR: 模块 Owner 与交付执行模型

- 日期：2026-04-16
- 状态：Accepted
- 关联文档：`docs/plans/2026-04-16-openweave-decision-checklist.md`

## 背景

技术方案终评明确指出，Portal PoC 和后续开发阶段都需要清晰 owner。当前项目处于早期，实际开发组织以单 owner 推进为主，因此需要明确责任归口和打包交付模式，避免计划存在“理论上可执行、实际上无人承接”的问题。

## 决策

1. 以下模块 owner 均为王凌超：
   - Shell / 打包
   - Canvas / renderer
   - Runtime / PTY / Git
   - Persistence / migrations
   - Portal / PoC
   - QA / E2E / release
2. 各模块的打包脚本由 AI Agent 辅助生成。
3. 打包执行最终交由 GitHub Actions 自动化完成。

## 决策依据

- 当前项目规模与阶段更适合单 owner 负责到底，沟通成本最低。
- AI Agent 适合承担脚本模板和自动化配置生成，提高基建推进速度。
- GitHub Actions 适合承接后续 macOS Alpha 包构建和内部工件产出，能减少本地重复手工操作。

## 影响

### 正向影响

- 所有 Gate 0 与 Task owner 都已明确，计划可直接进入执行。
- 文档、PoC、工程搭建、测试和发布链路都由同一 owner 驱动，优先级更容易统一。
- 打包脚本与 CI 可以提前纳入计划，而不是等到发布阶段临时补。

### 约束与代价

- 单 owner 模式意味着吞吐量受限，任务执行上更需要严格遵守阶段优先级。
- GitHub Actions 自动打包依赖后续补齐签名、密钥与 CI 环境变量配置。
- AI Agent 生成脚本后仍需人工校验，不能直接视为可发布结果。

## 后续动作

1. 在新 session 执行计划时，以王凌超为唯一默认 owner，不再等待额外分工确认。
2. 在 Task 12 中优先补齐 GitHub Actions 打包流程骨架。
3. 如后续引入更多开发者，再把当前 owner map 演进为模块责任矩阵。

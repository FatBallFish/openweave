# ADR: MVP 壳层与发布策略决策

- 日期：2026-04-16
- 状态：Accepted
- 关联文档：`docs/plans/2026-04-16-openweave-decision-checklist.md`、`docs/plans/2026-04-16-openweave-mvp-implementation-plan.md`、`docs/plans/2026-04-16-openweave-windows-runtime-poc-report.md`

## 背景

OpenWeave 当前仍处于新项目阶段，仓库尚未进入正式实现。技术方案终评已通过，但要求在编码前明确 MVP 壳层、测试基线、平台范围、时间戳命名和安装包策略，避免后续基建返工。

## 决策

1. MVP 桌面壳层采用 Electron，并在 Alpha 阶段保持架构稳定。
2. Alpha 仅支持 macOS；Windows/Linux 不进入当前 MVP 主线。Windows 预览前必须先通过 native Windows smoke gate，再进入预览打包路径。
3. 所有持久化的毫秒级时间戳统一使用 `*_at_ms` 命名。
4. Playwright Electron E2E 纳入 MVP 测试基线。
5. Alpha 阶段仅采用手动分发安装包，不启用自动更新。
6. 首个安装包形态优先为 DMG，ZIP 可选；Alpha 阶段不提供 Homebrew Cask。
7. 后续平台扩展目标保持明确：Windows 调研完成后支持 MSI，Linux 调研完成后支持压缩包解压或 DEB 形态。

## 决策依据

- Electron 是当前技术方案中对 Portal、CLI 子进程、Git worktree 和 React Canvas 兼容性最强、落地风险最低的壳层。
- macOS-only Alpha 可以把跨平台 PTY、打包和签名复杂度留到基线稳定之后再处理。
- Windows Runtime PoC 已验证 `main -> utilityProcess -> node-pty` 的未来路径可行，但也明确了 Windows 预览仍需 native Windows smoke gate，不能用 macOS 上的 probe 代替。
- `*_at_ms` 统一规范可以降低 SQLite schema、恢复逻辑和审计字段的歧义。
- Portal、BrowserWindow 与 `WebContentsView` 的关键行为必须通过真实 Electron E2E 验证。
- 现阶段没有自动更新诉求和分发预算，手动分发更符合 Alpha 成本与风险控制。

## 影响

### 正向影响

- 主线开发可围绕 Electron 稳定推进，不需要在 MVP 早期保留多壳层抽象。
- 测试、打包与发布范围更加清晰，执行计划可直接按 macOS Alpha 目标展开。
- 数据模型和 migration 规范统一，后续代码评审标准更容易落地。

### 约束与代价

- Windows/Linux 打包不进入当前 MVP 主线，只保留后续扩展路径；Windows 预览要先过 native Windows smoke gate。
- 自动更新不在 Alpha 范围内，发布体验依赖手动分发流程。
- 所有核心交付都必须通过 Playwright Electron E2E，测试投入会高于纯单测方案。

## 后续动作

1. 按 `docs/plans/2026-04-16-openweave-mvp-implementation-plan.md` 的 Task 4 起步搭建 Electron 工程壳。
2. 在 Task 12 中补齐 DMG 打包、手动分发清单和 GitHub Actions 打包工作流。
3. Windows 预览前先在 native Windows CI runner 上跑通 `utilityProcess + node-pty + PowerShell` smoke，并保留 `SystemRoot` 等环境透传。
4. 在 Windows smoke gate 通过后，再单独评估 Windows MSI 与 Linux 包格式实现路径。

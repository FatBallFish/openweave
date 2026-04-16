# ADR: Portal 安全边界与 Branch Workspace 复制边界

- 日期：2026-04-16
- 状态：Accepted
- 关联文档：`docs/plans/2026-04-16-openweave-decision-checklist.md`、`docs/tech-design/2026-04-15-openweave-tech-design-v1.md`

## 背景

Portal 是 OpenWeave MVP 中风险最高的模块之一，既涉及 `WebContentsView` 混排 PoC，也直接关系到 URL 安全边界、测试范围和 Branch Workspace 的数据隔离策略。如果这些边界不先固定，Portal MVP 和 Branch Workspace 实现会频繁返工。

## 决策

1. Portal 在 MVP 允许加载以下 URL：
   - `http://`
   - `https://`
   - `http://localhost`
   - `http://127.0.0.1`
2. Portal 在 MVP 明确拒绝 `file://`。
3. Branch Workspace 仅复制 Portal URL，不复制 cookies、登录态、截图或 portal session 数据。
4. Portal 的核心行为必须先通过独立 PoC，验证 live `WebContentsView`、bounds 同步、单活策略和截图降级，再进入正式产品集成。

## 决策依据

- 允许 `http/https/localhost/127.0.0.1` 可以覆盖远程页面、本地开发站点和最主要的验证场景。
- `file://` 会扩大本地文件暴露面和权限边界，不适合作为 MVP 默认能力。
- Branch Workspace 的目标是复制工作上下文，而不是复制浏览器会话；复制登录态会破坏 Workspace 隔离原则。
- Portal PoC 是纸面设计之外的关键工程验证点，不能直接跳过。

## 影响

### 正向影响

- Portal URL 校验规则可直接固化到 IPC schema、主进程校验和 E2E 用例中。
- Branch Workspace 的复制边界更清晰，便于实现和验收。
- Portal 相关安全面更可控，QA 测试矩阵更聚焦。

### 约束与代价

- 用户不能在 MVP 中直接加载本地 `file://` 页面。
- Branch Workspace 中若需要继续验证已登录页面，用户需要重新登录。
- Portal 集成必须受 PoC 结果约束，开发顺序不能任意前移。

## 后续动作

1. 在 PoC 阶段为允许/拒绝 URL 分别编写测试。
2. 在生产 Portal 模块中加入 `file://` 拒绝测试与错误提示。
3. 在 Branch Workspace 实现中显式排除 portal session、截图和运行态资产复制。

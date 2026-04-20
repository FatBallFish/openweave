# OpenWeave UI Workbench Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the OpenWeave renderer from a demo-like entry page into a production-grade AI engineer workbench with a bright-mode `Blueprint Canvas` shell, unified builtin component hosts, and faster workflow orchestration interactions.

**Architecture:** Keep Graph Schema V2, the current canvas store, and the builtin host registry as the product data spine, then layer a new workbench shell around them: left rail, contextual panel, top orchestration toolbar, center canvas, persistent inspector, and lower-right state island. Introduce a tokenized renderer styling foundation first, then move the shell, host chrome, builtin node surfaces, and canvas interactions onto that shared system so the implementation stays aligned with `@openweave-ui-design-system` and the approved design doc.

**Tech Stack:** Electron renderer, React 19, TypeScript, `@xyflow/react`, existing Graph V2 IPC/store, CSS variables + renderer-scoped style sheets, Vitest, Playwright Electron.

---

## References to review before touching code

- `docs/plans/2026-04-20-openweave-ui-workbench-redesign-design.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `src/renderer/App.tsx`
- `src/renderer/features/workspaces/WorkspaceListPage.tsx`
- `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- `src/renderer/features/canvas-shell/CanvasShell.tsx`
- `src/renderer/features/components/builtin-host-registry.tsx`
- `src/renderer/features/components/hosts/*`
- `src/renderer/features/runs/RunDrawer.tsx`
- `tests/unit/renderer/*.test.ts`
- `tests/e2e/app-launch.spec.ts`

## Hard constraints

1. 不要回退已完成的 V2 runtime / CLI / PTY 链路。
2. 继续以无限画布为中心，不要退回 dashboard-first 布局。
3. 明亮主题必须先落地，暗色先只做 token/state parity。
4. 所有 builtin 组件外层必须统一到一个 host frame，而不是继续各自散落地写样式。
5. `Note` 与 `Text` 的可编辑性语义必须强区分。
6. 交互可大胆对标 Maestri，但品牌语义必须保持 OpenWeave 的工程化气质。
7. 每个任务先补测试再改实现；只有测试证明需要时才扩范围。

### Task 1: 建立 renderer 级设计 token 与 workbench 基础样式

**Files:**
- Create: `src/renderer/styles/tokens.css`
- Create: `src/renderer/styles/workbench.css`
- Modify: `src/renderer/main.tsx`
- Modify: `src/renderer/App.tsx`
- Test: `tests/unit/renderer/app-shell.test.ts`
- Test: `tests/unit/renderer/static-components.test.ts`

**Step 1: Write the failing test**

```ts
it('renders the workbench shell root instead of the demo document shell', () => {
  const html = renderToStaticMarkup(createElement(App));
  expect(html).toContain('data-testid="workbench-shell"');
  expect(html).toContain('data-testid="workbench-topbar"');
  expect(html).not.toContain('Electron shell ready for MVP tasks.');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/app-shell.test.ts tests/unit/renderer/static-components.test.ts`
Expected: FAIL because `App` 仍然输出旧的 demo 文案，且没有 workbench shell 标记。

**Step 3: Write minimal implementation**

实现最小可用基础：

- 在 `src/renderer/styles/tokens.css` 定义 bright token、dark mapping token、字体和状态变量
- 在 `src/renderer/styles/workbench.css` 定义 app 背景、shell 网格、panel 基础样式、状态类
- 在 `src/renderer/main.tsx` 引入这两个样式文件
- 在 `src/renderer/App.tsx` 改为渲染 workbench root，保留现有 workspace/canvas 逻辑但停止输出旧 demo 标题副标题

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/app-shell.test.ts tests/unit/renderer/static-components.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/styles/tokens.css src/renderer/styles/workbench.css src/renderer/main.tsx src/renderer/App.tsx tests/unit/renderer/app-shell.test.ts tests/unit/renderer/static-components.test.ts
git commit -m "feat: add workbench renderer design tokens"
```

### Task 2: 搭建首页工作台骨架：左 rail、左 contextual panel、顶部工具栏、右 Inspector、右下状态岛

**Files:**
- Create: `src/renderer/features/workbench/WorkbenchShell.tsx`
- Create: `src/renderer/features/workbench/WorkbenchLeftRail.tsx`
- Create: `src/renderer/features/workbench/WorkbenchContextPanel.tsx`
- Create: `src/renderer/features/workbench/WorkbenchTopBar.tsx`
- Create: `src/renderer/features/workbench/WorkbenchInspector.tsx`
- Create: `src/renderer/features/workbench/WorkbenchStatusIsland.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/features/workspaces/WorkspaceListPage.tsx`
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Test: `tests/unit/renderer/workbench-shell.test.ts`
- Test: `tests/e2e/app-launch.spec.ts`

**Step 1: Write the failing test**

```ts
it('renders the approved workbench shell regions', () => {
  const html = renderToStaticMarkup(createElement(App));
  expect(html).toContain('data-testid="workbench-left-rail"');
  expect(html).toContain('data-testid="workbench-context-panel"');
  expect(html).toContain('data-testid="workbench-topbar"');
  expect(html).toContain('data-testid="workbench-inspector"');
  expect(html).toContain('data-testid="workbench-status-island"');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/workbench-shell.test.ts tests/e2e/app-launch.spec.ts`
Expected: FAIL because shell regions do not exist yet and the launch spec still looks for the old page shape.

**Step 3: Write minimal implementation**

实现：

- 创建 workbench shell 组件并接入 `App`
- 让 `WorkspaceListPage` 退化为左侧资源/工作区内容的一部分，而不是页面主体
- 让 `WorkspaceCanvasPage` 成为中心内容区
- 增加 persistent-but-collapsible Inspector 与 lower-right status island 占位实现
- 更新 `app-launch` E2E 断言到新的 shell 区域

**Step 4: Run test to verify it passes**

Run: `npm run build && npx playwright test tests/e2e/app-launch.spec.ts -c playwright.config.ts && npx vitest run tests/unit/renderer/workbench-shell.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/workbench src/renderer/App.tsx src/renderer/features/workspaces/WorkspaceListPage.tsx src/renderer/features/canvas/WorkspaceCanvasPage.tsx tests/unit/renderer/workbench-shell.test.ts tests/e2e/app-launch.spec.ts
git commit -m "feat: build workbench shell layout"
```

### Task 3: 重构顶部编排工具栏与左侧资源面板，让“编排动作优先、全局管理次一级”

**Files:**
- Modify: `src/renderer/features/workbench/WorkbenchTopBar.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchContextPanel.tsx`
- Modify: `src/renderer/features/canvas/nodes/NodeToolbar.tsx`
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Test: `tests/unit/renderer/static-components.test.ts`
- Create: `tests/unit/renderer/workbench-toolbar.test.ts`

**Step 1: Write the failing test**

```ts
it('puts orchestration actions before global management actions', () => {
  const html = renderToStaticMarkup(createElement(WorkbenchTopBar, props));
  const addTerminalIndex = html.indexOf('Add terminal');
  const commandPaletteIndex = html.indexOf('Command menu');
  const settingsIndex = html.indexOf('Settings');
  expect(addTerminalIndex).toBeGreaterThan(-1);
  expect(commandPaletteIndex).toBeGreaterThan(addTerminalIndex);
  expect(settingsIndex).toBeGreaterThan(commandPaletteIndex);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/static-components.test.ts tests/unit/renderer/workbench-toolbar.test.ts`
Expected: FAIL because the old toolbar is only a flat node button strip.

**Step 3: Write minimal implementation**

实现：

- 用新的 topbar 取代旧 `NodeToolbar` 主导地位
- 把 5 个 builtin create action 变成首屏可见主按钮
- 把 command palette / search / fit view / workspace utility 排到后部
- 左 contextual panel 默认展示 workspace + resources 混合信息，而不是仅列表

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/static-components.test.ts tests/unit/renderer/workbench-toolbar.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/workbench/WorkbenchTopBar.tsx src/renderer/features/workbench/WorkbenchContextPanel.tsx src/renderer/features/canvas/nodes/NodeToolbar.tsx src/renderer/features/canvas/WorkspaceCanvasPage.tsx tests/unit/renderer/workbench-toolbar.test.ts tests/unit/renderer/static-components.test.ts
git commit -m "feat: prioritize orchestration actions in top toolbar"
```

### Task 4: 将 canvas shell 提升为高保真工作台中心，并补一个轻量空状态

**Files:**
- Modify: `src/renderer/features/canvas-shell/CanvasShell.tsx`
- Create: `src/renderer/features/canvas-shell/CanvasEmptyState.tsx`
- Create: `src/renderer/features/canvas-shell/CanvasSelectionHud.tsx`
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Test: `tests/unit/renderer/canvas-shell.test.ts`
- Create: `tests/unit/renderer/canvas-empty-state.test.ts`

**Step 1: Write the failing test**

```ts
it('renders the real-work canvas chrome and the lightweight empty state', () => {
  const html = renderToStaticMarkup(createElement(CanvasShell, props));
  expect(html).toContain('data-testid="canvas-shell-grid"');
  expect(html).toContain('data-testid="canvas-shell-minimap"');
  expect(html).toContain('data-testid="canvas-selection-hud"');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/canvas-empty-state.test.ts`
Expected: FAIL because current canvas shell only wraps React Flow with a basic border and no product-state overlays.

**Step 3: Write minimal implementation**

实现：

- 增加工程纸感背景、HUD、状态提示、空状态组件
- 保持 React Flow / Graph V2 投影逻辑稳定
- 当图为空时渲染轻量空状态；有图时优先呈现真实工作态的 canvas chrome
- 为后续快捷键、群组、语义连线保留数据位和 UI 插槽

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/canvas-empty-state.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas-shell/CanvasShell.tsx src/renderer/features/canvas-shell/CanvasEmptyState.tsx src/renderer/features/canvas-shell/CanvasSelectionHud.tsx src/renderer/features/canvas/WorkspaceCanvasPage.tsx src/renderer/features/canvas/canvas.store.ts tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/canvas-empty-state.test.ts
git commit -m "feat: redesign canvas shell as workbench surface"
```

### Task 5: 为所有 builtin 组件建立统一 host frame，并重做 Note / Text 的信息表达

**Files:**
- Create: `src/renderer/features/components/host-shell/BuiltinNodeFrame.tsx`
- Create: `src/renderer/features/components/host-shell/BuiltinNodeHeader.tsx`
- Create: `src/renderer/features/components/host-shell/BuiltinNodeFooter.tsx`
- Create: `src/renderer/features/components/host-shell/node-state.ts`
- Modify: `src/renderer/features/components/builtin-host-registry.tsx`
- Modify: `src/renderer/features/components/hosts/NoteHost.tsx`
- Modify: `src/renderer/features/components/hosts/TextHost.tsx`
- Test: `tests/unit/renderer/builtin-hosts.test.ts`
- Create: `tests/unit/renderer/builtin-node-frame.test.ts`

**Step 1: Write the failing test**

```ts
it('renders note and text hosts inside the shared builtin node frame', () => {
  const noteHtml = renderHost(noteNode);
  const textHtml = renderHost(textNode);
  expect(noteHtml).toContain('data-testid="builtin-node-frame-node-note-1"');
  expect(textHtml).toContain('data-testid="builtin-node-frame-node-text-1"');
  expect(noteHtml).toContain('Editable markdown');
  expect(textHtml).toContain('Read-only text');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/builtin-node-frame.test.ts`
Expected: FAIL because hosts still render with unrelated card shells.

**Step 3: Write minimal implementation**

实现：

- 新建统一 outer host frame：header / body / footer strip
- 在 registry 保持按 `componentType` 分发，但统一外壳表达
- `NoteHost` 明确为可编辑 markdown 工作文档
- `TextHost` 明确为只读结果/证据面板，支持 copy / expand 占位能力

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/builtin-node-frame.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/components/host-shell src/renderer/features/components/builtin-host-registry.tsx src/renderer/features/components/hosts/NoteHost.tsx src/renderer/features/components/hosts/TextHost.tsx tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/builtin-node-frame.test.ts
git commit -m "feat: add shared builtin host frame for note and text"
```

### Task 6: 重做 Terminal，使其成为 AI 工程师工作流中的核心执行节点

**Files:**
- Modify: `src/renderer/features/components/hosts/TerminalHost.tsx`
- Modify: `src/renderer/features/runs/TerminalSessionPane.tsx`
- Modify: `src/renderer/features/runs/RunDrawer.tsx`
- Modify if needed: `src/renderer/features/components/host-shell/BuiltinNodeFrame.tsx`
- Test: `tests/unit/renderer/terminal-node.test.ts`
- Test: `tests/unit/renderer/terminal-session-pane.test.ts`
- Test: `tests/unit/renderer/builtin-hosts.test.ts`
- Test: `tests/e2e/terminal-run.spec.ts`

**Step 1: Write the failing test**

```ts
it('renders terminal host as a session-first execution node', () => {
  const html = renderHost(terminalNode);
  expect(html).toContain('Runtime');
  expect(html).toContain('Open run');
  expect(html).toContain('Session');
  expect(html).toContain('cwd');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts tests/unit/renderer/builtin-hosts.test.ts && npm run build && npx playwright test tests/e2e/terminal-run.spec.ts -c playwright.config.ts`
Expected: FAIL because the terminal surface still reads like a migrated node, not a product-grade session card.

**Step 3: Write minimal implementation**

实现：

- 在 terminal host header 中整合 runtime、session 状态、主要动作
- 在 body 中明确终端输出区与输入/控制区层级
- 在 footer strip 增加 cwd、最近 run、错误/运行态摘要
- 保持现有 runtime / PTY / run 打开行为不变，只提升表达和操作效率

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts tests/unit/renderer/builtin-hosts.test.ts && npm run build && npx playwright test tests/e2e/terminal-run.spec.ts -c playwright.config.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/components/hosts/TerminalHost.tsx src/renderer/features/runs/TerminalSessionPane.tsx src/renderer/features/runs/RunDrawer.tsx tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts tests/unit/renderer/builtin-hosts.test.ts tests/e2e/terminal-run.spec.ts
git commit -m "feat: redesign terminal host as session-first node"
```

### Task 7: 重做 File Tree 与 Portal，使上下文组件更紧凑、更可用、更产品化

**Files:**
- Modify: `src/renderer/features/components/hosts/FileTreeHost.tsx`
- Modify: `src/renderer/features/components/hosts/PortalHost.tsx`
- Modify: `src/renderer/features/git/GitPanel.tsx`
- Modify: `src/renderer/features/portal/PortalToolbar.tsx`
- Test: `tests/unit/renderer/builtin-hosts.test.ts`
- Test: `tests/unit/renderer/static-components.test.ts`
- Test: `tests/e2e/file-tree.spec.ts`
- Test: `tests/e2e/portal-node.spec.ts`

**Step 1: Write the failing test**

```ts
it('renders compact product-grade file-tree and portal controls inside the shared host frame', () => {
  const fileTreeHtml = renderHost(fileTreeNode);
  const portalHtml = renderHost(portalNode);
  expect(fileTreeHtml).toContain('Workspace root');
  expect(fileTreeHtml).toContain('Branch workspace');
  expect(portalHtml).toContain('Open page');
  expect(portalHtml).toContain('Read structure');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/static-components.test.ts && npm run build && npx playwright test tests/e2e/file-tree.spec.ts tests/e2e/portal-node.spec.ts -c playwright.config.ts`
Expected: FAIL because these surfaces still follow demo-like spacing and control density.

**Step 3: Write minimal implementation**

实现：

- `FileTreeHost` 提升 root identity、git summary、branch action 与树行密度
- `PortalHost` 强化 URL/header、预览 viewport 和关键动作区
- 复用统一 node frame，不为单个组件引入另一套视觉语言
- 保持现有 IPC 行为和 bridge 语义不变

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/static-components.test.ts && npm run build && npx playwright test tests/e2e/file-tree.spec.ts tests/e2e/portal-node.spec.ts -c playwright.config.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/components/hosts/FileTreeHost.tsx src/renderer/features/components/hosts/PortalHost.tsx src/renderer/features/git/GitPanel.tsx src/renderer/features/portal/PortalToolbar.tsx tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/static-components.test.ts tests/e2e/file-tree.spec.ts tests/e2e/portal-node.spec.ts
git commit -m "feat: redesign file tree and portal hosts"
```

### Task 8: 重构编排交互逻辑：快捷创建、命令面板、Inspector 控制面、状态映射

**Files:**
- Create: `src/renderer/features/workbench/CommandPalette.tsx`
- Create: `src/renderer/features/canvas-shell/useCanvasShortcuts.ts`
- Modify: `src/renderer/features/canvas-shell/CanvasShell.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchInspector.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchStatusIsland.tsx`
- Modify if needed: `src/renderer/features/canvas/canvas.store.ts`
- Test: `tests/unit/renderer/canvas-shell.test.ts`
- Create: `tests/unit/renderer/command-palette.test.ts`
- Create: `tests/unit/renderer/inspector-panel.test.ts`

**Step 1: Write the failing test**

```ts
it('supports command palette and inspector shortcuts for workflow composition', () => {
  const html = renderToStaticMarkup(createElement(CanvasShell, props));
  expect(html).toContain('data-testid="command-palette-trigger"');
  expect(html).toContain('data-testid="inspector-toggle"');
  expect(html).toContain('data-testid="status-island-events"');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/command-palette.test.ts tests/unit/renderer/inspector-panel.test.ts`
Expected: FAIL because the current flow has no command palette or inspector-driven orchestration controls.

**Step 3: Write minimal implementation**

实现：

- 增加 `Cmd/Ctrl+K` 命令面板和 `/` 快速创建入口
- 为 Inspector 增加选中节点摘要、参数入口、连接摘要和快捷动作
- 让 status island 显示 run/event/task 三类状态映射
- 在不破坏现有 Graph V2 / host 渲染的前提下补键盘与交互层

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/command-palette.test.ts tests/unit/renderer/inspector-panel.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/workbench/CommandPalette.tsx src/renderer/features/canvas-shell/useCanvasShortcuts.ts src/renderer/features/canvas-shell/CanvasShell.tsx src/renderer/features/workbench/WorkbenchInspector.tsx src/renderer/features/workbench/WorkbenchStatusIsland.tsx src/renderer/features/canvas/canvas.store.ts tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/command-palette.test.ts tests/unit/renderer/inspector-panel.test.ts
git commit -m "feat: add orchestration shortcuts and inspector controls"
```

### Task 9: 收尾校验明亮主稿与暗色 token/state parity，并完成回归验证

**Files:**
- Modify if needed: `src/renderer/styles/tokens.css`
- Modify if needed: `src/renderer/styles/workbench.css`
- Modify if needed: `tests/unit/renderer/*.test.ts`
- Modify if needed: `tests/e2e/app-launch.spec.ts`
- Modify if needed: `tests/e2e/smoke-alpha.spec.ts`

**Step 1: Write the failing test**

```ts
it('exposes bright tokens and dark parity tokens for shell states', () => {
  const css = readFileSync('src/renderer/styles/tokens.css', 'utf8');
  expect(css).toContain('--ow-color-bg-app');
  expect(css).toContain('--ow-dark-color-bg-app');
  expect(css).toContain('--ow-state-running');
  expect(css).toContain('--ow-dark-state-running');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/app-shell.test.ts tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/builtin-hosts.test.ts`
Expected: FAIL if any final token/state mapping or shell semantics drifted during the refactor.

**Step 3: Write minimal implementation**

实现：

- 补齐 bright/dark token parity
- 统一 shell、host、inspector、status island 的状态颜色使用
- 清理无效占位样式与重复内联样式
- 确保 app 启动、canvas shell、builtin hosts 的关键测试覆盖仍成立

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/app-shell.test.ts tests/unit/renderer/workbench-shell.test.ts tests/unit/renderer/workbench-toolbar.test.ts tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/canvas-empty-state.test.ts tests/unit/renderer/builtin-node-frame.test.ts tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts tests/unit/renderer/command-palette.test.ts tests/unit/renderer/inspector-panel.test.ts tests/unit/renderer/static-components.test.ts && npm run build && npx playwright test tests/e2e/app-launch.spec.ts tests/e2e/terminal-run.spec.ts tests/e2e/file-tree.spec.ts tests/e2e/portal-node.spec.ts -c playwright.config.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/styles/tokens.css src/renderer/styles/workbench.css tests/unit/renderer tests/e2e/app-launch.spec.ts tests/e2e/terminal-run.spec.ts tests/e2e/file-tree.spec.ts tests/e2e/portal-node.spec.ts
git commit -m "feat: finalize openweave workbench ui redesign"
```

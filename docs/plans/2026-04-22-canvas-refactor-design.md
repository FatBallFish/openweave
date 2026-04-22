---
name: Canvas Refactor Design
description: 无限画布重构设计文档 - 触控板/鼠标手势优化、节点样式改进、resize手柄
type: project
---

# 无限画布重构设计

## 背景

当前无限画布基于 `@xyflow/react` v12 构建，存在以下问题：
1. 触控板双指平移被错误解析为缩放
2. 鼠标滚轮缩放方向不符合直觉
3. 节点有一层淡灰色背景矩形框
4. Canvas 四周有圆角，未铺满窗体
5. 点格背景不够清晰
6. 选中组件后没有显眼的虚线框和 resize 手柄

## 目标

优化 Canvas 的交互体验和视觉表现，使其在触控板和鼠标环境下都能提供自然的平移/缩放体验，同时提升节点选中态和背景网格的可视性。

## 方案

### 1. 触控板手势兼容

**当前配置**（`CanvasShell.tsx`）：
- `panOnDrag={true}` — 左键拖动平移
- `zoomOnPinch={true}` — 双指缩放
- `zoomOnScroll={true}` — 滚轮/触控板滚动触发缩放
- `selectionOnDrag={false}` — Shift+拖动不触发选择框

**修改方案**：
- 禁用 `zoomOnScroll`，改用自定义 `onWheel` 处理器区分输入来源
- 启用 `panOnScroll={true}` 让 ReactFlow 原生处理触控板双指平移
- `panOnDrag` 保持 `true`（左键拖动平移）
- `zoomOnPinch` 保持 `true`（双指缩放）
- `selectionOnDrag` 改为 `true`（Shift+拖动画选择框）
- 将 `panOnDrag` 从 `true` 改为 `[1]`（仅左键），这样空格键不再触发自带平移（因为双指平移已满足需求）

**自定义 `onWheel` 处理器**：
- 通过 `event.ctrlKey` + `event.deltaY` 模式检测触控板 pinch（浏览器标准行为）
- 通过 `event.deltaMode` 或 `Math.abs(event.deltaX) < Math.abs(event.deltaY)` 检测鼠标滚轮
- 鼠标滚轮：调用 `zoomIn()`/`zoomOut()`，以鼠标位置为中心
- 触控板双指平移：由 `panOnScroll={true}` 接管，不做额外处理

### 2. 鼠标滚轮缩放

**方案**：
- 鼠标滚轮 **向上滚动**（`deltaY < 0`）：以鼠标指针位置为中心 **缩小**（zoom out）
- 鼠标滚轮 **向下滚动**（`deltaY > 0`）：以鼠标指针位置为中心 **放大**（zoom in）
- 实现方式：在 `onWheel` 中调用 `reactFlowInstance.zoomIn/zoomOut` 并传入 `{ duration: 100 }` 平滑过渡

### 3. 移除节点默认淡灰色背景

**当前样式**（`workbench.css` 第 952 行）：
```css
.ow-builtin-node-frame {
  background: linear-gradient(180deg, rgba(var(--ow-surface-rgb), 0.94), rgba(var(--ow-surface-rgb), 0.82));
}
```

**修改**：将 `.ow-builtin-node-frame` 的 `background` 改为 `transparent`。保留 border、box-shadow 等其他样式不变。

### 4. 去除 Canvas 圆角，铺满窗体

**当前样式**（`workbench.css` 第 639-645 行）：
```css
.ow-canvas-shell__flow {
  border-radius: 18px;
}
```

**修改**：将基础样式的 `border-radius` 设为 `0`。已有 `@media` 覆盖样式设置为 `0`，但基础样式保留了 `18px`，导致不一致。统一改为 `0`。

### 5. 点格背景改为网格线背景

**当前**：`<Background gap={24} size={1} />` 生成点状背景。

**修改**：替换为 `<Background gap={24} variant="lines" />`。通过 CSS 调整 `.react-flow__background` 的 `opacity` 和线条颜色，使其更清晰可见。

### 6. 选中组件虚线框 + Resize 手柄

**虚线框**：
- 为 `.react-flow__node.selected .ow-builtin-node-frame` 添加 `outline: 2px dashed rgba(var(--ow-accent-rgb), 0.72)` 和 `outline-offset: 4px`
- 这样比修改 `border` 更安全，不会影响节点内部布局

**Resize 手柄**：
- 使用 ReactFlow v12 内置的 `NodeResizeControl` 组件
- 在 `BuiltinHostFlowNode` 中条件渲染：仅当节点处于 `selected` 状态时显示
- 手柄配置为 8 方向（4 角 + 4 边），样式为 8x8px 小方块
- `onResize` 回调更新节点的 `width`/`height`，通过 `canvasStore` 的 `updateNodeBounds` 方法持久化
- 需要新增 `updateNodeBounds` 方法到 `canvasStore`

## 影响范围

| 文件 | 修改类型 |
|---|---|
| `src/renderer/features/canvas-shell/CanvasShell.tsx` | 修改：ReactFlow props、自定义 onWheel、NodeResizeControl |
| `src/renderer/features/canvas/canvas.store.ts` | 新增：`updateNodeBounds` 方法 |
| `src/renderer/styles/workbench.css` | 修改：节点背景、Canvas 圆角、选中态虚线框、背景网格样式 |
| `src/renderer/features/canvas/nodes/NodeToolbar.tsx` | 可选：移除空格键平移提示 |

## 测试要点

1. macOS 妙控板双指平移画布是否流畅
2. 妙控板双指缩放是否正常
3. 鼠标滚轮缩放方向是否符合预期
4. Shift+拖动是否画出选择框
5. 节点背景是否透明
6. Canvas 是否铺满无圆角
7. 网格线是否清晰可见
8. 选中节点是否有虚线框
9. 虚线框上是否有 resize 手柄
10. resize 后节点尺寸是否正确持久化

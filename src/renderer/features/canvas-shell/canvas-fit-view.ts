import type { Node } from '@xyflow/react';
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from './canvas-viewport-limits';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function getNodeRects(nodes: Node[]): Rect[] {
  return nodes.map((node) => {
    const width =
      (node as any).measured?.width ??
      node.width ??
      (node.style?.width as number) ??
      200;
    const height =
      (node as any).measured?.height ??
      node.height ??
      (node.style?.height as number) ??
      100;
    return {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + width,
      bottom: node.position.y + height,
    };
  });
}

function filterByIQR(values: number[]): boolean[] {
  if (values.length < 4) return values.map(() => true);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.map((v) => v >= lower && v <= upper);
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * 根据画布节点计算一个能展示绝大多数组件的视口。
 * 使用 IQR 方法过滤离群节点，避免个别远离中心的节点导致整体缩放过小。
 */
export function computeSmartFitViewport(
  nodes: Node[],
  containerWidth: number,
  containerHeight: number
): Viewport | null {
  if (nodes.length === 0) return null;

  const rects = getNodeRects(nodes);

  const centers = rects.map((r) => ({
    x: (r.left + r.right) / 2,
    y: (r.top + r.bottom) / 2,
  }));

  const xValid = filterByIQR(centers.map((c) => c.x));
  const yValid = filterByIQR(centers.map((c) => c.y));
  let valid = rects.map((_, i) => xValid[i] && yValid[i]);

  const validCount = valid.filter(Boolean).length;
  if (validCount < Math.max(1, nodes.length * 0.5)) {
    valid = rects.map(() => true);
  }

  const filtered = rects.filter((_, i) => valid[i]);

  const minX = Math.min(...filtered.map((r) => r.left));
  const maxX = Math.max(...filtered.map((r) => r.right));
  const minY = Math.min(...filtered.map((r) => r.top));
  const maxY = Math.max(...filtered.map((r) => r.bottom));

  const contentWidth = Math.max(maxX - minX, 1);
  const contentHeight = Math.max(maxY - minY, 1);

  const padding = 0.15;
  const paddedWidth = contentWidth * (1 + padding * 2);
  const paddedHeight = contentHeight * (1 + padding * 2);

  const zoomX = containerWidth / paddedWidth;
  const zoomY = containerHeight / paddedHeight;
  const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(zoomX, zoomY, Math.min(MAX_CANVAS_ZOOM, 1.5)));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const x = containerWidth / 2 - centerX * zoom;
  const y = containerHeight / 2 - centerY * zoom;

  return { x, y, zoom };
}

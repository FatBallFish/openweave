import { useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';

interface ConnectModeOverlayProps {
  sourceNodeId: string | null;
  graphNodes: Array<{ id: string; componentType: string; bounds: { x: number; y: number; width: number; height: number } }>;
}

export const ConnectModeOverlay = ({
  sourceNodeId,
  graphNodes
}: ConnectModeOverlayProps): JSX.Element => {
  const { getViewport } = useReactFlow();
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const sourceBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const getNodeCenter = (bounds: { x: number; y: number; width: number; height: number }) => {
    const { x, y, zoom } = getViewport();
    return {
      x: (bounds.x + bounds.width / 2) * zoom + x,
      y: (bounds.y + bounds.height / 2) * zoom + y
    };
  };

  useEffect(() => {
    if (sourceNodeId) {
      const node = graphNodes.find((n) => n.id === sourceNodeId);
      if (node) {
        sourceBoundsRef.current = node.bounds;
      }
    } else {
      sourceBoundsRef.current = null;
      setMousePos(null);
    }
  }, [sourceNodeId, graphNodes]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!sourceNodeId) return;
      const container = document.querySelector('.ow-canvas-shell__flow');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [sourceNodeId, getViewport]);

  if (!sourceNodeId || !mousePos || !sourceBoundsRef.current) return null;

  const sourceCenter = getNodeCenter(sourceBoundsRef.current);

  return (
    <svg
      className="ow-connect-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000
      }}
    >
      <line
        x1={sourceCenter.x}
        y1={sourceCenter.y}
        x2={mousePos.x}
        y2={mousePos.y}
        stroke="var(--ow-color-accent)"
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
        opacity={0.7}
      />
      <circle
        cx={mousePos.x}
        cy={mousePos.y}
        r={5}
        fill="var(--ow-color-accent)"
        opacity={0.5}
      />
    </svg>
  );
};

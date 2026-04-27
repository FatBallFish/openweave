import { useEffect, useRef, useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { getBuiltinComponentManifest } from '../../../shared/components/builtin-manifests';

interface ConnectModeOverlayProps {
  sourceNodeId: string | null;
  workspaceId: string;
  graphNodes: Array<{ id: string; componentType: string; bounds: { x: number; y: number; width: number; height: number } }>;
  onSelectSource: (nodeId: string) => void;
  onCompleteConnection: (sourceId: string, targetId: string) => void;
}

export const ConnectModeOverlay = ({
  sourceNodeId,
  workspaceId,
  graphNodes,
  onSelectSource,
  onCompleteConnection
}: ConnectModeOverlayProps): JSX.Element => {
  const { getViewport } = useReactFlow();
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const sourceBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const getNodeCenter = (bounds: { x: number; y: number; width: number; height: number }) => ({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  });

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
      const { x: vpX, y: vpY, zoom } = getViewport();
      const worldX = (e.clientX - rect.left - vpX) / zoom;
      const worldY = (e.clientY - rect.top - vpY) / zoom;
      setMousePos({ x: worldX, y: worldY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [sourceNodeId, getViewport]);

  const isNodeConnectable = useCallback((componentType: string): boolean => {
    const manifest = getBuiltinComponentManifest(componentType);
    if (!manifest) return false;
    return manifest.node.connectable !== false;
  }, []);

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

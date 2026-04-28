import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

interface ConnectEdgeData {
  isActive?: boolean;
}

type ConnectEdgeProps = EdgeProps & {
  data?: ConnectEdgeData;
};

export const ConnectEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data
}: ConnectEdgeProps): JSX.Element => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.28
  });

  const isActive = data?.isActive ?? false;

  const strokeColor = isActive
    ? 'var(--ow-state-running)'
    : selected
      ? 'var(--ow-color-accent)'
      : '#8398af';

  const strokeWidth = selected ? 3 : 2.2;
  const dashArray = '7 5';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          transition: 'stroke 200ms ease, stroke-width 200ms ease'
        }}
      />
      {/* Wider invisible hit area for easier click selection */}
      <BaseEdge
        id={`${id}-hit`}
        path={edgePath}
        style={{
          stroke: 'transparent',
          strokeWidth: 14,
          fill: 'none'
        }}
      />
      {isActive && (
        <EdgeLabelRenderer>
          <div
            className="ow-connect-edge__glow"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none'
            }}
          >
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <filter id={`edge-glow-${id}`}>
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          </div>
        </EdgeLabelRenderer>
      )}
      <path
        d={edgePath}
        fill="none"
        stroke={isActive ? 'var(--ow-state-running)' : 'transparent'}
        strokeWidth={isActive ? 3.4 : 0}
        strokeDasharray={isActive ? '8 6' : '0'}
        strokeLinecap="round"
        style={{
          animation: isActive ? 'edgeFlow 1.4s linear infinite' : 'none',
          filter: isActive ? `url(#edge-glow-${id})` : 'none',
          pointerEvents: 'none'
        }}
      />
    </>
  );
};

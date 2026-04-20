interface CanvasSelectionHudProps {
  nodeCount: number;
  edgeCount: number;
}

export const CanvasSelectionHud = ({ nodeCount, edgeCount }: CanvasSelectionHudProps): JSX.Element => {
  return (
    <div className="ow-canvas-selection-hud" data-testid="canvas-selection-hud">
      <div>
        <span>Nodes</span>
        <strong>{nodeCount}</strong>
      </div>
      <div>
        <span>Edges</span>
        <strong>{edgeCount}</strong>
      </div>
      <div>
        <span>Mode</span>
        <strong>Compose</strong>
      </div>
    </div>
  );
};

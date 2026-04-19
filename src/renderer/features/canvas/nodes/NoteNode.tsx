import type { NoteNodeInput } from '../../../../shared/ipc/schemas';

interface NoteNodeProps {
  node: NoteNodeInput;
  onChange: (patch: Partial<Pick<NoteNodeInput, 'x' | 'y' | 'contentMd'>>) => void;
}

const parseNumberOrUndefined = (value: string): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
};

export const NoteNode = ({ node, onChange }: NoteNodeProps): JSX.Element => {
  return (
    <article
      data-testid={`note-node-${node.id}`}
      style={{
        border: '1px solid #d0d7e2',
        borderRadius: '8px',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        minWidth: 0,
        overflow: 'auto',
        padding: '12px',
        display: 'grid',
        gap: '8px'
      }}
    >
      <label style={{ display: 'grid', gap: '4px' }}>
        Markdown
        <textarea
          data-testid={`note-node-content-${node.id}`}
          onChange={(event) => onChange({ contentMd: event.currentTarget.value })}
          rows={5}
          value={node.contentMd}
        />
      </label>

      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ display: 'grid', gap: '4px' }}>
          X
          <input
            data-testid={`note-node-x-${node.id}`}
            onChange={(event) => {
              const nextX = parseNumberOrUndefined(event.currentTarget.value);
              if (nextX !== undefined) {
                onChange({ x: nextX });
              }
            }}
            type="number"
            value={node.x}
          />
        </label>

        <label style={{ display: 'grid', gap: '4px' }}>
          Y
          <input
            data-testid={`note-node-y-${node.id}`}
            onChange={(event) => {
              const nextY = parseNumberOrUndefined(event.currentTarget.value);
              if (nextY !== undefined) {
                onChange({ y: nextY });
              }
            }}
            type="number"
            value={node.y}
          />
        </label>
      </div>
    </article>
  );
};

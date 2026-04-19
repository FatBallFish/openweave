import type { BuiltinHostProps } from './types';

export const UnsupportedBuiltinHost = ({ node }: BuiltinHostProps): JSX.Element => {
  return (
    <article
      data-testid={`unsupported-host-${node.id}`}
      style={{
        border: '1px dashed #d92d20',
        borderRadius: '8px',
        padding: '12px',
        backgroundColor: '#fff5f5'
      }}
    >
      <strong>Unsupported component</strong>
      <p style={{ marginBottom: 0 }}>{node.componentType}</p>
    </article>
  );
};

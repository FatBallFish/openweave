import type { BuiltinHostProps } from './types';

export const TextHost = ({ node }: BuiltinHostProps): JSX.Element => {
  const content = typeof node.state.content === 'string' ? node.state.content : '';

  return (
    <article
      data-testid={`text-host-${node.id}`}
      style={{
        border: '1px solid #528bff',
        borderRadius: '8px',
        padding: '12px',
        backgroundColor: '#eef4ff'
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>{node.title}</h3>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{content || '(empty text)'}</pre>
    </article>
  );
};

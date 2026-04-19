import type { BuiltinHostProps } from './types';

interface AttachmentRecord {
  id: string;
  name: string;
  path: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

const toAttachmentName = (value: string): string => {
  const segments = value.split(/[\\/]/);
  return segments[segments.length - 1] || value;
};

const normalizeAttachments = (value: unknown): AttachmentRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate, index) => {
    const record =
      candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
    const path = typeof record.path === 'string' ? record.path : '';
    if (path === '') {
      return [];
    }

    return [
      {
        id: typeof record.id === 'string' ? record.id : `attachment-${index + 1}`,
        name:
          typeof record.name === 'string' && record.name !== ''
            ? record.name
            : toAttachmentName(path),
        path,
        mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
        sizeBytes:
          typeof record.sizeBytes === 'number' && Number.isFinite(record.sizeBytes)
            ? record.sizeBytes
            : null
      }
    ];
  });
};

export const AttachmentHost = ({ node }: BuiltinHostProps): JSX.Element => {
  const attachments = normalizeAttachments(node.state.attachments);

  return (
    <article
      data-testid={`attachment-host-${node.id}`}
      style={{
        border: '1px solid #f79009',
        borderRadius: '8px',
        padding: '12px',
        backgroundColor: '#fffaeb'
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>{node.title}</h3>
      {attachments.length === 0 ? (
        <p style={{ margin: 0 }}>(no attachments)</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              {attachment.name}
              {attachment.sizeBytes !== null ? ` (${attachment.sizeBytes} bytes)` : ''}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

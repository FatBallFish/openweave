import { FormEvent, useEffect, useState } from 'react';
import type { WorkspaceCreateInput } from '../../../shared/ipc/schemas';

interface CreateWorkspaceDialogProps {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onCreate: (input: WorkspaceCreateInput) => Promise<void>;
}

export const CreateWorkspaceDialog = ({
  open,
  loading,
  onCancel,
  onCreate
}: CreateWorkspaceDialogProps): JSX.Element | null => {
  const [name, setName] = useState('');
  const [rootDir, setRootDir] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setRootDir('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await onCreate({
      name: name.trim(),
      rootDir: rootDir.trim()
    });
  };

  return (
    <section
      aria-label="Create workspace"
      data-testid="create-workspace-dialog"
      style={{
        border: '1px solid #cfd8e3',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        background: '#f7f9fc'
      }}
    >
      <h2 style={{ marginTop: 0 }}>Create workspace</h2>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label style={{ display: 'block', marginBottom: '12px' }}>
          Name
          <input
            data-testid="create-workspace-name-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={1}
            style={{ display: 'block', width: '100%', marginTop: '6px' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          Root directory
          <input
            data-testid="create-workspace-root-input"
            type="text"
            value={rootDir}
            onChange={(event) => setRootDir(event.target.value)}
            required
            minLength={1}
            style={{ display: 'block', width: '100%', marginTop: '6px' }}
          />
        </label>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button data-testid="create-workspace-submit" type="submit" disabled={loading}>
            Create
          </button>
          <button
            data-testid="create-workspace-cancel"
            type="button"
            disabled={loading}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
};

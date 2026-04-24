import { FormEvent, useEffect, useState } from 'react';
import type { WorkspaceRecord } from '../../../shared/ipc/contracts';
import type { WorkspaceBranchCreateInput } from '../../../shared/ipc/schemas';

interface BranchWorkspaceDialogProps {
  open: boolean;
  loading: boolean;
  sourceWorkspace: WorkspaceRecord | null;
  onCancel: () => void;
  onCreate: (input: WorkspaceBranchCreateInput) => Promise<void>;
}

export const BranchWorkspaceDialog = ({
  open,
  loading,
  sourceWorkspace,
  onCancel,
  onCreate
}: BranchWorkspaceDialogProps): JSX.Element | null => {
  const [branchName, setBranchName] = useState('feature/demo');
  const [copyCanvas, setCopyCanvas] = useState(true);

  useEffect(() => {
    if (open) {
      setBranchName('feature/demo');
      setCopyCanvas(true);
    }
  }, [open, sourceWorkspace?.id]);

  if (!open || !sourceWorkspace) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await onCreate({
      sourceWorkspaceId: sourceWorkspace.id,
      branchName: branchName.trim(),
      copyCanvas
    });
  };

  return (
    <section
      aria-label="Create branch workspace"
      data-testid="branch-workspace-dialog"
      style={{
        border: '1px solid #cfd8e3',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        background: '#f7f9fc'
      }}
    >
      <h2 style={{ marginTop: 0 }}>Create branch workspace</h2>
      <p data-testid="branch-workspace-source" style={{ marginTop: 0 }}>
        Source workspace: {sourceWorkspace.name}
      </p>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            const target = e.target as HTMLElement;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
              e.preventDefault();
              target.select();
            }
          }
        }}
      >
        <label style={{ display: 'block', marginBottom: '12px' }}>
          Branch name
          <input
            data-testid="branch-workspace-branch-input"
            type="text"
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            required
            minLength={1}
            style={{ display: 'block', width: '100%', marginTop: '6px' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <input
            data-testid="branch-workspace-copy-canvas"
            checked={copyCanvas}
            onChange={(event) => setCopyCanvas(event.currentTarget.checked)}
            type="checkbox"
          />
          Copy canvas layout from source workspace
        </label>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button data-testid="branch-workspace-submit" type="submit" disabled={loading}>
            Create branch workspace
          </button>
          <button
            data-testid="branch-workspace-cancel"
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

import { useEffect, useRef, useState } from 'react';
import { GitPanel } from '../../git/GitPanel';
import type {
  FileTreeEntryRecord,
  FileTreeLoadResponse,
  OpenWeaveShellBridge
} from '../../../../shared/ipc/contracts';
import type { FileTreeNodeInput } from '../../../../shared/ipc/schemas';

interface FileTreeNodeProps {
  workspaceId: string;
  node: FileTreeNodeInput;
  onChange: (patch: Partial<Pick<FileTreeNodeInput, 'x' | 'y'>>) => void;
  onCreateBranchWorkspace?: () => void;
}

const getFilesBridge = (): OpenWeaveShellBridge['files'] => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell.files;
};

const formatEntry = (entry: FileTreeEntryRecord): string => {
  const status = entry.gitStatus ? `[${entry.gitStatus}] ` : '';
  const suffix = entry.kind === 'directory' ? '/' : '';
  return `${status}${entry.path}${suffix}`;
};

const emptyTreeState = (): FileTreeLoadResponse => ({
  rootDir: '',
  readOnly: true,
  isGitRepo: false,
  gitSummary: {
    modified: 0,
    added: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    unmerged: 0,
    untracked: 0,
    ignored: 0
  },
  entries: []
});

const MAX_RENDERED_ENTRIES = 120;

export const FileTreeNode = ({
  workspaceId,
  node,
  onCreateBranchWorkspace
}: FileTreeNodeProps): JSX.Element => {
  const [tree, setTree] = useState<FileTreeLoadResponse>(emptyTreeState);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

  const loadTree = (rootDir: string): Promise<void> => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setLoading(true);
    setErrorMessage(null);

    return getFilesBridge()
      .loadFileTree({
        workspaceId,
        rootDir
      })
      .then((response) => {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        setTree(response);
      })
      .catch((error) => {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load file tree';
        setErrorMessage(message);
      })
      .finally(() => {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    void loadTree(node.rootDir);
  }, [node.rootDir, workspaceId]);

  return (
    <section className="ow-file-tree-node" data-testid={`file-tree-node-${node.id}`}>
      <div className="ow-file-tree-node__root-card">
        <span className="ow-file-tree-node__label">Workspace root</span>
        <p data-testid={`file-tree-root-${node.id}`}>{node.rootDir}</p>
      </div>

      <div className="ow-file-tree-node__actions">
        <div className="ow-file-tree-node__action-buttons">
          <button
            className="nodrag nopan"
            data-testid={`file-tree-refresh-${node.id}`}
            disabled={loading}
            onClick={() => {
              void loadTree(node.rootDir);
            }}
            type="button"
          >
            Refresh
          </button>
          {onCreateBranchWorkspace ? (
            <button
              className="nodrag nopan"
              data-testid={`file-tree-branch-workspace-${node.id}`}
              disabled={loading}
              onClick={onCreateBranchWorkspace}
              type="button"
            >
              Branch workspace
            </button>
          ) : null}
        </div>
        <span>{loading ? 'Refreshing tree' : 'Repo context synced'}</span>
      </div>

      <GitPanel
        nodeId={node.id}
        isGitRepo={tree.isGitRepo}
        readOnly={tree.readOnly}
        summary={tree.gitSummary}
        onCreateBranchWorkspace={onCreateBranchWorkspace}
        canCreateBranchWorkspace={!loading}
      />

      {errorMessage ? (
        <p className="ow-file-tree-node__error" data-testid={`file-tree-error-${node.id}`}>
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="ow-file-tree-node__loading" data-testid={`file-tree-loading-${node.id}`}>
          Loading file tree...
        </p>
      ) : (
        <ul className="ow-file-tree-node__list" data-testid={`file-tree-node-list-${node.id}`}>
          {tree.entries.length === 0 ? (
            <li>(empty)</li>
          ) : (
            tree.entries.slice(0, MAX_RENDERED_ENTRIES).map((entry) => (
              <li
                data-testid={`file-tree-entry-${node.id}-${entry.path.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                key={`${entry.kind}:${entry.path}`}
              >
                {formatEntry(entry)}
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
};

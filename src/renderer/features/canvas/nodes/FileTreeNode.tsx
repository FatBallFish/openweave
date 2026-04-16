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

const parseNumberOrUndefined = (value: string): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
};

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
  onChange,
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
    <article
      data-testid={`file-tree-node-${node.id}`}
      style={{
        border: '1px solid #12b76a',
        borderRadius: '8px',
        padding: '12px',
        display: 'grid',
        gap: '8px',
        backgroundColor: '#ecfdf3'
      }}
    >
      <h3 style={{ margin: 0 }}>File tree</h3>
      <p data-testid={`file-tree-root-${node.id}`} style={{ margin: 0, color: '#344054' }}>
        Root: {node.rootDir}
      </p>

      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ display: 'grid', gap: '4px' }}>
          X
          <input
            data-testid={`file-tree-node-x-${node.id}`}
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
            data-testid={`file-tree-node-y-${node.id}`}
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
        <button
          data-testid={`file-tree-refresh-${node.id}`}
          disabled={loading}
          onClick={() => {
            void loadTree(node.rootDir);
          }}
          style={{ alignSelf: 'end' }}
          type="button"
        >
          Refresh
        </button>
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
        <p data-testid={`file-tree-error-${node.id}`} style={{ color: '#b42318', margin: 0 }}>
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p data-testid={`file-tree-loading-${node.id}`} style={{ margin: 0 }}>
          Loading file tree...
        </p>
      ) : (
        <ul data-testid={`file-tree-node-list-${node.id}`} style={{ margin: 0, paddingLeft: '18px' }}>
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
    </article>
  );
};

import { canvasStore } from '../../canvas/canvas.store';
import { FileTreeNode } from '../../canvas/nodes/FileTreeNode';
import { BuiltinNodeFrame } from '../host-shell/BuiltinNodeFrame';
import { getBuiltinNodeStateLabel, resolveBuiltinNodeState } from '../host-shell/node-state';
import type { BuiltinHostProps } from './types';

export const FileTreeHost = ({
  workspaceId,
  workspaceRootDir,
  node,
  onCreateBranchWorkspace
}: BuiltinHostProps): JSX.Element => {
  const state = resolveBuiltinNodeState(node);
  const rootDir = typeof node.config.rootDir === 'string' ? node.config.rootDir : workspaceRootDir;

  return (
    <BuiltinNodeFrame
      footer={['Workspace root linked', 'Read-only repo surface', rootDir]}
      iconLabel="FT"
      kind="file-tree"
      nodeId={node.id}
      state={state}
      stateLabel={getBuiltinNodeStateLabel(state)}
      subtitle="Repo-context module"
      title={node.title}
    >
      <FileTreeNode
        workspaceId={workspaceId}
        node={{
          id: node.id,
          type: 'file-tree',
          x: node.bounds.x,
          y: node.bounds.y,
          rootDir
        }}
        onChange={(patch) => {
          void canvasStore.updateFileTreeNode(node.id, patch);
        }}
        onCreateBranchWorkspace={onCreateBranchWorkspace}
      />
    </BuiltinNodeFrame>
  );
};

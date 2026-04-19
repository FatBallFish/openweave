import { canvasStore } from '../../canvas/canvas.store';
import { FileTreeNode } from '../../canvas/nodes/FileTreeNode';
import type { BuiltinHostProps } from './types';

export const FileTreeHost = ({ workspaceId, workspaceRootDir, node, onCreateBranchWorkspace }: BuiltinHostProps): JSX.Element => {
  return (
    <FileTreeNode
      workspaceId={workspaceId}
      node={{
        id: node.id,
        type: 'file-tree',
        x: node.bounds.x,
        y: node.bounds.y,
        rootDir: typeof node.config.rootDir === 'string' ? node.config.rootDir : workspaceRootDir
      }}
      onChange={(patch) => {
        void canvasStore.updateFileTreeNode(node.id, patch);
      }}
      onCreateBranchWorkspace={onCreateBranchWorkspace}
    />
  );
};

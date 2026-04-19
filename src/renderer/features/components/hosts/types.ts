import type { GraphSnapshotV2Input } from '../../../../shared/ipc/schemas';

export type RendererGraphNode = GraphSnapshotV2Input['nodes'][number];

export interface BuiltinHostProps {
  workspaceId: string;
  workspaceRootDir: string;
  node: RendererGraphNode;
  onOpenRun: (runId: string) => void;
  onCreateBranchWorkspace: () => void;
}

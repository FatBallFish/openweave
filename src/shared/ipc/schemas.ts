import { z } from 'zod';
import {
  componentCapabilitySchema,
  componentNameSchema,
  componentVersionSchema
} from '../components/manifest';
import { assertPortalUrlAllowed } from '../portal/types';

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1),
  rootDir: z.string().trim().min(1),
  iconKey: z.string().trim().min(1).max(64).optional(),
  iconColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

export const workspaceIdSchema = z.string().trim().min(1);

export const workspaceOpenSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const workspaceDeleteSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const workspaceUpdateSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: z.string().trim().min(1),
  rootDir: z.string().trim().min(1),
  iconKey: z.string().trim().min(1).max(64),
  iconColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  groupId: z.string().trim().min(1).optional()
});

export const workspacePickDirectorySchema = z.object({
  initialPath: z.string().trim().min(1).optional()
});

export const workspaceRevealDirectorySchema = z.object({
  directory: z.string().trim().min(1)
});

export const workspaceGroupIdSchema = z.string().trim().min(1);

export const workspaceGroupCreateSchema = z.object({
  name: z.string().trim().min(1)
});

export const workspaceGroupUpdateSchema = z.object({
  groupId: workspaceGroupIdSchema,
  name: z.string().trim().min(1)
});

export const workspaceGroupDeleteSchema = z.object({
  groupId: workspaceGroupIdSchema
});

export const workspaceGroupCollapseSetSchema = z.object({
  groupId: workspaceGroupIdSchema,
  collapsed: z.boolean()
});

export const workspaceGroupMoveSchema = z.object({
  workspaceId: workspaceIdSchema,
  groupId: workspaceGroupIdSchema,
  targetIndex: z.number().int().min(0)
});

export const workspaceGroupMoveToUngroupedSchema = z.object({
  workspaceId: workspaceIdSchema,
  targetIndex: z.number().int().min(0)
});

export const workspaceGroupReorderUngroupedSchema = z.object({
  workspaceIds: z.array(workspaceIdSchema)
});

export const workspaceGroupReorderGroupsSchema = z.object({
  groupIds: z.array(workspaceGroupIdSchema)
});

export const workspaceGroupReorderWithinGroupSchema = z.object({
  groupId: workspaceGroupIdSchema,
  workspaceIds: z.array(workspaceIdSchema)
});

export const workspaceBranchCreateSchema = z.object({
  sourceWorkspaceId: workspaceIdSchema,
  branchName: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Za-z0-9._/-]+$/, 'Branch name contains unsupported characters')
    .refine((value) => !value.startsWith('-'), {
      message: 'Branch name cannot start with -'
    })
    .refine((value) => !value.startsWith('/') && !value.endsWith('/'), {
      message: 'Branch name cannot start or end with /'
    })
    .refine(
      (value) =>
        value
          .split('/')
          .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
      {
        message: 'Branch name contains unsupported path segments'
      }
    ),
  copyCanvas: z.boolean()
});


export const noteNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.literal('note'),
  x: z.number().finite(),
  y: z.number().finite(),
  contentMd: z.string()
});

export const runRuntimeSchema = z.enum(['shell', 'codex', 'claude', 'opencode']);

export const roleSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().default(''),
  icon: z.string().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#0078d4'),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative()
});

export const roleCreateSchema = roleSchema.omit({ id: true });
export const roleUpdateSchema = roleSchema;
export const roleDeleteSchema = z.object({ id: z.string().trim().min(1) });

export const runResizeSchema = z.object({
  workspaceId: workspaceIdSchema,
  runId: z.string().trim().min(1),
  cols: z.number().int().min(1).max(999),
  rows: z.number().int().min(1).max(999)
});

export const runOutputOffsetSchema = z.number().int().nonnegative();

export const runTailRangeSchema = z
  .object({
    tailStartOffset: runOutputOffsetSchema,
    tailEndOffset: runOutputOffsetSchema
  })
  .refine((value) => value.tailStartOffset <= value.tailEndOffset, {
    message: 'tailStartOffset must not exceed tailEndOffset'
  });

export const runStreamChunkRangeSchema = z
  .object({
    chunkStartOffset: runOutputOffsetSchema,
    chunkEndOffset: runOutputOffsetSchema
  })
  .refine((value) => value.chunkStartOffset <= value.chunkEndOffset, {
    message: 'chunkStartOffset must not exceed chunkEndOffset'
  });

export const terminalNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.literal('terminal'),
  x: z.number().finite(),
  y: z.number().finite(),
  command: z.string(),
  runtime: runRuntimeSchema.default('shell')
});

export const fileTreeNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.literal('file-tree'),
  x: z.number().finite(),
  y: z.number().finite(),
  rootDir: z.string().trim().min(1)
});

export const portalNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.literal('portal'),
  x: z.number().finite(),
  y: z.number().finite(),
  url: z.string().trim().min(1)
});

export const canvasNodeSchema = z.discriminatedUnion('type', [
  noteNodeSchema,
  terminalNodeSchema,
  fileTreeNodeSchema,
  portalNodeSchema
]);

export const canvasEdgeSchema = z.object({
  id: z.string().trim().min(1),
  sourceNodeId: z.string().trim().min(1),
  targetNodeId: z.string().trim().min(1)
});

export const canvasStateSchema = z.object({
  nodes: z.array(canvasNodeSchema),
  edges: z.array(canvasEdgeSchema)
});

export const canvasLoadSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const canvasSaveSchema = z.object({
  workspaceId: workspaceIdSchema,
  state: canvasStateSchema
});

export const componentTypeSchema = componentNameSchema;

const graphNodeBoundsSchemaV2 = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().gt(0, 'Node width must be greater than 0'),
  height: z.number().finite().gt(0, 'Node height must be greater than 0')
});

export const graphNodeSchemaV2 = z.object({
  id: z.string().trim().min(1),
  componentType: componentTypeSchema,
  componentVersion: componentVersionSchema,
  title: z.string().trim().min(1),
  bounds: graphNodeBoundsSchemaV2,
  config: z.record(z.unknown()),
  state: z.record(z.unknown()),
  capabilities: z
    .array(componentCapabilitySchema)
    .refine((values) => new Set(values).size === values.length, {
      message: 'Node capabilities must be unique'
    }),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative()
});

export const graphEdgeSchemaV2 = z
  .object({
    id: z.string().trim().min(1),
    source: z.string().trim().min(1),
    target: z.string().trim().min(1),
    sourceHandle: z.string().trim().min(1).nullish().transform((value) => value ?? null),
    targetHandle: z.string().trim().min(1).nullish().transform((value) => value ?? null),
    label: z.string().trim().min(1).nullish().transform((value) => value ?? null),
    meta: z.record(z.unknown()).nullish().transform((value) => value ?? {}),
    createdAtMs: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative()
  })
  .refine((edge) => edge.source !== edge.target, {
    message: 'Graph self-loops are not supported'
  });

export const graphSnapshotSchemaV2 = z
  .object({
    schemaVersion: z.literal(2),
    nodes: z.array(graphNodeSchemaV2),
    edges: z.array(graphEdgeSchemaV2)
  })
  .superRefine((snapshot, context) => {
    const nodeIds = new Set<string>();
    for (const [index, node] of snapshot.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', index, 'id'],
          message: 'Graph node ids must be unique'
        });
      }
      nodeIds.add(node.id);
    }

    const edgeIds = new Set<string>();
    for (const [index, edge] of snapshot.edges.entries()) {
      if (edgeIds.has(edge.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index, 'id'],
          message: 'Graph edge ids must be unique'
        });
      }
      edgeIds.add(edge.id);

      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index],
          message: 'Graph edges must reference existing nodes'
        });
      }
    }
  });

export const graphLoadSchemaV2 = z.object({
  workspaceId: workspaceIdSchema
});

export const graphSaveSchemaV2 = z.object({
  workspaceId: workspaceIdSchema,
  graphSnapshot: graphSnapshotSchemaV2
});

export const workspaceInfoSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const nodeListSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const nodeGetSchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().trim().min(1)
});

export const nodeNeighborsSchema = nodeGetSchema;

export const nodeReadSchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().trim().min(1),
  mode: z.string().trim().min(1).optional()
});

export const nodeActionSchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().trim().min(1),
  action: z.string().trim().min(1),
  payload: z.record(z.unknown()).optional(),
  requestId: z.string().trim().min(1).optional()
});

export const componentListSchema = z.object({
  workspaceId: workspaceIdSchema.optional()
});

export const componentInstallSourceTypeSchema = z.enum(['directory', 'zip']);

export const componentInstallSchema = z
  .object({
    sourceType: componentInstallSourceTypeSchema,
    sourcePath: z.string().trim().min(1)
  })
  .refine((input) => /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(input.sourcePath), {
    message: 'Component install source path must be absolute',
    path: ['sourcePath']
  });

export const componentUninstallSchema = z.object({
  name: componentTypeSchema,
  version: componentVersionSchema.optional()
});

export const runStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'stopped']);

export const runStartSchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().trim().min(1),
  runtime: runRuntimeSchema,
  command: z.string()
});

export const runGetSchema = z.object({
  workspaceId: workspaceIdSchema,
  runId: z.string().trim().min(1)
});

export const runInputSchema = z.object({
  workspaceId: workspaceIdSchema,
  runId: z.string().trim().min(1),
  input: z.string().min(1)
});

export const runStopSchema = z.object({
  workspaceId: workspaceIdSchema,
  runId: z.string().trim().min(1)
});

export const runListSchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().trim().min(1)
});

export const fileTreeLoadSchema = z.object({
  workspaceId: workspaceIdSchema,
  rootDir: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value), {
      message: 'Root directory must be a local filesystem path'
    })
});

export const portalLoadSchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().trim().min(1),
  url: z
    .string()
    .trim()
    .min(1)
    .refine((value) => {
      try {
        assertPortalUrlAllowed(value);
        return true;
      } catch {
        return false;
      }
    }, 'URL scheme not allowed')
});

export const portalCaptureSchema = z.object({
  workspaceId: workspaceIdSchema,
  portalId: z.string().trim().min(1)
});

export const portalStructureSchema = z.object({
  workspaceId: workspaceIdSchema,
  portalId: z.string().trim().min(1)
});

export const portalClickSchema = z.object({
  workspaceId: workspaceIdSchema,
  portalId: z.string().trim().min(1),
  selector: z.string().trim().min(1)
});

export const portalInputSchema = z.object({
  workspaceId: workspaceIdSchema,
  portalId: z.string().trim().min(1),
  selector: z.string().trim().min(1),
  value: z.string()
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceOpenInput = z.infer<typeof workspaceOpenSchema>;
export type WorkspaceDeleteInput = z.infer<typeof workspaceDeleteSchema>;
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
export type WorkspacePickDirectoryInput = z.infer<typeof workspacePickDirectorySchema>;
export type WorkspaceRevealDirectoryInput = z.infer<typeof workspaceRevealDirectorySchema>;
export type WorkspaceGroupCreateInput = z.infer<typeof workspaceGroupCreateSchema>;
export type WorkspaceGroupUpdateInput = z.infer<typeof workspaceGroupUpdateSchema>;
export type WorkspaceGroupDeleteInput = z.infer<typeof workspaceGroupDeleteSchema>;
export type WorkspaceGroupCollapseSetInput = z.infer<typeof workspaceGroupCollapseSetSchema>;
export type WorkspaceGroupMoveInput = z.infer<typeof workspaceGroupMoveSchema>;
export type WorkspaceGroupMoveToUngroupedInput = z.infer<typeof workspaceGroupMoveToUngroupedSchema>;
export type WorkspaceGroupReorderUngroupedInput = z.infer<typeof workspaceGroupReorderUngroupedSchema>;
export type WorkspaceGroupReorderGroupsInput = z.infer<typeof workspaceGroupReorderGroupsSchema>;
export type WorkspaceGroupReorderWithinGroupInput = z.infer<typeof workspaceGroupReorderWithinGroupSchema>;
export type WorkspaceBranchCreateInput = z.infer<typeof workspaceBranchCreateSchema>;
export type NoteNodeInput = z.infer<typeof noteNodeSchema>;
export type TerminalNodeInput = z.infer<typeof terminalNodeSchema>;
export type FileTreeNodeInput = z.infer<typeof fileTreeNodeSchema>;
export type PortalNodeInput = z.infer<typeof portalNodeSchema>;
export type CanvasNodeInput = z.infer<typeof canvasNodeSchema>;
export type CanvasEdgeInput = z.infer<typeof canvasEdgeSchema>;
export type CanvasStateInput = z.infer<typeof canvasStateSchema>;
export type CanvasLoadInput = z.infer<typeof canvasLoadSchema>;
export type CanvasSaveInput = z.infer<typeof canvasSaveSchema>;
export type GraphNodeV2Input = z.infer<typeof graphNodeSchemaV2>;
export type GraphEdgeV2Input = z.infer<typeof graphEdgeSchemaV2>;
export type GraphSnapshotV2Input = z.infer<typeof graphSnapshotSchemaV2>;
export type GraphLoadV2Input = z.infer<typeof graphLoadSchemaV2>;
export type GraphSaveV2Input = z.infer<typeof graphSaveSchemaV2>;
export type WorkspaceInfoInput = z.infer<typeof workspaceInfoSchema>;
export type NodeListInput = z.infer<typeof nodeListSchema>;
export type NodeGetInput = z.infer<typeof nodeGetSchema>;
export type NodeNeighborsInput = z.infer<typeof nodeNeighborsSchema>;
export type NodeReadInput = z.infer<typeof nodeReadSchema>;
export type NodeActionInput = z.infer<typeof nodeActionSchema>;
export type ComponentListInput = z.infer<typeof componentListSchema>;
export type ComponentInstallSourceTypeInput = z.infer<typeof componentInstallSourceTypeSchema>;
export type ComponentInstallInput = z.infer<typeof componentInstallSchema>;
export type ComponentUninstallInput = z.infer<typeof componentUninstallSchema>;
export type RunRuntimeInput = z.infer<typeof runRuntimeSchema>;
export type RunStatusInput = z.infer<typeof runStatusSchema>;
export type RunStartInput = z.infer<typeof runStartSchema>;
export type RunGetInput = z.infer<typeof runGetSchema>;
export type RunInputInput = z.infer<typeof runInputSchema>;
export type RunStopInput = z.infer<typeof runStopSchema>;
export type RunListInput = z.infer<typeof runListSchema>;
export type FileTreeLoadInput = z.infer<typeof fileTreeLoadSchema>;
export type PortalLoadInput = z.infer<typeof portalLoadSchema>;
export type PortalCaptureInput = z.infer<typeof portalCaptureSchema>;
export type PortalStructureInput = z.infer<typeof portalStructureSchema>;
export type PortalClickInput = z.infer<typeof portalClickSchema>;
export type PortalInputInput = z.infer<typeof portalInputSchema>;

export const OpenSettingsSchema = z.object({});
export type OpenSettingsInput = z.infer<typeof OpenSettingsSchema>;

export type RoleInput = z.infer<typeof roleSchema>;
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
export type RoleDeleteInput = z.infer<typeof roleDeleteSchema>;
export type RunResizeInput = z.infer<typeof runResizeSchema>;

export { componentCapabilitySchema };

import { z } from 'zod';
import { assertPortalUrlAllowed } from '../portal/types';

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1),
  rootDir: z.string().trim().min(1)
});

export const workspaceIdSchema = z.string().trim().min(1);

export const workspaceOpenSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const workspaceDeleteSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const noteNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.literal('note'),
  x: z.number().finite(),
  y: z.number().finite(),
  contentMd: z.string()
});

export const terminalNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.literal('terminal'),
  x: z.number().finite(),
  y: z.number().finite(),
  command: z.string()
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

export const runRuntimeSchema = z.enum(['shell', 'codex', 'claude']);

export const runStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);

export const runStartSchema = z.object({
  workspaceId: workspaceIdSchema,
  nodeId: z.string().trim().min(1),
  runtime: runRuntimeSchema,
  command: z.string().trim().min(1)
});

export const runGetSchema = z.object({
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
export type NoteNodeInput = z.infer<typeof noteNodeSchema>;
export type TerminalNodeInput = z.infer<typeof terminalNodeSchema>;
export type FileTreeNodeInput = z.infer<typeof fileTreeNodeSchema>;
export type PortalNodeInput = z.infer<typeof portalNodeSchema>;
export type CanvasNodeInput = z.infer<typeof canvasNodeSchema>;
export type CanvasEdgeInput = z.infer<typeof canvasEdgeSchema>;
export type CanvasStateInput = z.infer<typeof canvasStateSchema>;
export type CanvasLoadInput = z.infer<typeof canvasLoadSchema>;
export type CanvasSaveInput = z.infer<typeof canvasSaveSchema>;
export type RunRuntimeInput = z.infer<typeof runRuntimeSchema>;
export type RunStatusInput = z.infer<typeof runStatusSchema>;
export type RunStartInput = z.infer<typeof runStartSchema>;
export type RunGetInput = z.infer<typeof runGetSchema>;
export type RunListInput = z.infer<typeof runListSchema>;
export type FileTreeLoadInput = z.infer<typeof fileTreeLoadSchema>;
export type PortalLoadInput = z.infer<typeof portalLoadSchema>;
export type PortalCaptureInput = z.infer<typeof portalCaptureSchema>;
export type PortalStructureInput = z.infer<typeof portalStructureSchema>;
export type PortalClickInput = z.infer<typeof portalClickSchema>;
export type PortalInputInput = z.infer<typeof portalInputSchema>;

import { z } from 'zod';

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

export const canvasEdgeSchema = z.object({
  id: z.string().trim().min(1),
  sourceNodeId: z.string().trim().min(1),
  targetNodeId: z.string().trim().min(1)
});

export const canvasStateSchema = z.object({
  nodes: z.array(noteNodeSchema),
  edges: z.array(canvasEdgeSchema)
});

export const canvasLoadSchema = z.object({
  workspaceId: workspaceIdSchema
});

export const canvasSaveSchema = z.object({
  workspaceId: workspaceIdSchema,
  state: canvasStateSchema
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceOpenInput = z.infer<typeof workspaceOpenSchema>;
export type WorkspaceDeleteInput = z.infer<typeof workspaceDeleteSchema>;
export type NoteNodeInput = z.infer<typeof noteNodeSchema>;
export type CanvasEdgeInput = z.infer<typeof canvasEdgeSchema>;
export type CanvasStateInput = z.infer<typeof canvasStateSchema>;
export type CanvasLoadInput = z.infer<typeof canvasLoadSchema>;
export type CanvasSaveInput = z.infer<typeof canvasSaveSchema>;

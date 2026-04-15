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

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceOpenInput = z.infer<typeof workspaceOpenSchema>;
export type WorkspaceDeleteInput = z.infer<typeof workspaceDeleteSchema>;

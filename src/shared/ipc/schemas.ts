import { z } from 'zod';

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1),
  rootDir: z.string().trim().min(1)
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;

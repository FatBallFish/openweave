import { z } from 'zod';

export const workspaceCreateSchema = z.object({
  name: z.string().min(1),
  rootDir: z.string().min(1)
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;

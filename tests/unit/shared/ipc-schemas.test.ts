import { describe, expect, it } from 'vitest';
import { workspaceCreateSchema } from '../../../src/shared/ipc/schemas';

describe('workspaceCreateSchema', () => {
  it('rejects an empty directory path', () => {
    expect(() => workspaceCreateSchema.parse({ name: 'demo', rootDir: '' })).toThrow();
  });
});

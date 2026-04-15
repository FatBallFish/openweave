import { describe, expect, it } from 'vitest';
import { workspaceCreateSchema } from '../../../src/shared/ipc/schemas';

describe('workspaceCreateSchema', () => {
  it('rejects a whitespace-only workspace name', () => {
    expect(() => workspaceCreateSchema.parse({ name: '   ', rootDir: '/tmp/demo' })).toThrow();
  });

  it('rejects an empty directory path', () => {
    expect(() => workspaceCreateSchema.parse({ name: 'demo', rootDir: '' })).toThrow();
  });

  it('rejects a whitespace-only directory path', () => {
    expect(() => workspaceCreateSchema.parse({ name: 'demo', rootDir: '   ' })).toThrow();
  });

  it('accepts trimmed non-empty values', () => {
    const result = workspaceCreateSchema.parse({ name: ' demo ', rootDir: ' /tmp/demo ' });
    expect(result.name).toBe('demo');
    expect(result.rootDir).toBe('/tmp/demo');
  });
});

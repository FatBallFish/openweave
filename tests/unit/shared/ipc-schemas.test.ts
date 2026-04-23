import { describe, expect, it } from 'vitest';
import {
  fileTreeLoadSchema,
  portalLoadSchema,
  runStartSchema,
  workspaceBranchCreateSchema,
  workspaceCreateSchema
} from '../../../src/shared/ipc/schemas';

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

  it('rejects branch names with empty or dot path segments', () => {
    expect(() =>
      workspaceBranchCreateSchema.parse({
        sourceWorkspaceId: 'ws-1',
        branchName: 'feature//demo',
        copyCanvas: true
      })
    ).toThrow('Branch name contains unsupported path segments');
    expect(() =>
      workspaceBranchCreateSchema.parse({
        sourceWorkspaceId: 'ws-1',
        branchName: 'feature/../demo',
        copyCanvas: true
      })
    ).toThrow('Branch name contains unsupported path segments');
  });

  it('rejects URL-like file tree roots and disallowed portal URLs', () => {
    expect(() =>
      fileTreeLoadSchema.parse({
        workspaceId: 'ws-1',
        rootDir: 'https://example.com/demo'
      })
    ).toThrow('Root directory must be a local filesystem path');
    expect(() =>
      portalLoadSchema.parse({
        workspaceId: 'ws-1',
        nodeId: 'portal-1',
        url: 'file:///tmp/demo.html'
      })
    ).toThrow('URL scheme not allowed');
  });

  it('accepts empty initial commands for terminal run starts', () => {
    const result = runStartSchema.parse({
      workspaceId: 'ws-1',
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: ''
    });

    expect(result.command).toBe('');
  });
});

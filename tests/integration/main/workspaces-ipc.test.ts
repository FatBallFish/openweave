import { describe, expect, it } from 'vitest';
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  openWorkspace
} from '../../../src/main/ipc/workspaces';

describe('workspace IPC flow', () => {
  it('creates a workspace row and returns it in the list', async () => {
    const suffix = Date.now();
    const result = await createWorkspace({ name: `Demo-${suffix}`, rootDir: `/tmp/demo-${suffix}` });
    expect(result.workspace.name).toBe(`Demo-${suffix}`);
    expect(listWorkspaces()[0].rootDir).toBe(`/tmp/demo-${suffix}`);
  });

  it('updates last opened timestamp on open', async () => {
    const suffix = Date.now();
    const result = await createWorkspace({
      name: `Opened-${suffix}`,
      rootDir: `/tmp/opened-${suffix}`
    });

    expect(result.workspace.lastOpenedAtMs).toBeNull();

    const opened = await openWorkspace(result.workspace.id);
    expect(opened.workspace.lastOpenedAtMs).toBeTypeOf('number');
  });

  it('deletes a workspace row', async () => {
    const suffix = Date.now();
    const result = await createWorkspace({
      name: `Deleted-${suffix}`,
      rootDir: `/tmp/deleted-${suffix}`
    });

    const removed = await deleteWorkspace(result.workspace.id);
    expect(removed.deleted).toBe(true);
    expect(listWorkspaces().find((workspace) => workspace.id === result.workspace.id)).toBeUndefined();
  });
});

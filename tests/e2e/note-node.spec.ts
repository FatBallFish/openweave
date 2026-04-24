import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

const getWorkspaceIdByName = async (
  page: import('@playwright/test').Page,
  workspaceName: string
): Promise<string> => {
  const workspaceRow = page.locator('[data-testid^="workspace-row-"]').filter({
    has: page.getByText(workspaceName, { exact: true })
  });
  const testId = await workspaceRow.getAttribute('data-testid');
  if (!testId) {
    throw new Error(`Workspace row test id not found for ${workspaceName}`);
  }

  return testId.replace(/^workspace-row-/, '');
};

const loadGraphSnapshot = async (
  page: import('@playwright/test').Page,
  workspaceId: string
): Promise<{
  graphSnapshot: {
    nodes: Array<{
      id: string;
      componentType: string;
      bounds: { x: number; y: number; width: number; height: number };
      state: Record<string, unknown>;
    }>;
  };
}> => {
  return page.evaluate(async (activeWorkspaceId) => {
    const shell = (window as Window & {
      openweaveShell?: {
        graph: {
          loadGraphSnapshot: (input: { workspaceId: string }) => Promise<{
            graphSnapshot: {
              nodes: Array<{
                id: string;
                componentType: string;
                bounds: { x: number; y: number; width: number; height: number };
                state: Record<string, unknown>;
              }>;
            };
          }>;
        };
      };
    }).openweaveShell;

    if (!shell) {
      throw new Error('openweaveShell bridge missing');
    }

    return shell.graph.loadGraphSnapshot({ workspaceId: activeWorkspaceId });
  }, workspaceId);
};

test('persists note node content and graph position across restart', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-note-node-${uniqueSuffix}`);
  const workspaceName = `Canvas-${uniqueSuffix}`;
  const workspaceRoot = path.join(os.tmpdir(), `openweave-canvas-${uniqueSuffix}`);
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const firstApp = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  let workspaceId = '';
  let noteId = '';
  let noteBounds: { x: number; y: number; width: number; height: number } | null = null;

  try {
    const firstPage = await firstApp.firstWindow();

    await expect(firstPage.getByTestId('workspace-list-page')).toBeVisible();
    await firstPage.getByTestId('workspace-create-button').click();
    await firstPage.getByTestId('create-workspace-name-input').fill(workspaceName);
    await firstPage.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await firstPage.getByTestId('create-workspace-submit').click();

    workspaceId = await getWorkspaceIdByName(firstPage, workspaceName);

    await expect(firstPage.getByTestId('workspace-canvas-page')).toBeVisible();
    await firstPage.getByTestId('workbench-topbar-action-add-note').click();

    const noteEditor = firstPage.locator('[data-testid^="note-sticky-editor-"]').first();
    await expect(noteEditor).toBeVisible();
    await noteEditor.fill('# Hello');
    await expect(noteEditor).toHaveValue('# Hello');
    await noteEditor.blur();

    const graph = await loadGraphSnapshot(firstPage, workspaceId);
    const noteNode = graph.graphSnapshot.nodes.find((node) => node.componentType === 'builtin.note');
    expect(noteNode).toBeDefined();

    noteId = noteNode?.id ?? '';
    noteBounds = noteNode?.bounds ?? null;
    expect(noteNode?.state.content).toBe('# Hello');
  } finally {
    await firstApp.close();
  }

  const secondApp = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const secondPage = await secondApp.firstWindow();
    await expect(secondPage.getByTestId('workspace-list-page')).toBeVisible();
    await secondPage.getByRole('button', { name: `Open ${workspaceName}` }).click();
    await expect(secondPage.getByTestId('workspace-canvas-page')).toBeVisible();

    const restoredContent = secondPage.locator('[data-testid^="note-sticky-editor-"]').first();
    await expect(restoredContent).toHaveValue('# Hello');

    const graph = await loadGraphSnapshot(secondPage, workspaceId);
    const restoredNode = graph.graphSnapshot.nodes.find((node) => node.id === noteId);
    expect(restoredNode).toBeDefined();
    expect(restoredNode?.state.content).toBe('# Hello');
    expect(restoredNode?.bounds).toEqual(noteBounds);
  } finally {
    await secondApp.close();
  }
});

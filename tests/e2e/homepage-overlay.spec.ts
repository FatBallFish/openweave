import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

test('switches homepage language and persists the choice across relaunch', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-homepage-locale-${uniqueSuffix}`);

  const firstApp = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const firstPage = await firstApp.firstWindow();
    await expect(firstPage.getByTestId('workbench-language-switcher')).toBeVisible();
    await firstPage.getByTestId('workbench-language-option-en-US').click();
    await expect(firstPage.getByTestId('workbench-left-rail-brand')).toContainText('AI engineer workbench');
    await expect(firstPage.getByTestId('workbench-topbar-workspace-pill')).toContainText(
      'No workspace'
    );
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
    await expect(secondPage.getByTestId('workbench-left-rail-brand')).toContainText('AI engineer workbench');
    await expect(secondPage.getByTestId('workbench-topbar-workspace-pill')).toContainText(
      'No workspace'
    );
  } finally {
    await secondApp.close();
  }
});

test('keeps the canvas fullscreen behind floating chrome and shows newly added nodes', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-homepage-canvas-${uniqueSuffix}`);
  const workspaceName = `Homepage-${uniqueSuffix}`;
  const workspaceRoot = path.join(os.tmpdir(), `openweave-homepage-${uniqueSuffix}`);
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();
    await expect(page.getByTestId('workbench-topbar-create-cluster')).toBeVisible();
    await expect(page.getByTestId('workbench-topbar-canvas-cluster')).toBeVisible();
    await expect(page.getByTestId('workbench-topbar-meta-strip')).toBeVisible();
    await expect(page.getByTestId('workbench-left-rail')).toBeVisible();
    await expect(page.getByTestId('workbench-left-rail-brand')).toContainText('OpenWeave');
    await expect(page.getByTestId('workbench-inspector')).toBeVisible();

    const layout = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid="workbench-stage"]') as HTMLElement | null;
      const leftRail = document.querySelector('[data-testid="workbench-left-rail"]') as HTMLElement | null;
      const contextPanel = document.querySelector('[data-testid="workbench-context-panel"]') as HTMLElement | null;
      const createCluster = document.querySelector('[data-testid="workbench-topbar-create-cluster"]') as HTMLElement | null;
      const canvasCluster = document.querySelector('[data-testid="workbench-topbar-canvas-cluster"]') as HTMLElement | null;
      const metaStrip = document.querySelector('[data-testid="workbench-topbar-meta-strip"]') as HTMLElement | null;
      const inspector = document.querySelector('[data-testid="workbench-inspector"]') as HTMLElement | null;
      const minimap = document.querySelector('[data-testid="canvas-shell-minimap"]') as HTMLElement | null;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      return {
        stage: stage?.getBoundingClientRect().toJSON() ?? null,
        leftRail: leftRail?.getBoundingClientRect().toJSON() ?? null,
        contextPanel: contextPanel?.getBoundingClientRect().toJSON() ?? null,
        createCluster: createCluster?.getBoundingClientRect().toJSON() ?? null,
        canvasCluster: canvasCluster?.getBoundingClientRect().toJSON() ?? null,
        metaStrip: metaStrip?.getBoundingClientRect().toJSON() ?? null,
        inspector: inspector?.getBoundingClientRect().toJSON() ?? null,
        minimap: minimap?.getBoundingClientRect().toJSON() ?? null,
        viewportWidth,
        viewportHeight
      };
    });

    expect(layout.stage?.x ?? -1).toBe(0);
    expect(layout.stage?.y ?? -1).toBe(0);
    expect(Math.abs((layout.stage?.width ?? 0) - layout.viewportWidth)).toBeLessThanOrEqual(2);
    expect(Math.abs((layout.stage?.height ?? 0) - layout.viewportHeight)).toBeLessThanOrEqual(2);
    expect((layout.leftRail?.x ?? 999)).toBeLessThan(32);
    expect((layout.leftRail?.width ?? 0) >= 96).toBe(true);
    expect((layout.contextPanel?.left ?? 0) > (layout.leftRail?.right ?? 0)).toBe(true);
    expect(
      Math.abs(((layout.createCluster?.left ?? 0) + (layout.createCluster?.width ?? 0) / 2) - layout.viewportWidth / 2)
    ).toBeLessThanOrEqual(24);
    expect(
      Math.abs(((layout.canvasCluster?.left ?? 0) + (layout.canvasCluster?.width ?? 0) / 2) - layout.viewportWidth / 2)
    ).toBeLessThanOrEqual(24);
    expect((layout.canvasCluster?.top ?? 0) >= (layout.createCluster?.bottom ?? 0) - 2).toBe(true);
    expect((layout.metaStrip?.right ?? 0) >= layout.viewportWidth - 28).toBe(true);
    expect((layout.inspector?.right ?? 0) >= layout.viewportWidth - 28).toBe(true);
    expect((layout.inspector?.top ?? 0) > (layout.metaStrip?.bottom ?? 0)).toBe(true);
    expect((layout.minimap?.height ?? 999) <= 48).toBe(true);

    await expect(page.locator('.react-flow__controls')).toHaveCount(0);
    await expect(page.locator('.react-flow__minimap')).toHaveCount(0);
    await page.getByTestId('canvas-shell-minimap').click();
    await expect(page.locator('.react-flow__minimap')).toHaveCount(1);
    await page.getByTestId('canvas-shell-minimap-collapse').click();
    await expect(page.locator('.react-flow__minimap')).toHaveCount(0);

    await page.getByTestId('workbench-topbar-action-add-note').click();
    await expect(page.getByTestId('workbench-inspector')).toContainText('Note');
    await page.getByTestId('workbench-topbar-action-add-terminal').click();
    const nodes = page.locator('[data-testid^="canvas-shell-node-"]');
    const firstNode = nodes.first();
    await expect(nodes).toHaveCount(2);
    await expect(firstNode).toBeVisible();
    await expect(page.getByTestId('workbench-inspector')).toContainText('Terminal');

    const nodeBox = await firstNode.boundingBox();
    expect(nodeBox).not.toBeNull();
    expect((nodeBox?.width ?? 0) > 0).toBe(true);
    expect((nodeBox?.height ?? 0) > 0).toBe(true);

    const viewport = page.locator('.react-flow__viewport');
    const pane = page.locator('.react-flow__pane');
    await expect(pane).toHaveCSS('cursor', 'grab');
    await expect(viewport).toBeVisible();

    await page.getByTestId('workbench-inspector-toggle').click();
    await expect(page.getByTestId('workbench-inspector-collapsed')).toBeVisible();
    await page.getByTestId('workbench-inspector-toggle').click();
    await expect(page.getByTestId('workbench-inspector')).toContainText('Terminal');
  } finally {
    await app.close();
  }
});

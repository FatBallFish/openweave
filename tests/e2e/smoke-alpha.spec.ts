import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { createRegistryRepository } from '../../src/main/db/registry';

interface SeedWorkspaceInput {
  name: string;
  rootDir: string;
}

const packagedExecutablePath = process.env.OPENWEAVE_PACKAGED_EXECUTABLE
  ? path.resolve(process.env.OPENWEAVE_PACKAGED_EXECUTABLE)
  : null;

const seedWorkspace = (userDataDir: string, workspace: SeedWorkspaceInput): void => {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(workspace.rootDir, { recursive: true });

  const registry = createRegistryRepository({
    dbFilePath: path.join(userDataDir, 'registry.db')
  });

  try {
    registry.createWorkspace({
      name: workspace.name,
      rootDir: workspace.rootDir
    });
  } finally {
    registry.close();
  }
};

test('launches the packaged app and opens an existing workspace', async () => {
  test.skip(!packagedExecutablePath, 'OPENWEAVE_PACKAGED_EXECUTABLE is required for packaged alpha smoke tests.');

  const uniqueSuffix = Date.now().toString();
  const workspaceName = `Alpha-Workspace-${uniqueSuffix}`;
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-alpha-user-${uniqueSuffix}`);
  const workspaceRootDir = path.join(os.tmpdir(), `openweave-e2e-alpha-root-${uniqueSuffix}`);

  seedWorkspace(userDataDir, {
    name: workspaceName,
    rootDir: workspaceRootDir
  });

  const app = await electron.launch({
    executablePath: packagedExecutablePath ?? undefined,
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();
    await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Open ${workspaceName}` }).click();
    await expect(page.getByTestId('active-workspace-name')).toContainText(workspaceName);
  } finally {
    await app.close();
  }
});

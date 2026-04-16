import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts',
      'tests/unit/create-workspace-dialog.test.ts',
      'tests/unit/main/preload.test.ts',
      'tests/unit/main/portal-manager*.test.ts',
      'tests/unit/main/runtime-bridge*.test.ts',
      'tests/unit/renderer/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/main/preload.ts',
        'src/main/portal/portal-manager.ts',
        'src/main/runtime/runtime-bridge.ts',
        'src/main/db/registry.ts',
        'src/main/db/workspace.ts',
        'src/main/ipc/branch-workspaces.ts',
        'src/main/ipc/canvas.ts',
        'src/main/ipc/files.ts',
        'src/main/ipc/portal.ts',
        'src/main/ipc/runs.ts',
        'src/main/ipc/workspaces.ts',
        'src/main/recovery/recovery-service.ts',
        'src/renderer/features/workspaces/CreateWorkspaceDialog.tsx',
        'src/renderer/features/workspaces/BranchWorkspaceDialog.tsx',
        'src/renderer/features/workspaces/workspaces.store.ts',
        'src/renderer/features/canvas/canvas.store.ts',
        'src/renderer/features/canvas/nodes/NodeToolbar.tsx',
        'src/renderer/features/portal/PortalToolbar.tsx',
        'src/renderer/features/git/GitPanel.tsx',
        'src/worker/fs/file-tree-service.ts',
        'src/worker/git/git-service.ts',
        'src/worker/git/worktree-service.ts'
      ]
    }
  }
});

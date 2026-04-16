import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'deploy/package-plan.cjs',
        'src/shared/ipc/contracts.ts',
        'src/shared/ipc/schemas.ts',
        'src/shared/portal/types.ts',
        'src/main/audit/audit-log.ts',
        'src/main/portal/portal-session-service.ts',
        'src/main/workspace/path-boundary.ts',
        'src/worker/adapters/**/*.ts'
      ]
    }
  }
});

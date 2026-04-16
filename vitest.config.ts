import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'deploy/**/*.cjs', 'deploy/**/*.mjs'],
      exclude: [
        'src/renderer/index.html',
        'src/renderer/main.tsx',
        'src/main/db/migrations/**',
        'src/**/index.html'
      ]
    }
  }
});

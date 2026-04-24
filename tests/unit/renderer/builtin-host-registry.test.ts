// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  renderBuiltinHost,
  resolveBuiltinHostRegistration
} from '../../../src/renderer/features/components/builtin-host-registry';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

const createNode = (
  componentType: string,
  overrides: Partial<GraphSnapshotV2Input['nodes'][number]> = {}
): GraphSnapshotV2Input['nodes'][number] => ({
  id: `${componentType}-node-1`,
  componentType,
  componentVersion: '1.0.0',
  title: componentType,
  bounds: {
    x: 10,
    y: 20,
    width: 320,
    height: 240
  },
  config: {},
  state: {},
  capabilities: ['read'],
  createdAtMs: 1,
  updatedAtMs: 2,
  ...overrides
});

describe('builtin host registry', () => {
  it('registers renderer hosts for the supported builtin component types using manifest metadata', () => {
    const supportedTypes = [
      'builtin.note',
      'builtin.terminal',
      'builtin.file-tree',
      'builtin.portal',
      'builtin.text',
      'builtin.attachment'
    ];

    for (const componentType of supportedTypes) {
      const registration = resolveBuiltinHostRegistration(componentType);
      expect(registration).not.toBeNull();
      expect(registration?.manifest).toMatchObject({
        name: componentType,
        kind: 'builtin'
      });
      expect(typeof registration?.HostComponent).toBe('function');
    }
  });

  it('fails closed with a bounded fallback surface for unsupported component types', () => {
    const html = renderToStaticMarkup(
      createElement(renderBuiltinHost, {
        workspaceId: 'ws-1',
        workspaceRootDir: '/tmp/ws-1',
        node: createNode('external.demo-echo'),
        onOpenRun: vi.fn(),
        onCreateBranchWorkspace: vi.fn()
      })
    );

    expect(html).toContain('Unsupported component');
    expect(html).toContain('external.demo-echo');
  });
});

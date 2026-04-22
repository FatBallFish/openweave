import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchInspector } from '../../../src/renderer/features/workbench/WorkbenchInspector';
import { WorkbenchStatusIsland } from '../../../src/renderer/features/workbench/WorkbenchStatusIsland';
import { I18nProvider } from '../../../src/renderer/i18n/provider';

describe('inspector panel', () => {
  it('renders selected node summary, control sections, and shortcut actions', () => {
    const html = renderToStaticMarkup(
      createElement(
        I18nProvider,
        null,
        createElement(WorkbenchInspector, {
          workspaceName: 'Alpha Workspace',
          workspaceRootDir: '/tmp/alpha',
          selectedNode: {
            id: 'terminal-1',
            title: 'Terminal',
            componentType: 'builtin.terminal',
            capabilities: ['read', 'write', 'execute']
          },
          nodeCount: 5,
          edgeCount: 3,
          recentAction: 'Added terminal',
          collapsed: false,
          onToggle: vi.fn()
        })
      )
    );

    expect(html).toContain('已选择节点');
    expect(html).toContain('Terminal');
    expect(html).toContain('builtin.terminal');
    expect(html).toContain('Added terminal');
    expect(html).toContain('快捷操作');
  });

  it('renders mapped status, event, and task counters', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbenchStatusIsland, {
        hasActiveWorkspace: true,
        statusLabel: 'Focused',
        eventsCount: 2,
        tasksCount: 5
      })
    );

    expect(html).toContain('workbench-status-island');
    expect(html).toContain('status-island-events');
    expect(html).toContain('Focused');
    expect(html).toContain('2');
    expect(html).toContain('5');
  });
});

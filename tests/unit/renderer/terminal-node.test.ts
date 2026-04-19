import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TerminalNode } from '../../../src/renderer/features/canvas/nodes/TerminalNode';

const terminalNode = {
  id: 'terminal-1',
  type: 'terminal' as const,
  x: 160,
  y: 120,
  command: 'pwd',
  runtime: 'codex' as const
};

describe('terminal node', () => {
  it('renders a runtime selector with the supported runtimes', () => {
    const html = renderToStaticMarkup(
      createElement(TerminalNode, {
        workspaceId: 'ws-1',
        node: terminalNode,
        onChange: vi.fn(),
        onOpenRun: vi.fn()
      })
    );

    expect(html).toContain(`terminal-node-runtime-${terminalNode.id}`);
    expect(html).toContain('<option value="shell">Shell</option>');
    expect(html).toContain('<option value="codex" selected="">Codex</option>');
    expect(html).toContain('<option value="claude">Claude</option>');
    expect(html).toContain('<option value="opencode">OpenCode</option>');
  });

  it('builds run requests from the node runtime with a shell fallback', async () => {
    const module = (await import(
      '../../../src/renderer/features/canvas/nodes/TerminalNode'
    )) as {
      buildTerminalRunStartInput?: (input: {
        workspaceId: string;
        node: {
          id: string;
          command: string;
          runtime?: 'shell' | 'codex' | 'claude' | 'opencode';
        };
      }) => {
        workspaceId: string;
        nodeId: string;
        runtime: string;
        command: string;
      };
    };

    expect(typeof module.buildTerminalRunStartInput).toBe('function');
    expect(
      module.buildTerminalRunStartInput?.({
        workspaceId: 'ws-1',
        node: terminalNode
      })
    ).toEqual({
      workspaceId: 'ws-1',
      nodeId: terminalNode.id,
      runtime: 'codex',
      command: terminalNode.command
    });
    expect(
      module.buildTerminalRunStartInput?.({
        workspaceId: 'ws-1',
        node: {
          ...terminalNode,
          runtime: undefined
        }
      })
    ).toMatchObject({
      runtime: 'shell'
    });
  });
});

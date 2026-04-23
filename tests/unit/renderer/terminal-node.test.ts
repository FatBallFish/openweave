// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerminalNode } from '../../../src/renderer/features/canvas/nodes/TerminalNode';

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
    options: {},
    cols: 80,
    rows: 24
  }))
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn()
  }))
}));

describe('TerminalNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
    (globalThis as any).window = {
      openweaveShell: {
        runs: {
          listRuns: vi.fn().mockResolvedValue({ runs: [] }),
          subscribeStream: vi.fn(),
          unsubscribeStream: vi.fn(),
          onStream: vi.fn().mockReturnValue(() => {})
        }
      }
    };
  });

  it('renders xterm container', () => {
    const html = renderToStaticMarkup(
      createElement(TerminalNode, {
        workspaceId: 'ws-1',
        node: { id: 't1', type: 'terminal', x: 0, y: 0, command: 'echo hi', runtime: 'shell' },
        config: { workingDir: '', iconKey: '', iconColor: '', theme: 'auto', fontFamily: '', fontSize: 14, roleId: null },
        onChange: () => {},
        onOpenRun: () => {}
      })
    );
    expect(html).toContain('terminal-node-xterm-t1');
  });
});

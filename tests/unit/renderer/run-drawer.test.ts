// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunDrawer } from '../../../src/renderer/features/runs/RunDrawer';

describe('RunDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as any).window = {
      openweaveShell: {
        runs: {
          getRun: vi.fn().mockRejectedValue(new Error('Run not found: run-stale')),
          stopRun: vi.fn(),
          subscribeStream: vi.fn(),
          unsubscribeStream: vi.fn(),
          onStream: vi.fn().mockReturnValue(() => {})
        }
      }
    };
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
  });

  it('closes itself when the requested run no longer exists', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        createElement(RunDrawer, {
          workspaceId: 'ws-1',
          runId: 'run-stale',
          onClose
        })
      );
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

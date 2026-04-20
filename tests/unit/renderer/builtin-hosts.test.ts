import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { renderBuiltinHost } from '../../../src/renderer/features/components/builtin-host-registry';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

const renderHost = (node: GraphSnapshotV2Input['nodes'][number]): string => {
  return renderToStaticMarkup(
    createElement(renderBuiltinHost, {
      workspaceId: 'ws-1',
      workspaceRootDir: '/tmp/ws-1',
      node,
      onOpenRun: vi.fn(),
      onCreateBranchWorkspace: vi.fn()
    })
  );
};

describe('builtin hosts', () => {
  it('renders note and terminal hosts from graph-backed state', () => {
    const noteHtml = renderHost({
      id: 'node-note-1',
      componentType: 'builtin.note',
      componentVersion: '1.0.0',
      title: 'Note',
      bounds: {
        x: 10,
        y: 20,
        width: 320,
        height: 240
      },
      config: {
        mode: 'markdown'
      },
      state: {
        content: '# hello'
      },
      capabilities: ['read', 'write'],
      createdAtMs: 1,
      updatedAtMs: 2
    });
    const terminalHtml = renderHost({
      id: 'node-terminal-1',
      componentType: 'builtin.terminal',
      componentVersion: '1.0.0',
      title: 'Terminal',
      bounds: {
        x: 40,
        y: 60,
        width: 420,
        height: 260
      },
      config: {
        command: 'pwd',
        runtime: 'codex'
      },
      state: {
        activeSessionId: null
      },
      capabilities: ['read', 'write', 'execute', 'stream'],
      createdAtMs: 3,
      updatedAtMs: 4
    });

    expect(noteHtml).toContain('builtin-node-frame-node-note-1');
    expect(noteHtml).toContain('note-host-editor-node-note-1');
    expect(noteHtml).toContain('Editable markdown');
    expect(noteHtml).toContain('# hello');
    expect(terminalHtml).toContain('builtin-node-frame-node-terminal-1');
    expect(terminalHtml).toContain('terminal-node-runtime-node-terminal-1');
    expect(terminalHtml).toContain('terminal-node-session-node-terminal-1');
    expect(terminalHtml).toContain('Open run');
    expect(terminalHtml).toContain('cwd');
    expect(terminalHtml).toContain('<option value=\"codex\" selected=\"\">Codex</option>');
    expect(terminalHtml).toContain('terminal-node-command-node-terminal-1');
  });

  it('renders file-tree and portal hosts with their existing product controls', () => {
    const fileTreeHtml = renderHost({
      id: 'node-file-tree-1',
      componentType: 'builtin.file-tree',
      componentVersion: '1.0.0',
      title: 'Repo',
      bounds: {
        x: 12,
        y: 16,
        width: 360,
        height: 280
      },
      config: {
        rootDir: '/tmp/ws-1'
      },
      state: {},
      capabilities: ['read', 'listChildren'],
      createdAtMs: 5,
      updatedAtMs: 6
    });
    const portalHtml = renderHost({
      id: 'node-portal-1',
      componentType: 'builtin.portal',
      componentVersion: '1.0.0',
      title: 'Portal',
      bounds: {
        x: 20,
        y: 24,
        width: 420,
        height: 320
      },
      config: {
        url: 'https://example.com'
      },
      state: {},
      capabilities: ['navigate', 'capture', 'input'],
      createdAtMs: 7,
      updatedAtMs: 8
    });

    expect(fileTreeHtml).toContain('builtin-node-frame-node-file-tree-1');
    expect(fileTreeHtml).toContain('Workspace root');
    expect(fileTreeHtml).toContain('Branch workspace');
    expect(fileTreeHtml).toContain('file-tree-root-node-file-tree-1');
    expect(fileTreeHtml).toContain('/tmp/ws-1');
    expect(portalHtml).toContain('builtin-node-frame-node-portal-1');
    expect(portalHtml).toContain('Open page');
    expect(portalHtml).toContain('Read structure');
    expect(portalHtml).toContain('portal-url-input-node-portal-1');
    expect(portalHtml).toContain('Capture screenshot');
  });

  it('renders bounded text and attachment hosts from graph node data', () => {
    const textHtml = renderHost({
      id: 'node-text-1',
      componentType: 'builtin.text',
      componentVersion: '1.0.0',
      title: 'Text',
      bounds: {
        x: 8,
        y: 8,
        width: 320,
        height: 220
      },
      config: {
        mode: 'plain'
      },
      state: {
        content: 'hello text'
      },
      capabilities: ['read'],
      createdAtMs: 9,
      updatedAtMs: 10
    });
    const attachmentHtml = renderHost({
      id: 'node-attachment-1',
      componentType: 'builtin.attachment',
      componentVersion: '1.0.0',
      title: 'Attachment',
      bounds: {
        x: 16,
        y: 18,
        width: 360,
        height: 240
      },
      config: {},
      state: {
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1234
          },
          {
            id: 'att-2',
            path: '/tmp/notes.txt'
          }
        ]
      },
      capabilities: ['read'],
      createdAtMs: 11,
      updatedAtMs: 12
    });

    expect(textHtml).toContain('builtin-node-frame-node-text-1');
    expect(textHtml).toContain('text-host-content-node-text-1');
    expect(textHtml).toContain('Read only');
    expect(textHtml).toContain('hello text');
    expect(attachmentHtml).toContain('attachment-host-node-attachment-1');
    expect(attachmentHtml).toContain('design.pdf');
    expect(attachmentHtml).toContain('notes.txt');
  });
});

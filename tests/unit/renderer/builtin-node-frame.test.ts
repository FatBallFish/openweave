import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BuiltinNodeFrame } from '../../../src/renderer/features/components/host-shell/BuiltinNodeFrame';

describe('builtin node frame', () => {
  it('renders shared header, body, and footer anatomy for builtin nodes', () => {
    const html = renderToStaticMarkup(
      createElement(BuiltinNodeFrame, {
        nodeId: 'node-note-1',
        title: 'Note',
        subtitle: 'Editable markdown',
        iconLabel: 'NT',
        state: 'default',
        stateLabel: 'Ready',
        footer: 'Draft ready',
        children: createElement('div', { 'data-testid': 'builtin-node-frame-body' }, 'Body')
      })
    );

    expect(html).toContain('builtin-node-frame-node-note-1');
    expect(html).toContain('builtin-node-header-node-note-1');
    expect(html).toContain('builtin-node-footer-node-note-1');
    expect(html).toContain('Editable markdown');
    expect(html).toContain('Draft ready');
  });
});

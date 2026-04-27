import { describe, expect, it } from 'vitest';
import {
  TerminalOutputSanitizer,
  sanitizeTerminalOutputForScrollback
} from '../../../src/renderer/features/terminal/ansi-output';

describe('sanitizeTerminalOutputForScrollback', () => {
  it('removes alternate-screen buffer switches so managed TUI history stays in scrollback', () => {
    expect(sanitizeTerminalOutputForScrollback('a\u001b[?1049hb\u001b[?1049lc')).toBe('abc');
    expect(sanitizeTerminalOutputForScrollback('a\u001b[?47hb\u001b[?47lc')).toBe('abc');
    expect(sanitizeTerminalOutputForScrollback('a\u001b[?1047hb\u001b[?1047lc')).toBe('abc');
  });

  it('removes erase-scrollback commands without removing normal viewport clears', () => {
    expect(sanitizeTerminalOutputForScrollback('a\u001b[3Jb\u001b[2Jc')).toBe('ab\u001b[2Jc');
  });

  it('removes protected sequences split across stream chunks', () => {
    const sanitizer = new TerminalOutputSanitizer();
    expect(sanitizer.sanitize('a\u001b[?10')).toBe('a');
    expect(sanitizer.sanitize('49hb')).toBe('b');
    expect(sanitizer.sanitize('c\u001b[3')).toBe('c');
    expect(sanitizer.sanitize('Jd')).toBe('d');
  });
});

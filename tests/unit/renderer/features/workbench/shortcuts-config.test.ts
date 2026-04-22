import { describe, expect, it, vi } from 'vitest';
import {
  configsEqual,
  formatShortcut,
  getMergedConfig,
  SHORTCUT_DEFINITIONS
} from '../../../../../src/renderer/features/workbench/shortcuts-config';

describe('shortcuts-config', () => {
  describe('SHORTCUT_DEFINITIONS', () => {
    it('has 12 definitions', () => {
      expect(SHORTCUT_DEFINITIONS).toHaveLength(12);
    });

    it('has unique ids', () => {
      const ids = SHORTCUT_DEFINITIONS.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('formatShortcut', () => {
    it('formats macOS shortcuts with symbols', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(formatShortcut({ key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe('⌘K');
      expect(formatShortcut({ key: 'i', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false })).toBe('⇧⌘I');
      vi.unstubAllGlobals();
    });

    it('formats Windows shortcuts with labels', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(formatShortcut({ key: 'k', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false })).toBe('Ctrl+K');
      vi.unstubAllGlobals();
    });

    it('formats Windows shortcuts with multiple modifiers', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(formatShortcut({ key: 'i', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false })).toBe('Ctrl+Shift+I');
      vi.unstubAllGlobals();
    });
  });

  describe('configsEqual', () => {
    it('returns true for identical configs', () => {
      const a = { key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      const b = { key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      expect(configsEqual(a, b)).toBe(true);
    });

    it('is case-insensitive on key', () => {
      const a = { key: 'K', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      const b = { key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      expect(configsEqual(a, b)).toBe(true);
    });

    it('returns false for different modifiers', () => {
      const a = { key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      const b = { key: 'k', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false };
      expect(configsEqual(a, b)).toBe(false);
    });

    it('returns false for different keys', () => {
      const a = { key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      const b = { key: 'j', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      expect(configsEqual(a, b)).toBe(false);
    });
  });

  describe('getMergedConfig', () => {
    it('returns default when no override exists', () => {
      const config = getMergedConfig('open-command-palette', {});
      expect(config.key).toBe('k');
      expect(config.metaKey).toBe(true);
    });

    it('returns override when present', () => {
      const override = { key: 'p', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
      const config = getMergedConfig('open-command-palette', { 'open-command-palette': override });
      expect(config.key).toBe('p');
    });

    it('returns empty config for unknown id', () => {
      const config = getMergedConfig('nonexistent', {});
      expect(config.key).toBe('');
    });
  });
});

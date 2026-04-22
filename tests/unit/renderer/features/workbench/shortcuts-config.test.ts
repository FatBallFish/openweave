import { describe, expect, it } from 'vitest';
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
      const originalPlatform = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
      Object.defineProperty(globalThis, 'navigator', {
        value: { platform: 'MacIntel' },
        configurable: true
      });

      expect(formatShortcut({ key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe('⌘K');
      expect(formatShortcut({ key: 'i', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false })).toBe('⇧⌘I');

      if (originalPlatform) {
        Object.defineProperty(globalThis, 'navigator', originalPlatform);
      }
    });

    it('formats Windows shortcuts with labels', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
      Object.defineProperty(globalThis, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true
      });

      expect(formatShortcut({ key: 'k', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false })).toBe('Ctrl+K');

      if (originalPlatform) {
        Object.defineProperty(globalThis, 'navigator', originalPlatform);
      }
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
  });
});

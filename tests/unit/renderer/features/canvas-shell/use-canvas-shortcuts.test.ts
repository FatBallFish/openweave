import { describe, expect, it, beforeEach } from 'vitest';
import { getCanvasShortcutAction } from '../../../../../src/renderer/features/canvas-shell/useCanvasShortcuts';
import { settingsStore } from '../../../../../src/renderer/features/workbench/settings.store';

describe('getCanvasShortcutAction', () => {
  beforeEach(() => {
    settingsStore.resetAllShortcuts();
  });

  const mockEvent = (opts: Partial<KeyboardEvent> & { key: string }): Parameters<typeof getCanvasShortcutAction>[0] => ({
    key: opts.key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    target: null
  });

  it('returns null for editable targets', () => {
    const fakeInput = { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget;
    const event = { ...mockEvent({ key: 'k', metaKey: true }), target: fakeInput };
    expect(getCanvasShortcutAction(event)).toBeNull();
  });

  it('returns null for non-matching keys', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'x' }))).toBeNull();
  });

  it('returns null for contenteditable targets', () => {
    const target = { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget;
    const event = { ...mockEvent({ key: 'k', metaKey: true }), target };
    expect(getCanvasShortcutAction(event)).toBeNull();
  });

  it('matches open-command-palette on Cmd+K', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'k', metaKey: true }))).toBe('open-command-palette');
  });

  it('matches open-quick-add on /', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: '/' }))).toBe('open-quick-add');
  });

  it('matches toggle-inspector on Cmd+Shift+I', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'i', metaKey: true, shiftKey: true }))).toBe('toggle-inspector');
  });

  it('matches escape', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'Escape' }))).toBe('escape');
  });

  it('matches add-terminal on 1', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: '1' }))).toBe('add-terminal');
  });

  it('matches add-note on 2', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: '2' }))).toBe('add-note');
  });

  it('matches add-portal on 3', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: '3' }))).toBe('add-portal');
  });

  it('matches add-file-tree on 4', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: '4' }))).toBe('add-file-tree');
  });

  it('matches add-text on 5', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: '5' }))).toBe('add-text');
  });

  it('matches delete on Backspace', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'Backspace' }))).toBe('delete-selected');
  });

  it('matches delete on Delete', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'Delete' }))).toBe('delete-selected');
  });

  it('matches undo on Cmd+Z', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'z', metaKey: true }))).toBe('undo');
  });

  it('matches redo on Cmd+Shift+Z', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'z', metaKey: true, shiftKey: true }))).toBe('redo');
  });

  it('matches redo on Cmd+Y', () => {
    expect(getCanvasShortcutAction(mockEvent({ key: 'y', metaKey: true }))).toBe('redo');
  });

  it('respects user overrides', () => {
    settingsStore.setShortcut('open-command-palette', { key: 'p', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false });
    expect(getCanvasShortcutAction(mockEvent({ key: 'k', metaKey: true }))).toBeNull();
    expect(getCanvasShortcutAction(mockEvent({ key: 'p', metaKey: true }))).toBe('open-command-palette');
  });
});

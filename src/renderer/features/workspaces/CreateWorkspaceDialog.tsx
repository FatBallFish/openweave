import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkspaceGroupRecord, WorkspaceRecord } from '../../../shared/ipc/contracts';
import type { WorkspaceCreateInput, WorkspaceUpdateInput } from '../../../shared/ipc/schemas';
import { useI18n } from '../../i18n/provider';
import {
  DEFAULT_WORKSPACE_ICON_COLOR,
  DEFAULT_WORKSPACE_ICON_KEY,
  WORKSPACE_COLOR_OPTIONS,
  WORKSPACE_ICON_OPTIONS,
  WorkspaceGlyph,
  normalizeWorkspaceIconColor,
  normalizeWorkspaceIconKey
} from './workspace-icons';

interface CreateWorkspaceDialogProps {
  open: boolean;
  loading: boolean;
  mode: 'create' | 'edit';
  workspace: WorkspaceRecord | null;
  groups: WorkspaceGroupRecord[];
  onCancel: () => void;
  onPickDirectory: (initialPath?: string) => Promise<string | null>;
  onCreate: (input: WorkspaceCreateInput) => Promise<void>;
  onUpdate: (input: WorkspaceUpdateInput) => Promise<void>;
}

export const CreateWorkspaceDialog = ({
  open,
  loading,
  mode,
  workspace,
  groups,
  onCancel,
  onPickDirectory,
  onCreate,
  onUpdate
}: CreateWorkspaceDialogProps): JSX.Element | null => {
  const { t } = useI18n();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [iconKey, setIconKey] = useState(DEFAULT_WORKSPACE_ICON_KEY);
  const [iconColor, setIconColor] = useState(DEFAULT_WORKSPACE_ICON_COLOR);
  const [groupId, setGroupId] = useState('');

  const isCustomColor = !WORKSPACE_COLOR_OPTIONS.some(
    (c) => c.toUpperCase() === iconColor.toUpperCase()
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && workspace) {
      setName(workspace.name);
      setRootDir(workspace.rootDir);
      setIconKey(normalizeWorkspaceIconKey(workspace.iconKey));
      setIconColor(normalizeWorkspaceIconColor(workspace.iconColor));
      setGroupId(workspace.groupId ?? '');
      return;
    }

    setName('');
    setRootDir('');
    setIconKey(DEFAULT_WORKSPACE_ICON_KEY);
    setIconColor(DEFAULT_WORKSPACE_ICON_COLOR);
    setGroupId('');
  }, [mode, open, workspace]);

  if (!open) {
    return null;
  }

  if (mode === 'edit' && !workspace) {
    return null;
  }

  const dialogTitle = mode === 'create' ? t('workspace.dialog.createTitle') : t('workspace.dialog.editTitle');
  const submitLabel = mode === 'create' ? t('workspace.dialog.createSubmit') : t('workspace.dialog.editSubmit');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedInput = {
      name: name.trim(),
      rootDir: rootDir.trim(),
      iconKey: normalizeWorkspaceIconKey(iconKey),
      iconColor: normalizeWorkspaceIconColor(iconColor),
      groupId: groupId || undefined
    };

    if (mode === 'edit' && workspace) {
      await onUpdate({
        workspaceId: workspace.id,
        ...normalizedInput
      });
      return;
    }

    await onCreate(normalizedInput);
  };

  const handleBrowse = async (): Promise<void> => {
    const pickedDirectory = await onPickDirectory(rootDir || workspace?.rootDir || undefined);
    if (pickedDirectory) {
      setRootDir(pickedDirectory);
    }
  };

  const handleCustomColorClick = (): void => {
    colorInputRef.current?.click();
  };

  const customColorStyle: CSSProperties = isCustomColor
    ? { '--workspace-color': iconColor } as CSSProperties
    : {};

  const content = (
    <div className="ow-workspace-dialog" data-testid="create-workspace-dialog" role="dialog" aria-modal="true">
      <div className="ow-workspace-dialog__backdrop" onClick={loading ? undefined : onCancel} />
      <section className="ow-workspace-dialog__surface" aria-label={dialogTitle}>
        <header className="ow-workspace-dialog__header">
          <h2>{dialogTitle}</h2>
        </header>

        <form
          className="ow-workspace-dialog__form"
          onSubmit={(event) => void handleSubmit(event)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
              const target = e.target as HTMLElement;
              if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                e.preventDefault();
                target.select();
              }
            }
          }}
        >
          <label className="ow-workspace-dialog__field">
            <span>{t('workspace.dialog.nameLabel')}</span>
            <input
              data-testid="create-workspace-name-input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={1}
              autoFocus={true}
            />
          </label>

          <div className="ow-workspace-dialog__field">
            <span>{t('workspace.dialog.iconLabel')}</span>
            <div className="ow-workspace-icon-grid" role="radiogroup" aria-label={t('workspace.dialog.iconLabel')}>
              {WORKSPACE_ICON_OPTIONS.map((iconOption) => {
                const selected = iconOption.key === iconKey;
                return (
                  <button
                    key={iconOption.key}
                    type="button"
                    className={`ow-workspace-icon-grid__option${selected ? ' is-selected' : ''}`}
                    onClick={() => setIconKey(iconOption.key)}
                    title={iconOption.label}
                    aria-label={iconOption.label}
                    aria-pressed={selected}
                    data-testid={`workspace-icon-option-${iconOption.key}`}
                  >
                    <WorkspaceGlyph iconKey={iconOption.key} color={iconColor} muted={!selected} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ow-workspace-dialog__field">
            <span>{t('workspace.dialog.colorLabel')}</span>
            <div className="ow-workspace-color-picker">
              {WORKSPACE_COLOR_OPTIONS.map((color) => {
                const selected = color.toUpperCase() === iconColor.toUpperCase();
                return (
                  <button
                    key={color}
                    type="button"
                    className={`ow-workspace-color-picker__chip${selected ? ' is-selected' : ''}`}
                    aria-label={color}
                    aria-pressed={selected}
                    data-testid={`workspace-color-option-${color}`}
                    onClick={() => setIconColor(color)}
                    style={{ '--workspace-color': color } as CSSProperties}
                  />
                );
              })}
              <div className="ow-workspace-color-picker__divider" />
              <button
                className={`ow-workspace-color-picker__custom${isCustomColor ? ' is-selected' : ''}`}
                type="button"
                onClick={handleCustomColorClick}
                data-testid="workspace-custom-color-trigger"
                aria-label={t('workspace.dialog.customColor')}
                style={customColorStyle}
              />
              <input
                ref={colorInputRef}
                className="ow-workspace-color-picker__native"
                type="color"
                value={iconColor}
                onChange={(event) => setIconColor(event.currentTarget.value.toUpperCase())}
                data-testid="workspace-custom-color-input"
              />
            </div>
          </div>

          <div className="ow-workspace-dialog__field">
            <span>{t('workspace.dialog.rootDirLabel')}</span>
            <div className="ow-workspace-dialog__directory-row">
              <input
                data-testid="create-workspace-root-input"
                type="text"
                value={rootDir}
                required
                minLength={1}
                spellCheck={false}
                onChange={(event) => setRootDir(event.target.value)}
              />
              <button type="button" onClick={() => void handleBrowse()} disabled={loading}>
                {t('workspace.dialog.browse')}
              </button>
            </div>
          </div>

          <div className="ow-workspace-dialog__field">
            <label>{t('workspace.dialog.groupLabel')}</label>
            <select
              data-testid="create-workspace-group-select"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              <option value="">{t('workspace.group.none')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div className="ow-workspace-dialog__actions">
            <button
              className="ow-toolbar-button"
              data-testid="create-workspace-cancel"
              type="button"
              disabled={loading}
              onClick={onCancel}
            >
              {t('workspace.dialog.cancel')}
            </button>
            <button
              className="ow-toolbar-button ow-toolbar-button--primary"
              data-testid="create-workspace-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? t('workspace.dialog.saving') : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
};

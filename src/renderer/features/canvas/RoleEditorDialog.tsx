import { useState, useRef, useEffect } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import type { RoleRecord } from '../../../shared/ipc/contracts';
import { useI18n } from '../../i18n/provider';
import {
  WORKSPACE_COLOR_OPTIONS
} from '../workspaces/workspace-icons';

interface RoleEditorDialogProps {
  open: boolean;
  role: RoleRecord | null;
  onClose: () => void;
  onSave: (role: Omit<RoleRecord, 'id' | 'createdAtMs' | 'updatedAtMs'> & { id?: string }) => void;
}

const ICON_OPTIONS = ['😀', '💻', '⭐', '🧠', '⚙️', '📱', '📊', '🌐', '🔨', '⚡', '🎨', '🧪', '📊', '🚀', '🔒', '📁', '📄', '📦', '🛡️', '👁️', '✨', '📌', '🔧', '💡'];

export const RoleEditorDialog = ({ open, role, onClose, onSave }: RoleEditorDialogProps): JSX.Element | null => {
  const { t } = useI18n();
  const isEdit = role !== null;
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [icon, setIcon] = useState(role?.icon ?? ICON_OPTIONS[0]);
  const [color, setColor] = useState(role?.color ?? WORKSPACE_COLOR_OPTIONS[5]);

  useEffect(() => {
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setIcon(role?.icon ?? ICON_OPTIONS[0]);
    setColor(role?.color ?? WORKSPACE_COLOR_OPTIONS[5]);
  }, [role]);

  const isCustomColor = !WORKSPACE_COLOR_OPTIONS.some(
    (c) => c.toUpperCase() === color.toUpperCase()
  );

  if (!open) return null;

  const handleSave = (): void => {
    if (name.trim().length === 0) return;
    onSave({
      ...(isEdit ? { id: role.id } : {}),
      name: name.trim(),
      description,
      icon,
      color
    });
  };

  const dialogTitle = isEdit ? t('terminal.dialog.roleEditor.editTitle') : t('terminal.dialog.roleEditor.createTitle');

  const content = (
    <div className="ow-workspace-dialog ow-role-editor-dialog" role="dialog" aria-modal="true">
      <div className="ow-workspace-dialog__backdrop" onClick={onClose} />
      <section className="ow-workspace-dialog__surface" aria-label={dialogTitle}>
        <header className="ow-workspace-dialog__header">
          <h2>{dialogTitle}</h2>
        </header>

        <form
          className="ow-workspace-dialog__form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
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
            <span>{t('terminal.dialog.roleEditor.nameLabel')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder={t('terminal.dialog.roleEditor.nameLabel')}
            />
          </label>

          <label className="ow-workspace-dialog__field">
            <span>{t('terminal.dialog.roleEditor.descriptionLabel')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t('terminal.dialog.roleEditor.descriptionLabel')}
            />
          </label>

          <div className="ow-workspace-dialog__field">
            <span>{t('terminal.dialog.roleEditor.iconLabel')}</span>
            <div className="ow-role-icon-grid" role="grid" aria-label={t('terminal.dialog.roleEditor.iconLabel')}>
              {ICON_OPTIONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`ow-role-icon-grid__option${icon === i ? ' is-selected' : ''}`}
                  onClick={() => setIcon(i)}
                  aria-label={i}
                  aria-pressed={icon === i}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="ow-workspace-dialog__field">
            <span>{t('terminal.dialog.roleEditor.colorLabel')}</span>
            <div className="ow-workspace-color-picker">
              {WORKSPACE_COLOR_OPTIONS.map((c) => {
                const selected = c.toUpperCase() === color.toUpperCase();
                return (
                  <button
                    key={c}
                    type="button"
                    className={`ow-workspace-color-picker__chip${selected ? ' is-selected' : ''}`}
                    style={{ '--workspace-color': c } as React.CSSProperties}
                    onClick={() => setColor(c)}
                    aria-label={c}
                    aria-pressed={selected}
                  />
                );
              })}
              <div className="ow-workspace-color-picker__divider" />
              <button
                className={`ow-workspace-color-picker__custom${isCustomColor ? ' is-selected' : ''}`}
                type="button"
                onClick={() => colorInputRef.current?.click()}
                aria-label={t('workspace.dialog.customColor')}
                style={isCustomColor ? { '--workspace-color': color } as React.CSSProperties : {}}
              />
              <input
                ref={colorInputRef}
                className="ow-workspace-color-picker__native"
                type="color"
                value={color}
                onChange={(e) => setColor(e.currentTarget.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="ow-workspace-dialog__actions">
            <button className="ow-toolbar-button" type="button" onClick={onClose}>
              {t('terminal.dialog.roleEditor.cancel')}
            </button>
            <button
              className="ow-toolbar-button ow-toolbar-button--primary"
              type="submit"
              disabled={name.trim().length === 0}
            >
              {t('terminal.dialog.roleEditor.save')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  return createPortal(content, document.body);
};

import { useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import type { RoleRecord } from '../../../shared/ipc/contracts';
import { useI18n } from '../../i18n/provider';

interface RoleEditorDialogProps {
  open: boolean;
  role: RoleRecord | null;
  onClose: () => void;
  onSave: (role: Omit<RoleRecord, 'id' | 'createdAtMs' | 'updatedAtMs'> & { id?: string }) => void;
}

const ICON_OPTIONS = ['💻', '🐍', '⚛️', '🔧', '🐳', '🎨', '🧪', '📊', '🚀', '🔒'];
const COLOR_OPTIONS = ['#0078d4', '#e81123', '#107c10', '#ff8c00', '#881798', '#00b7c3', '#ffb900', '#5c2d91'];

export const RoleEditorDialog = ({ open, role, onClose, onSave }: RoleEditorDialogProps): JSX.Element | null => {
  const { t } = useI18n();
  const isEdit = role !== null;
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [icon, setIcon] = useState(role?.icon ?? ICON_OPTIONS[0]);
  const [color, setColor] = useState(role?.color ?? COLOR_OPTIONS[0]);

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
      <section className="ow-workspace-dialog__surface ow-workspace-dialog__surface--group" aria-label={dialogTitle}>
        <header className="ow-workspace-dialog__header">
          <h2>{dialogTitle}</h2>
        </header>

        <form
          className="ow-workspace-dialog__form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <label className="ow-workspace-dialog__field ow-role-editor-dialog__field">
            <span>{t('terminal.dialog.roleEditor.nameLabel')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <label className="ow-workspace-dialog__field ow-role-editor-dialog__field">
            <span>{t('terminal.dialog.roleEditor.descriptionLabel')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                border: '1px solid var(--ow-color-border)',
                borderRadius: 10,
                padding: '9px 10px',
                fontSize: 13,
                color: 'var(--ow-color-text-strong)',
                background: 'rgba(var(--ow-surface-rgb), 0.9)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </label>

          <div className="ow-workspace-dialog__field">
            <span>{t('terminal.dialog.roleEditor.iconLabel')}</span>
            <div className="ow-role-editor-dialog__icon-grid">
              {ICON_OPTIONS.map((i) => (
                <button
                  key={i}
                  className={`ow-role-editor-dialog__icon-option${icon === i ? ' is-active' : ''}`}
                  onClick={() => setIcon(i)}
                  type="button"
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="ow-workspace-dialog__field">
            <span>{t('terminal.dialog.roleEditor.colorLabel')}</span>
            <div className="ow-role-editor-dialog__color-grid">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  className={`ow-role-editor-dialog__color-option${color === c ? ' is-active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  type="button"
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="ow-workspace-dialog__actions ow-role-editor-dialog__footer">
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

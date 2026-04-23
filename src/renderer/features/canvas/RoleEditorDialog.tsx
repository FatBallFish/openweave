import { useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import type { RoleRecord } from '../../../shared/ipc/contracts';

interface RoleEditorDialogProps {
  open: boolean;
  role: RoleRecord | null;
  onClose: () => void;
  onSave: (role: Omit<RoleRecord, 'id' | 'createdAtMs' | 'updatedAtMs'> & { id?: string }) => void;
}

const ICON_OPTIONS = ['💻', '🐍', '⚛️', '🔧', '🐳', '🎨', '🧪', '📊', '🚀', '🔒'];
const COLOR_OPTIONS = ['#0078d4', '#e81123', '#107c10', '#ff8c00', '#881798', '#00b7c3', '#ffb900', '#5c2d91'];

export const RoleEditorDialog = ({ open, role, onClose, onSave }: RoleEditorDialogProps): JSX.Element | null => {
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

  const content = (
    <div className="ow-role-editor-dialog" role="dialog" aria-modal="true">
      <div className="ow-role-editor-dialog__backdrop" onClick={onClose} />
      <section className="ow-role-editor-dialog__surface">
        <header className="ow-role-editor-dialog__header">
          <h3>{isEdit ? 'Edit Role' : 'Create Role'}</h3>
          <button className="ow-role-editor-dialog__close" onClick={onClose} type="button">×</button>
        </header>

        <div className="ow-role-editor-dialog__body">
          <div className="ow-role-editor-dialog__field">
            <label>Role Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" />
          </div>

          <div className="ow-role-editor-dialog__field">
            <label>Role Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="ow-role-editor-dialog__field">
            <label>Icon</label>
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

          <div className="ow-role-editor-dialog__field">
            <label>Color</label>
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
        </div>

        <footer className="ow-role-editor-dialog__footer">
          <button onClick={onClose} type="button">Cancel</button>
          <button onClick={handleSave} type="button" disabled={name.trim().length === 0}>
            Save
          </button>
        </footer>
      </section>
    </div>
  );

  return createPortal(content, document.body);
};

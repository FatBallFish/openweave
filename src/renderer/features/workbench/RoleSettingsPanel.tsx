import { useState, useEffect } from 'react';
import type { RoleRecord } from '../../../shared/ipc/contracts';
import { RoleEditorDialog } from '../canvas/RoleEditorDialog';

export const RoleSettingsPanel = (): JSX.Element => {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);

  const loadRoles = async () => {
    try {
      const bridge = (window as any).openweaveShell;
      if (!bridge?.roles) return;
      const response = await bridge.roles.listRoles();
      setRoles(response.roles);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const handleCreate = () => {
    setEditingRole(null);
    setEditorOpen(true);
  };

  const handleEdit = (role: RoleRecord) => {
    setEditingRole(role);
    setEditorOpen(true);
  };

  const handleDelete = async (roleId: string) => {
    if (!window.confirm('Delete this role?')) return;
    try {
      const bridge = (window as any).openweaveShell;
      await bridge.roles.deleteRole({ id: roleId });
      await loadRoles();
    } catch {
      // ignore
    }
  };

  const handleSaveRole = async (roleData: Omit<RoleRecord, 'id' | 'createdAtMs' | 'updatedAtMs'> & { id?: string }) => {
    try {
      const bridge = (window as any).openweaveShell;
      if (roleData.id) {
        await bridge.roles.updateRole(roleData as RoleRecord);
      } else {
        await bridge.roles.createRole(roleData);
      }
      setEditorOpen(false);
      await loadRoles();
    } catch {
      // ignore
    }
  };

  return (
    <div className="ow-role-settings-panel">
      <div className="ow-role-settings-panel__grid">
        <button className="ow-role-settings-panel__new" onClick={handleCreate} type="button">
          <span>+</span>
          <span>New Role</span>
        </button>
        {roles.map((role) => (
          <div key={role.id} className="ow-role-settings-panel__card">
            <div className="ow-role-settings-panel__card-icon" style={{ color: role.color }}>
              {role.icon || '👤'}
            </div>
            <div className="ow-role-settings-panel__card-name">{role.name}</div>
            <div className="ow-role-settings-panel__card-actions">
              <button onClick={() => handleEdit(role)} type="button">Edit</button>
              <button onClick={() => handleDelete(role.id)} type="button">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <RoleEditorDialog
        open={editorOpen}
        role={editingRole}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveRole}
      />
    </div>
  );
};

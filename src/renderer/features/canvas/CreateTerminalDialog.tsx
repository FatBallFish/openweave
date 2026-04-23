import { useState, useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import type { RoleRecord } from '../../../shared/ipc/contracts';
import { RoleEditorDialog } from './RoleEditorDialog';

interface CreateTerminalDialogProps {
  open: boolean;
  workspaceRootDir: string;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}

const QUICK_START_PRESETS: Record<string, { command: string; runtime: string }> = {
  'claude-code': { command: 'claude', runtime: 'claude' },
  codex: { command: 'codex', runtime: 'codex' },
  opencode: { command: 'opencode', runtime: 'opencode' },
  shell: { command: '', runtime: 'shell' }
};

export const CreateTerminalDialog = ({ open, workspaceRootDir, onClose, onSave }: CreateTerminalDialogProps): JSX.Element | null => {
  const [activeTab, setActiveTab] = useState<'details' | 'appearance' | 'role'>('details');
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [runtime, setRuntime] = useState('shell');
  const [workingDir, setWorkingDir] = useState(workspaceRootDir);
  const [iconKey, setIconKey] = useState('');
  const [iconColor, setIconColor] = useState('#0078d4');
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);

  // Load roles when dialog opens
  useEffect(() => {
    if (!open) return;
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
    void loadRoles();
  }, [open]);

  const handleQuickStart = useCallback((preset: string) => {
    const config = QUICK_START_PRESETS[preset];
    if (config) {
      setCommand(config.command);
      setRuntime(config.runtime);
      setName(preset === 'shell' ? 'Shell' : preset);
    }
  }, []);

  const handleBrowse = useCallback(async () => {
    try {
      const bridge = (window as any).openweaveShell;
      if (!bridge?.workspaces?.pickWorkspaceDirectory) return;
      const result = await bridge.workspaces.pickWorkspaceDirectory({ initialPath: workingDir });
      if (result.directory) {
        setWorkingDir(result.directory);
      }
    } catch {
      // ignore
    }
  }, [workingDir]);

  const handleSave = useCallback(() => {
    onSave({
      title: name.trim() || undefined,
      command,
      runtime,
      workingDir,
      iconKey,
      iconColor,
      theme,
      fontFamily,
      fontSize,
      roleId: selectedRoleId
    });
  }, [name, command, runtime, workingDir, iconKey, iconColor, theme, fontFamily, fontSize, selectedRoleId, onSave]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  if (!open) return null;

  return createPortal(
    <div className="ow-create-terminal-dialog" role="dialog" aria-modal="true">
      <div className="ow-create-terminal-dialog__backdrop" onClick={onClose} />
      <section className="ow-create-terminal-dialog__surface">
        <header>
          <h2>New Terminal</h2>
        </header>

        {/* Quick Start */}
        <div className="ow-create-terminal-dialog__quick-start">
          {Object.keys(QUICK_START_PRESETS).map((preset) => (
            <button key={preset} onClick={() => handleQuickStart(preset)} type="button">
              {preset}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="ow-create-terminal-dialog__tabs">
          {(['details', 'appearance', 'role'] as const).map((tab) => (
            <button
              key={tab}
              className={`ow-create-terminal-dialog__tab${activeTab === tab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="ow-create-terminal-dialog__panel">
            <div className="ow-create-terminal-dialog__field">
              <label>Name</label>
              <input data-testid="create-terminal-name" value={name} onChange={(e) => setName(e.target.value)} type="text" />
            </div>
            <div className="ow-create-terminal-dialog__field">
              <label>Initial Command</label>
              <input data-testid="create-terminal-command" value={command} onChange={(e) => setCommand(e.target.value)} type="text" />
            </div>
            <div className="ow-create-terminal-dialog__field">
              <label>Working Directory</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input data-testid="create-terminal-working-dir" value={workingDir} onChange={(e) => setWorkingDir(e.target.value)} type="text" style={{ flex: 1 }} />
                <button onClick={handleBrowse} type="button">Browse</button>
              </div>
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="ow-create-terminal-dialog__panel">
            <div className="ow-create-terminal-dialog__field">
              <label>Icon</label>
              <input value={iconKey} onChange={(e) => setIconKey(e.target.value)} type="text" placeholder="Emoji or icon name" />
            </div>
            <div className="ow-create-terminal-dialog__field">
              <label>Icon Color</label>
              <input value={iconColor} onChange={(e) => setIconColor(e.target.value)} type="color" />
            </div>
            <div className="ow-create-terminal-dialog__field">
              <label>Theme</label>
              <select data-testid="create-terminal-theme" value={theme} onChange={(e) => setTheme(e.target.value as 'auto' | 'light' | 'dark')}>
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="ow-create-terminal-dialog__field">
              <label>Font Family</label>
              <input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} type="text" placeholder="monospace" />
            </div>
            <div className="ow-create-terminal-dialog__field">
              <label>Font Size</label>
              <input value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} type="number" min={8} max={72} />
            </div>
          </div>
        )}

        {/* Role Tab */}
        {activeTab === 'role' && (
          <div className="ow-create-terminal-dialog__panel">
            <p className="ow-create-terminal-dialog__label">Select Role</p>
            <div className="ow-role-grid">
              <button
                className="ow-role-grid__item ow-role-grid__new"
                onClick={() => { setEditingRole(null); setRoleEditorOpen(true); }}
                type="button"
              >
                <span>+</span>
                <span>New</span>
              </button>
              {roles.map((role) => (
                <button
                  key={role.id}
                  className={`ow-role-grid__item${selectedRoleId === role.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedRoleId(role.id)}
                  type="button"
                >
                  <div style={{ fontSize: 24 }}>{role.icon || '👤'}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>{role.name}</div>
                </button>
              ))}
            </div>

            {selectedRole && (
              <div className="ow-create-terminal-dialog__role-detail">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{selectedRole.name}</strong>
                  <button
                    onClick={() => { setEditingRole(selectedRole); setRoleEditorOpen(true); }}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#555', marginTop: 6 }}>{selectedRole.description}</p>
              </div>
            )}

            <p style={{ fontSize: 10, color: '#888', marginTop: 12 }}>
              Roles are managed by OpenWeave. A copy of instructions will be placed in the project's .openweave folder for agent startup.
              <br /><br />
              Suggestion: add .openweave to .gitignore.
            </p>
          </div>
        )}

        <footer className="ow-create-terminal-dialog__footer">
          <button onClick={onClose} type="button">Cancel</button>
          <button onClick={handleSave} type="button">Save</button>
        </footer>
      </section>

      <RoleEditorDialog
        open={roleEditorOpen}
        role={editingRole}
        onClose={() => setRoleEditorOpen(false)}
        onSave={async (roleData) => {
          try {
            const bridge = (window as any).openweaveShell;
            if (roleData.id) {
              await bridge.roles.updateRole(roleData);
            } else {
              await bridge.roles.createRole(roleData);
            }
            setRoleEditorOpen(false);
            const response = await bridge.roles.listRoles();
            setRoles(response.roles);
          } catch {
            // ignore
          }
        }}
      />
    </div>,
    document.body
  );
};

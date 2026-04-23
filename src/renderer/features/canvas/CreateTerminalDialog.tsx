import { useState, useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import type { RoleRecord } from '../../../shared/ipc/contracts';
import { useI18n } from '../../i18n/provider';
import { RoleEditorDialog } from './RoleEditorDialog';
import {
  DEFAULT_WORKSPACE_ICON_COLOR,
  WORKSPACE_COLOR_OPTIONS,
  WORKSPACE_ICON_OPTIONS,
  WorkspaceGlyph,
  normalizeWorkspaceIconColor,
  normalizeWorkspaceIconKey
} from '../workspaces/workspace-icons';

interface CreateTerminalDialogProps {
  open: boolean;
  workspaceRootDir: string;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}

const QUICK_START_PRESETS: Record<string, { command: string; runtime: string; name: string }> = {
  'claude-code': { command: '', runtime: 'claude', name: 'Claude Code' },
  codex: { command: '', runtime: 'codex', name: 'Codex' },
  opencode: { command: '', runtime: 'opencode', name: 'OpenCode' },
  shell: { command: '', runtime: 'shell', name: 'Shell' }
};

export const CreateTerminalDialog = ({ open, workspaceRootDir, onClose, onSave }: CreateTerminalDialogProps): JSX.Element | null => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'details' | 'appearance' | 'role'>('details');
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [runtime, setRuntime] = useState('shell');
  const [workingDir, setWorkingDir] = useState(workspaceRootDir);
  const [iconKey, setIconKey] = useState('');
  const [iconColor, setIconColor] = useState(DEFAULT_WORKSPACE_ICON_COLOR);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);

  // Reset form and sync workingDir when dialog opens
  useEffect(() => {
    if (!open) return;
    setActiveTab('details');
    setName('');
    setCommand('');
    setRuntime('shell');
    setWorkingDir(workspaceRootDir);
    setIconKey('');
    setIconColor(DEFAULT_WORKSPACE_ICON_COLOR);
    setTheme('auto');
    setFontFamily('');
    setFontSize(14);
    setSelectedRoleId(null);
  }, [open, workspaceRootDir]);

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
      setName(config.name);
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

  const isCustomColor = !WORKSPACE_COLOR_OPTIONS.some(
    (c) => c.toUpperCase() === iconColor.toUpperCase()
  );

  if (!open) return null;

  const dialogTitle = t('terminal.dialog.createTitle');

  const content = (
    <div className="ow-workspace-dialog ow-create-terminal-dialog" role="dialog" aria-modal="true" data-testid="create-terminal-dialog">
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
        >
          {/* Quick Start */}
          <div className="ow-workspace-dialog__field">
            <span>{t('terminal.dialog.quickStart')}</span>
            <div className="ow-terminal-quick-start">
              {Object.entries(QUICK_START_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  className="ow-terminal-quick-start__btn"
                  onClick={() => handleQuickStart(key)}
                  data-testid={`quick-start-${key}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="ow-workspace-dialog__divider" />

          {/* Tabs */}
          <div className="ow-terminal-dialog__tabs">
            {(['details', 'appearance', 'role'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`ow-terminal-dialog__tab${activeTab === tab ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab)}
                data-testid={`terminal-tab-${tab}`}
              >
                {t(`terminal.dialog.tab.${tab}`)}
              </button>
            ))}
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
            <>
              <label className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.nameLabel')}</span>
                <input
                  data-testid="create-terminal-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.commandLabel')}</span>
                <input
                  data-testid="create-terminal-command"
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                />
              </label>

              <div className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.workingDirLabel')}</span>
                <div className="ow-workspace-dialog__directory-row">
                  <input
                    data-testid="create-terminal-working-dir"
                    type="text"
                    value={workingDir}
                    spellCheck={false}
                    onChange={(e) => setWorkingDir(e.target.value)}
                  />
                  <button type="button" onClick={() => void handleBrowse()}>
                    {t('terminal.dialog.browse')}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <>
              <div className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.iconLabel')}</span>
                <div className="ow-workspace-icon-grid" role="radiogroup" aria-label={t('terminal.dialog.iconLabel')}>
                  {WORKSPACE_ICON_OPTIONS.map((iconOption) => {
                    const selected = iconOption.key === (iconKey || normalizeWorkspaceIconKey(''));
                    return (
                      <button
                        key={iconOption.key}
                        type="button"
                        className={`ow-workspace-icon-grid__option${selected ? ' is-selected' : ''}`}
                        onClick={() => setIconKey(iconOption.key)}
                        title={iconOption.label}
                        aria-label={iconOption.label}
                        aria-pressed={selected}
                      >
                        <WorkspaceGlyph iconKey={iconOption.key} color={iconColor} muted={!selected} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.colorLabel')}</span>
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
                        onClick={() => setIconColor(color)}
                        style={{ '--workspace-color': color } as React.CSSProperties}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.themeLabel')}</span>
                <select
                  data-testid="create-terminal-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'auto' | 'light' | 'dark')}
                >
                  <option value="auto">{t('terminal.dialog.theme.auto')}</option>
                  <option value="light">{t('terminal.dialog.theme.light')}</option>
                  <option value="dark">{t('terminal.dialog.theme.dark')}</option>
                </select>
              </div>

              <label className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.fontFamilyLabel')}</span>
                <input
                  type="text"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  placeholder="monospace"
                />
              </label>

              <label className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.fontSizeLabel')}</span>
                <input
                  type="number"
                  min={8}
                  max={72}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </label>
            </>
          )}

          {/* Role Tab */}
          {activeTab === 'role' && (
            <>
              <div className="ow-workspace-dialog__field">
                <span>{t('terminal.dialog.role.select')}</span>
                <div className="ow-role-grid">
                  <button
                    className="ow-role-grid__item ow-role-grid__new"
                    onClick={() => { setEditingRole(null); setRoleEditorOpen(true); }}
                    type="button"
                  >
                    <span>+</span>
                    <span>{t('terminal.dialog.role.new')}</span>
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
              </div>

              {selectedRole && (
                <div className="ow-terminal-dialog__role-detail">
                  <div className="ow-terminal-dialog__role-header">
                    <strong>{selectedRole.name}</strong>
                    <button
                      className="ow-toolbar-button"
                      onClick={() => { setEditingRole(selectedRole); setRoleEditorOpen(true); }}
                      type="button"
                    >
                      {t('terminal.dialog.role.edit')}
                    </button>
                  </div>
                  <p className="ow-terminal-dialog__role-desc">{selectedRole.description}</p>
                </div>
              )}

              <p className="ow-terminal-dialog__role-tip">{t('terminal.dialog.role.tip')}</p>
            </>
          )}

          <div className="ow-workspace-dialog__divider" />

          <div className="ow-workspace-dialog__actions">
            <button
              className="ow-toolbar-button"
              data-testid="create-terminal-cancel"
              type="button"
              onClick={onClose}
            >
              {t('terminal.dialog.cancel')}
            </button>
            <button
              className="ow-toolbar-button ow-toolbar-button--primary"
              data-testid="create-terminal-submit"
              type="submit"
            >
              {t('terminal.dialog.save')}
            </button>
          </div>
        </form>
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
    </div>
  );

  return createPortal(content, document.body);
};

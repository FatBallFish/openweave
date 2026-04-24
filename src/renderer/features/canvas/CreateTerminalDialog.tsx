import { useState, useCallback, useEffect, useRef } from 'react';
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
  mode?: 'create' | 'edit';
  initialConfig?: Record<string, unknown> | null;
  workspaceRootDir: string;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}

const DEFAULT_TERMINAL_ICON_KEY = WORKSPACE_ICON_OPTIONS[1]?.key ?? 'terminal';
const PRESET_COLORS: Record<string, string> = {
  claude: WORKSPACE_COLOR_OPTIONS[1] ?? '#F97316',
  codex: WORKSPACE_COLOR_OPTIONS[5] ?? '#3B82F6',
  opencode: WORKSPACE_COLOR_OPTIONS[3] ?? '#22C55E'
};

interface QuickStartPreset {
  command: string;
  runtime: string;
  name: string;
  icon: JSX.Element;
}

const QuickStartClaudeIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 4.9L20 9.5l-4 3.9.9 5.5L12 15.3l-4.9 2.4.9-5.5L4 9.5l5.6-.9Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const QuickStartCodexIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const QuickStartOpenCodeIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);

const QuickStartShellIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const QUICK_START_PRESETS: Record<string, QuickStartPreset> = {
  'claude-code': { command: 'claude', runtime: 'claude', name: 'Claude Code', icon: <QuickStartClaudeIcon /> },
  codex: { command: 'codex', runtime: 'codex', name: 'Codex', icon: <QuickStartCodexIcon /> },
  opencode: { command: 'opencode', runtime: 'opencode', name: 'OpenCode', icon: <QuickStartOpenCodeIcon /> },
  shell: { command: '', runtime: 'shell', name: 'Shell', icon: <QuickStartShellIcon /> }
};

export const CreateTerminalDialog = ({ open, mode = 'create', initialConfig, workspaceRootDir, onClose, onSave }: CreateTerminalDialogProps): JSX.Element | null => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'details' | 'appearance' | 'role'>('details');
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [runtime, setRuntime] = useState('shell');
  const [workingDir, setWorkingDir] = useState(workspaceRootDir);
  const [iconKey, setIconKey] = useState('');
  const [iconColor, setIconColor] = useState(DEFAULT_WORKSPACE_ICON_COLOR);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);

  // Reset form and sync workingDir when dialog opens
  useEffect(() => {
    if (!open) return;
    setActiveTab('details');
    if (mode === 'edit' && initialConfig) {
      setName(typeof initialConfig.title === 'string' ? initialConfig.title : '');
      setCommand(typeof initialConfig.command === 'string' ? initialConfig.command : '');
      setRuntime(typeof initialConfig.runtime === 'string' ? initialConfig.runtime : 'shell');
      setWorkingDir(typeof initialConfig.workingDir === 'string' ? initialConfig.workingDir : workspaceRootDir);
      setIconKey(typeof initialConfig.iconKey === 'string' ? initialConfig.iconKey : '');
      setIconColor(typeof initialConfig.iconColor === 'string' ? initialConfig.iconColor : DEFAULT_WORKSPACE_ICON_COLOR);
      setTheme(initialConfig.theme === 'light' || initialConfig.theme === 'dark' ? initialConfig.theme : 'auto');
      setFontFamily(typeof initialConfig.fontFamily === 'string' ? initialConfig.fontFamily : '');
      setFontSize(typeof initialConfig.fontSize === 'number' ? initialConfig.fontSize : 14);
      setSelectedRoleId(typeof initialConfig.roleId === 'string' ? initialConfig.roleId : null);
    } else {
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
    }
    setRoleSearch('');
  }, [open, workspaceRootDir, mode, initialConfig]);

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
      setIconKey(DEFAULT_TERMINAL_ICON_KEY);
      setIconColor(PRESET_COLORS[config.runtime] ?? DEFAULT_WORKSPACE_ICON_COLOR);
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

  const dialogTitle = mode === 'edit' ? t('terminal.dialog.editTitle') : t('terminal.dialog.createTitle');

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
          {mode === 'create' && (
            <>
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
                      {preset.icon}
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ow-workspace-dialog__divider" />
            </>
          )}

          {/* Tabs */}
          <div className="ow-terminal-dialog__tabs">
            {(['details', 'appearance', ...(mode === 'create' ? ['role'] as const : [])] as const).map((tab) => (
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

              {mode === 'create' && (
                <label className="ow-workspace-dialog__field">
                  <span>{t('terminal.dialog.commandLabel')}</span>
                  <input
                    data-testid="create-terminal-command"
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                  />
                </label>
              )}

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
                  <div className="ow-workspace-color-picker__divider" />
                  <button
                    className={`ow-workspace-color-picker__custom${isCustomColor ? ' is-selected' : ''}`}
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    aria-label={t('workspace.dialog.customColor')}
                    style={isCustomColor ? { '--workspace-color': iconColor } as React.CSSProperties : {}}
                  />
                  <input
                    ref={colorInputRef}
                    className="ow-workspace-color-picker__native"
                    type="color"
                    value={iconColor}
                    onChange={(e) => setIconColor(e.currentTarget.value.toUpperCase())}
                  />
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
                <input
                  type="text"
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder={t('terminal.dialog.role.select')}
                  className="ow-role-search"
                />
                <div className="ow-role-grid">
                  <button
                    className="ow-role-grid__item ow-role-grid__new"
                    onClick={() => { setEditingRole(null); setRoleEditorOpen(true); }}
                    type="button"
                  >
                    <span>+</span>
                    <span>{t('terminal.dialog.role.new')}</span>
                  </button>
                  {roles
                    .filter((role) => {
                      const q = roleSearch.trim().toLowerCase();
                      if (!q) return true;
                      return role.name.toLowerCase().includes(q) || role.description.toLowerCase().includes(q);
                    })
                    .map((role) => (
                      <button
                        key={role.id}
                        className={`ow-role-grid__item${selectedRoleId === role.id ? ' is-active' : ''}`}
                        onClick={() => setSelectedRoleId((prev) => (prev === role.id ? null : role.id))}
                        type="button"
                      >
                        <div style={{ fontSize: 24 }}>{role.icon || '👤'}</div>
                        <div style={{ fontSize: 11, marginTop: 4, fontWeight: 500 }}>{role.name}</div>
                      </button>
                    ))}
                </div>
              </div>

              {selectedRole && (
                <div className="ow-terminal-dialog__role-detail">
                  <div className="ow-terminal-dialog__role-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{selectedRole.icon || '👤'}</span>
                      <strong>{selectedRole.name}</strong>
                    </div>
                    <button
                      className="ow-role-edit-icon-btn"
                      onClick={() => { setEditingRole(selectedRole); setRoleEditorOpen(true); }}
                      type="button"
                      aria-label={t('terminal.dialog.role.edit')}
                      title={t('terminal.dialog.role.edit')}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
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

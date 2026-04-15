import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';

export const App = (): JSX.Element => {
  return (
    <main
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
        margin: '48px auto',
        maxWidth: '640px',
        lineHeight: 1.4
      }}
    >
      <h1 data-testid="app-shell-title">OpenWeave</h1>
      <p data-testid="app-shell-subtitle">Electron shell ready for MVP tasks.</p>
      <WorkspaceListPage />
    </main>
  );
};

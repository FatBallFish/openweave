import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import '@xterm/xterm/css/xterm.css';
import './styles/tokens.css';
import './styles/workbench.css';
import { App } from './App';
import { I18nProvider } from './i18n/provider';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Renderer root element not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

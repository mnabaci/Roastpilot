import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { forwardErrors } from './lib/forward-errors';
import { rendererLogger } from './lib/renderer-logger';
import { AppProvider } from './state/AppProvider';
import { createAppStore } from './state/app-store';
import { syncWithMain } from './state/sync-with-main';
import './styles.css';

const api = window.roastpilot;
forwardErrors(window, api);
const logger = rendererLogger(api);
const store = createAppStore();
syncWithMain(api, store, logger.child('sync'));

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <AppProvider deps={{ api, store, logger }}>
      <App />
    </AppProvider>
  </StrictMode>,
);

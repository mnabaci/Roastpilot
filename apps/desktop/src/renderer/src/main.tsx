import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { forwardErrors } from './lib/forward-errors';
import { rendererLogger } from './lib/renderer-logger';
import { AppProvider } from './app/AppProvider';
import { createStores } from './stores/stores';
import { syncWithMain } from './app/sync-with-main';
import './styles.css';

const api = window.roastpilot;
forwardErrors(window, api);
const logger = rendererLogger(api);
const stores = createStores();
syncWithMain(api, stores, logger.child('sync'));

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <AppProvider deps={{ api, stores, logger }}>
      <App />
    </AppProvider>
  </StrictMode>,
);

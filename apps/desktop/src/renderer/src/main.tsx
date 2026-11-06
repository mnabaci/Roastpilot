import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { serializeError } from '@roastpilot/core';
import { App } from './app/App';
import { AppError } from './app/AppError';
import { ErrorBoundary } from './features/ErrorBoundary';
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
    {/* Last resort: if the frame itself fails, the whole window says so, with Emergency stop. */}
    <ErrorBoundary
      onError={(error, info) => {
        logger.error('renderer.app-failed', {
          error: serializeError(error),
          componentStack: info.componentStack,
        });
      }}
      fallback={(error) => (
        <AppError
          error={error}
          connected={stores.connection.getState().connection.status !== 'disconnected'}
          api={api}
          logger={logger}
        />
      )}
    >
      <AppProvider deps={{ api, stores, logger }}>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);

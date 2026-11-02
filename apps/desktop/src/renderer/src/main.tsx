import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { forwardErrors } from './lib/forward-errors';
import './styles.css';

forwardErrors(window, window.roastpilot);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

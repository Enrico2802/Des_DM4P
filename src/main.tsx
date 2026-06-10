import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './modules/settings';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root nicht gefunden');

createRoot(rootEl).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
);

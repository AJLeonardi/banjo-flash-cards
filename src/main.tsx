import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

registerSW({ immediate: true });

// The mic is released on pagehide; if the browser later restores this page from its
// back/forward cache, start fresh rather than show screens with no mic behind them.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

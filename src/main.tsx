import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully handle and suppress benign Vite/HMR WebSocket connection errors in sandbox
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = event.reason ? String(event.reason.message || event.reason) : '';
    if (
      reasonStr.toLowerCase().includes('websocket') ||
      reasonStr.toLowerCase().includes('vite') ||
      reasonStr.toLowerCase().includes('closed without opened')
    ) {
      event.preventDefault(); // Silence the rejection to prevent runtime overlays
      console.info('[HMR Handled] Benign WebSocket disconnection bypassed successfully.');
    }
  });

  window.addEventListener('error', (event) => {
    const errorStr = event.message || '';
    if (
      errorStr.toLowerCase().includes('websocket') ||
      errorStr.toLowerCase().includes('vite') ||
      errorStr.toLowerCase().includes('connection to')
    ) {
      event.preventDefault(); // Silence the network load failure
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


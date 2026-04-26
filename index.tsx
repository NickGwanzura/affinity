
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/app.css';
import App from './App';
import { initSentry } from './utils/sentry';

// Init before React mount so init-time render errors are captured.
// No-op when VITE_SENTRY_DSN is unset.
initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

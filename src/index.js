import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './components/App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Application root element not found.');
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  serviceWorkerRegistration.register({
    onUpdate: registration => {
      console.info('A new version is available. Refresh to apply the update.');
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    },
    onSuccess: () => {
      console.info('The app is ready for offline use.');
    },
  });
}

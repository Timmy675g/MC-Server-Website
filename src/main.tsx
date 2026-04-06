import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { resolveAndApplyInitialTheme } from './lib/theme';

function detectBasename(): string {
  if (typeof window === 'undefined') return '/';

  const host = window.location.hostname;
  if (!host.endsWith('github.io')) return '/';

  const [firstSegment] = window.location.pathname.split('/').filter(Boolean);
  return firstSegment ? `/${firstSegment}` : '/';
}

resolveAndApplyInitialTheme();

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={detectBasename()}>
    <App />
  </BrowserRouter>,
);

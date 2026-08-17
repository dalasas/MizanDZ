import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

// Detect if running inside Tauri Desktop container
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI_METADATA__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.origin.includes('tauri.localhost')
  );
}

// Intercept fetch requests ONLY when running inside Tauri Desktop container
if (isTauriEnvironment()) {
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const originalFetch = window.fetch;
      const customFetch = function (input: RequestInfo | URL, init?: RequestInit) {
        let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url.startsWith('/api/')) {
          url = `http://localhost:3000${url}`;
          if (typeof input === 'string') {
            input = url;
          } else if (input instanceof URL) {
            input = new URL(url);
          } else {
            input = new Request(url, input);
          }
        }

        return originalFetch.call(window, input, init);
      };

      try {
        window.fetch = customFetch;
      } catch {
        Object.defineProperty(window, 'fetch', {
          value: customFetch,
          writable: true,
          configurable: true,
        });
      }
    }
  } catch (e) {
    console.warn('Mizan DZ: window.fetch patching skipped in Tauri environment.', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);

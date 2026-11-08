import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createFinanceStore } from './app/FinanceContext';
import { removeLegacyDemo } from './adapters/storage/workspaceRegistry';
import './index.css';

const container = document.getElementById('root');
removeLegacyDemo();
const store = createFinanceStore();
void store.start();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void store.refresh();
  }
});

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
}

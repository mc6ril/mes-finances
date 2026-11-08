import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createFinanceStore } from './app/FinanceContext';
import './index.css';

const container = document.getElementById('root');
const store = createFinanceStore();
void store.start();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void store.settleDue();
  }
});

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
}

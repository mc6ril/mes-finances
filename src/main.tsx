import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createContainer } from './app/container';
import './index.css';

const root = document.getElementById('root');
const container = createContainer();
container.session.start();
void container.store.start();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void container.store.refresh();
    void container.session.refresh();
  }
});

if (root) {
  createRoot(root).render(
    <StrictMode>
      <App container={container} />
    </StrictMode>,
  );
}

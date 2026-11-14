import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createContainer } from './app/container';
import { bindUserData } from './core/usecases/dataSession';
import './index.css';

const root = document.getElementById('root');
const container = createContainer();
container.session.start();
// Données ouvertes une fois connecté (adresse confirmée), effacées de l'appareil à la déconnexion.
bindUserData({
  session: container.session,
  store: container.store,
  backend: container.backend,
  onError: (error) => container.sync.raise(error),
});

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

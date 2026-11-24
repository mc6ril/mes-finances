import { useSyncExternalStore } from 'react';

/** Sous le point `sm` de Tailwind (640 px). */
const QUERY = '(max-width: 639.98px)';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/**
 * Écran de téléphone. Pour les vues qui changent de structure (tableau → liste) :
 * une seule est rendue, au lieu de deux dont l'une serait masquée en CSS.
 */
export const useIsMobile = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );

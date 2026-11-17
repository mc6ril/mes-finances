import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { pageForPath, pages } from '@/ui/routing/pages';

const PRELOAD_ALL_DELAY_MS = 1500;

/**
 * Télécharge la page de l'adresse pendant l'ouverture des données, puis toutes les autres une
 * fois l'application affichée (`ready`) : la navigation reste immédiate, hors ligne compris.
 */
export const usePreloadPages = (ready: boolean) => {
  const { pathname } = useLocation();
  useEffect(() => {
    void pageForPath(pathname).preload();
  }, [pathname]);
  useEffect(() => {
    if (!ready) {
      return;
    }
    const timer = window.setTimeout(
      () => Object.values(pages).forEach((page) => void page.preload()),
      PRELOAD_ALL_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [ready]);
};

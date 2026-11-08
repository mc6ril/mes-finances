import { useLayoutEffect, useSyncExternalStore } from 'react';
import { CHART_INK, SERIES_DARK, SERIES_LIGHT } from '@/constants/misc';
import type { ThemePreference } from '@/core/model';
import { useFinanceState } from './FinanceContext';

const QUERY = '(prefers-color-scheme: dark)';

const subscribeToScheme = (listener: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};

const systemPrefersDark = () => window.matchMedia(QUERY).matches;

export type ResolvedTheme = 'light' | 'dark';

const resolve = (preference: ThemePreference, systemDark: boolean): ResolvedTheme => {
  if (preference === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return preference;
};

export const useResolvedTheme = (): ResolvedTheme => {
  const systemDark = useSyncExternalStore(subscribeToScheme, systemPrefersDark);
  const { dataset } = useFinanceState();
  return resolve(dataset?.settings.theme ?? 'system', systemDark);
};

export const useApplyTheme = (): void => {
  const theme = useResolvedTheme();
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
};

export const useChartTheme = () => {
  const theme = useResolvedTheme();
  if (theme === 'dark') {
    return { series: SERIES_DARK, ink: CHART_INK.dark };
  }
  return { series: SERIES_LIGHT, ink: CHART_INK.light };
};

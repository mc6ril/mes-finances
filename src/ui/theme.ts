import { CHART_INK, SERIES_DARK, SERIES_LIGHT } from '@/constants/misc';
import type { ThemePreference } from '@/core/model';

const QUERY = '(prefers-color-scheme: dark)';

export type ResolvedTheme = 'light' | 'dark';

export const subscribeToScheme = (listener: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};

export const systemPrefersDark = () => window.matchMedia(QUERY).matches;

export const resolveTheme = (preference: ThemePreference, systemDark: boolean): ResolvedTheme => {
  if (preference === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return preference;
};

export const applyTheme = (theme: ResolvedTheme): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
};

export const chartThemeOf = (theme: ResolvedTheme) => {
  if (theme === 'dark') {
    return { series: SERIES_DARK, ink: CHART_INK.dark };
  }
  return { series: SERIES_LIGHT, ink: CHART_INK.light };
};

/**
 * Tokens à passer en valeurs à du JavaScript (recharts, SVG, styles calculés), qui ne lit pas les
 * variables CSS. Tout le reste vient de tokens.css, par les classes Tailwind (text-ink, bg-surface…).
 */

/** Tailles de texte déclarées dans tokens.css (--text-*), à faire connaître à tailwind-merge. */
export const TEXT_SIZES = ['caption', 'figure', 'display'] as const;

/** Séries des graphiques, dans l'ordre d'attribution. */
export const SERIES_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];
export const SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];

/** Encre des graphiques : quadrillage, axes, textes et fond des étiquettes. */
export const CHART_INK = {
  light: { grid: '#e7e6e2', axis: '#77766f', text: '#52514e', surface: '#ffffff' },
  dark: { grid: '#2f2f2d', axis: '#8f8e86', text: '#c3c2b7', surface: '#1c1c1b' },
};

/** Part « Autres » d'un graphique, et pastille d'un compte sans couleur (stone-400). */
export const NEUTRAL_MARK = '#a8a29e';

/** Barres de gains et de pertes. */
export const GAIN_COLOR = '#1baf7a';
export const LOSS_COLOR = '#e34948';

/** Pastilles des membres d'un espace commun (blue-500, violet-400). */
export const MEMBER_COLORS = ['#3b82f6', '#a78bfa'];

/** Couleurs officielles du logo « G » (consignes de marque Google). */
export const GOOGLE_LOGO = { yellow: '#FFC107', red: '#FF3D00', green: '#4CAF50', blue: '#1976D2' };

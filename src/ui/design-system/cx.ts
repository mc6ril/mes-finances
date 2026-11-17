import { extendTailwindMerge } from 'tailwind-merge';
import { TEXT_SIZES } from './tokens';

/**
 * Sans cette extension, tailwind-merge prendrait text-caption pour une couleur de texte et
 * l'écarterait face à text-ink-muted : les tailles déclarées dans tokens.css doivent lui être connues.
 */
const merge = extendTailwindMerge({ extend: { theme: { text: [...TEXT_SIZES] } } });

/**
 * Assemble des classes Tailwind ; en cas de conflit (h-2 puis h-1.5), la dernière l'emporte.
 * Tailwind 4 ne garantit plus l'ordre des utilitaires dans la feuille de style : sans fusion,
 * une classe passée en surcharge pouvait être ignorée.
 */
export const cx = (...classes: (string | false | null | undefined)[]): string =>
  merge(classes.filter(Boolean).join(' '));

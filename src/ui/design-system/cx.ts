import { twMerge } from 'tailwind-merge';

/**
 * Assemble des classes Tailwind ; en cas de conflit (h-2 puis h-1.5), la dernière l'emporte.
 * Tailwind 4 ne garantit plus l'ordre des utilitaires dans la feuille de style : sans fusion,
 * une classe passée en surcharge pouvait être ignorée.
 */
export const cx = (...classes: (string | false | null | undefined)[]): string =>
  twMerge(classes.filter(Boolean).join(' '));

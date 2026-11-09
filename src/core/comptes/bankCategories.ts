import type { Category } from '@/core/shared/model';

/**
 * Catégories des exports bancaires (BoursoBank et banques au même référentiel)
 * vers les catégories de l'appli, par ordre de préférence. La première qui existe
 * dans l'espace (et n'est pas archivée) l'emporte. « Non catégorisé », les virements
 * et « Vie quotidienne - Autres » restent à classer à la main.
 */
const BANK_TO_APP: [RegExp, string[]][] = [
  [/^alimentation|supermarch|courses/, ['cat-courses']],
  [/^restaurants?|bars?\b|fast food/, ['cat-restaurants']],
  [/divertissement|^loisirs|culture|sport et loisirs/, ['cat-loisirs']],
  [/^energie|electricite|^eau\b/, ['cat-energie', 'cat-logement']],
  [/^loyer|^logement$|charges locatives/, ['cat-logement']],
  [/multimedia|telephon|internet/, ['cat-internet', 'cat-telephone', 'cat-abonnements']],
  [/^abonnements/, ['cat-abonnements', 'cat-internet']],
  [/assurance/, ['cat-assurances']],
  [/pharmacie|medecin|frais medicaux|^sante|mutuelle|optique|dentiste/, ['cat-sante']],
  [/animaux/, ['cat-animaux']],
  [/mobilier|electromenager|bricolage|jardinage|electronique|informatique/, ['cat-maison', 'cat-shopping']],
  [/vetements|bien etre|coiffeur|equipements sportifs|livres|bijoux|jouets|cadeaux/, ['cat-shopping', 'cat-divers']],
  [/carburant|entretien|reparation|parking|peage|taxis?\b|transports?/, ['cat-transports']],
  [/hebergement|hotel|agences? de voyages|voyages?$/, ['cat-voyages']],
  [/impots|taxes/, ['cat-impots']],
  [/^salaires?|remuneration/, ['cat-salaire']],
];

const normalize = (label: string): string =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Catégorie de l'appli pour la catégorie indiquée par la banque, ou null. */
export const categoryFromBankLabel = (bankLabel: string, categories: Category[]): string | null => {
  const key = normalize(bankLabel);
  if (!key) {
    return null;
  }
  const active = categories.filter((category) => !category.archived);
  const byName = active.find((category) => normalize(category.name) === key);
  if (byName) {
    return byName.id;
  }
  const candidates = BANK_TO_APP.find(([pattern]) => pattern.test(key))?.[1] ?? [];
  return candidates.find((id) => active.some((category) => category.id === id)) ?? null;
};

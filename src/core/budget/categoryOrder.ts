import type { Category, WorkspaceKind } from '../shared/model';
import { COMMON_CATEGORIES, DEFAULT_CATEGORIES } from '../shared/seed';

/**
 * Catégories proposées par les anciennes versions, dans leur ordre d'origine : les espaces
 * créés avant l'allègement des catégories de départ gardent le même ordre d'affichage.
 */
const LEGACY_ORDER: Record<WorkspaceKind, string[]> = {
  perso: [
    'cat-salaire',
    'cat-primes',
    'cat-remboursements',
    'cat-revenus-complementaires',
    'cat-autres-entrees',
    'cat-compte-commun',
    'cat-logement',
    'cat-assurances',
    'cat-abonnements',
    'cat-telephone',
    'cat-transports',
    'cat-courses',
    'cat-sante',
    'cat-impots',
    'cat-autres-charges',
    'cat-ep-livret-a',
    'cat-ep-ldds',
    'cat-ep-assurance-vie',
    'cat-ep-trade-republic',
    'cat-ep-immo',
    'cat-ep-autres',
    'cat-restaurants',
    'cat-shopping',
    'cat-loisirs',
    'cat-achats-en-ligne',
    'cat-cadeaux',
    'cat-voyages',
    'cat-exceptionnelles',
    'cat-divers',
  ],
  commun: [
    ...COMMON_CATEGORIES.filter((category) => category.group !== 'plaisir').map((category) => category.id),
    'cat-ep-vacances',
    'cat-ep-projets',
    'cat-ep-immo',
    ...COMMON_CATEGORIES.filter((category) => category.group === 'plaisir').map((category) => category.id),
  ],
};

const positions = (current: Category[], legacy: string[]) => {
  const ids = [...new Set([...legacy, ...current.map((category) => category.id)])];
  return new Map(ids.map((id, index) => [id, index]));
};

const REFERENCE: Record<WorkspaceKind, Map<string, number>> = {
  perso: positions(DEFAULT_CATEGORIES, LEGACY_ORDER.perso),
  commun: positions(COMMON_CATEGORIES, LEGACY_ORDER.commun),
};

/** Catégories dans l'ordre de départ du type d'espace, puis les catégories ajoutées par ordre alphabétique. */
export const orderCategories = (categories: Category[], kind: WorkspaceKind = 'perso'): Category[] => {
  const reference = REFERENCE[kind];
  const positionOf = (category: Category): number => reference.get(category.id) ?? Number.MAX_SAFE_INTEGER;
  return [...categories].sort(
    (a, b) => positionOf(a) - positionOf(b) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
};

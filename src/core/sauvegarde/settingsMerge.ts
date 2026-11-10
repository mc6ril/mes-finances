import type { Account, Category, Dataset, ImportRule } from '../shared/model';

export type SettingsMergeSummary = {
  rules: { added: number; updated: number };
  categories: { added: number; updated: number };
  accounts: { added: number; updated: number };
  household: boolean;
};

/** Comparaison indépendante de l'ordre des clés et des champs absents (`undefined`). */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
};

const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

const ruleKey = (rule: ImportRule): string =>
  rule.match.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Fusion par clé : l'élément du fichier remplace celui qui a la même clé, les autres sont gardés. */
const mergeBy = <T>(current: T[], incoming: T[], key: (item: T) => string) => {
  const incomingByKey = new Map(incoming.map((item) => [key(item), item]));
  const currentKeys = new Set(current.map(key));
  let updated = 0;
  const merged = current.map((item) => {
    const replacement = incomingByKey.get(key(item));
    if (!replacement) {
      return item;
    }
    if (!sameValue(replacement, item)) {
      updated += 1;
    }
    return replacement;
  });
  const added = incoming.filter((item) => !currentKeys.has(key(item)));
  return { merged: [...merged, ...added], added: added.length, updated };
};

/**
 * Reprend les réglages d'un fichier d'espace sans toucher aux opérations : règles d'import,
 * catégories, comptes (soldes et dates de départ) et foyer du commun. Rien n'est supprimé.
 */
export const mergeSettings = (
  current: Dataset,
  incoming: Dataset,
): { dataset: Dataset; summary: SettingsMergeSummary } => {
  const rules = mergeBy<ImportRule>(
    current.settings.importRules ?? [],
    incoming.settings.importRules ?? [],
    ruleKey,
  );
  // Une règle remplacée garde l'identifiant de celle qu'elle remplace.
  const ids = new Map((current.settings.importRules ?? []).map((rule) => [ruleKey(rule), rule.id]));
  const importRules = rules.merged.map((rule) => ({ ...rule, id: ids.get(ruleKey(rule)) ?? rule.id }));
  const categories = mergeBy<Category>(current.categories, incoming.categories, (category) => category.id);
  const accounts = mergeBy<Account>(current.accounts, incoming.accounts, (account) => account.id);
  const household =
    current.settings.kind === incoming.settings.kind && incoming.settings.household
      ? incoming.settings.household
      : current.settings.household;
  const mainAccountId = accounts.merged.some((account) => account.id === incoming.settings.mainAccountId)
    ? incoming.settings.mainAccountId
    : current.settings.mainAccountId;
  return {
    dataset: {
      ...current,
      settings: {
        ...current.settings,
        importRules,
        household,
        mainAccountId,
        mode: incoming.settings.mode,
        personalEnvelope: incoming.settings.personalEnvelope,
        plaisirBudget: incoming.settings.plaisirBudget,
      },
      categories: categories.merged,
      accounts: accounts.merged,
    },
    summary: {
      rules: { added: rules.added, updated: rules.updated },
      categories: { added: categories.added, updated: categories.updated },
      accounts: { added: accounts.added, updated: accounts.updated },
      household: !sameValue(household, current.settings.household),
    },
  };
};

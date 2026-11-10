import { todayIso } from '../shared/dates';
import type { Result } from '../shared/errors';
import type { Dataset, ImportRule, Settings } from '../shared/model';
import { createInitialDataset } from '../shared/seed';
import { mergeSettings } from '../sauvegarde/settingsMerge';
import { loadedDataset, type FinanceDeps } from './shared';

export const createWorkspaceUseCases = ({ gateway, newId, now }: FinanceDeps) => {
  const updateSettings = (patch: Partial<Settings>, summary: string | null): Promise<Result<void>> =>
    gateway.updateSettings(patch, summary ? { action: 'modification', entity: 'Paramètres', summary } : null);

  const restore = (dataset: Dataset): Promise<Result<void>> =>
    gateway.restore(dataset, {
      action: 'restauration',
      entity: 'Sauvegarde',
      summary: 'Restauration d’une sauvegarde',
    });

  const resetWorkspace = (): Promise<Result<void>> =>
    gateway.restore(createInitialDataset(todayIso(now()), newId), {
      action: 'restauration',
      entity: 'Réinitialisation',
      summary: 'Retour à la configuration initiale',
    });

  /** Ajoute (sans id) ou remplace une règle d'import. */
  const saveImportRule = (rule: Omit<ImportRule, 'id'> & { id?: string }): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return Promise.resolve(loaded);
    }
    const rules = loaded.value.settings.importRules ?? [];
    const saved: ImportRule = { ...rule, match: rule.match.trim(), id: rule.id ?? newId() };
    const next = rule.id
      ? rules.map((current) => (current.id === rule.id ? saved : current))
      : [...rules, saved];
    return updateSettings({ importRules: next }, `Règle d’import « ${saved.match} » enregistrée`);
  };

  const deleteImportRule = (id: string): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return Promise.resolve(loaded);
    }
    const rules = loaded.value.settings.importRules ?? [];
    const removed = rules.find((rule) => rule.id === id);
    return updateSettings(
      { importRules: rules.filter((rule) => rule.id !== id) },
      `Règle d’import « ${removed?.match ?? ''} » supprimée`,
    );
  };

  /** Reprend les réglages d'un fichier d'espace ; les opérations et budgets restent en place. */
  const importSettings = (incoming: Dataset): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return Promise.resolve(loaded);
    }
    return gateway.restore(mergeSettings(loaded.value, incoming).dataset, {
      action: 'modification',
      entity: 'Paramètres',
      summary: 'Réglages importés (règles, catégories, comptes)',
    });
  };

  return { updateSettings, restore, importSettings, resetWorkspace, saveImportRule, deleteImportRule };
};

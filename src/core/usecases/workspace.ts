import { todayIso } from '../shared/dates';
import type { Result } from '../shared/errors';
import type { Dataset, Settings } from '../shared/model';
import { createInitialDataset } from '../shared/seed';
import type { FinanceDeps } from './shared';

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

  return { updateSettings, restore, resetWorkspace };
};

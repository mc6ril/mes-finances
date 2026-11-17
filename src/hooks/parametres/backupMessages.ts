import type { RestoreRequest } from '@/core/sauvegarde/backupContent';
import type { BackupHistory } from '@/core/sauvegarde/interface';
import { type RestoreContext, type RestoreTarget, restoreTargets } from '@/core/sauvegarde/restorePlan';
import type { SettingsMergeSummary } from '@/core/sauvegarde/settingsMerge';
import { formatDateFr } from '@/core/shared/format';

const TARGET_LABELS: Record<RestoreTarget, string> = {
  main: 'remplace ton espace principal',
  replace: 'remplace l’espace du même nom',
  copy: 'devient un nouvel espace à toi',
};

/** Où ira chaque espace de la sauvegarde complète, avant de confirmer la restauration. */
export const restoreMessage = (request: RestoreRequest, context: RestoreContext): string => {
  const targets = restoreTargets(request.entries, context);
  const lines = request.entries
    .map((entry, index) => `« ${entry.workspace.name} » ${TARGET_LABELS[targets[index] ?? 'copy']}`)
    .join(' ; ');
  return `${lines}. Tes autres espaces ne sont pas touchés.`;
};

type Changes = { added: number; updated: number };

export const changesLine = (label: string, { added, updated }: Changes): string | null =>
  added + updated > 0
    ? `${label} : ${[added && `${added} ajoutée(s)`, updated && `${updated} modifiée(s)`].filter(Boolean).join(', ')}`
    : null;

/** Résumé de l'import des réglages, avant de le confirmer. */
export const settingsMessage = (summary: SettingsMergeSummary): string => {
  const lines = [
    changesLine('Règles d’import', summary.rules),
    changesLine('Catégories', summary.categories),
    changesLine('Comptes', summary.accounts),
    summary.household ? 'Foyer du commun mis à jour' : null,
  ].filter(Boolean);
  return lines.length === 0
    ? 'Ces réglages sont déjà identiques aux tiens.'
    : `${lines.join(' · ')}. Rien n’est supprimé et tes opérations restent en place.`;
};

export const lastBackupText = (history: BackupHistory | null): string => {
  if (!history) {
    return 'dernière sauvegarde : inconnue pour l’instant';
  }
  return history.lastFullBackupAt
    ? `dernière le ${formatDateFr(history.lastFullBackupAt.slice(0, 10))}`
    : 'aucune sauvegarde complète pour l’instant';
};

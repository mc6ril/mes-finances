import { mainWorkspace, type Workspace } from '@/core/espaces/workspaces';
import { createInitialDataset } from '@/core/shared/seed';
import { changesLine, lastBackupText, restoreMessage, settingsMessage } from '@/ui/labels/parametres/backup';

const none = { added: 0, updated: 0 };
const emptySummary = { rules: none, categories: none, accounts: none, household: false };

describe('message de restauration', () => {
  const dataset = createInitialDataset('2026-11-17', () => 'audit');
  const me = mainWorkspace('uid');
  const maison: Workspace = { id: 'commun-ab', name: 'Maison', kind: 'commun', role: 'owner' };

  it('dit où va chaque espace du fichier', () => {
    const entries = [
      { workspace: { ...me, id: 'perso-old', name: 'Perso' }, dataset },
      { workspace: maison, dataset },
      { workspace: { ...maison, id: 'commun-x', name: 'Vacances' }, dataset },
    ];
    expect(restoreMessage({ entries, activeId: 'perso-old' }, { main: me, workspaces: [me, maison] })).toBe(
      '« Perso » remplace ton espace principal ; « Maison » remplace l’espace du même nom ; ' +
        '« Vacances » devient un nouvel espace à toi. Tes autres espaces ne sont pas touchés.',
    );
  });
});

describe('message d’import des réglages', () => {
  it('résume ajouts et modifications par nature', () => {
    expect(changesLine('Catégories', { added: 2, updated: 1 })).toBe(
      'Catégories : 2 ajoutée(s), 1 modifiée(s)',
    );
    expect(changesLine('Comptes', { added: 0, updated: 3 })).toBe('Comptes : 3 modifiée(s)');
    expect(changesLine('Comptes', none)).toBeNull();
  });

  it('annonce des réglages identiques', () => {
    expect(settingsMessage(emptySummary)).toBe('Ces réglages sont déjà identiques aux tiens.');
  });

  it('liste les changements et rassure sur les opérations', () => {
    expect(settingsMessage({ ...emptySummary, rules: { added: 1, updated: 0 }, household: true })).toBe(
      'Règles d’import : 1 ajoutée(s) · Foyer du commun mis à jour. Rien n’est supprimé et tes opérations restent en place.',
    );
  });
});

describe('date de la dernière sauvegarde', () => {
  it('distingue historique inconnu, jamais sauvegardé et date connue', () => {
    expect(lastBackupText(null)).toBe('dernière sauvegarde : inconnue pour l’instant');
    expect(lastBackupText({ lastFullBackupAt: null, reminderHiddenUntil: null })).toBe(
      'aucune sauvegarde complète pour l’instant',
    );
    expect(lastBackupText({ lastFullBackupAt: '2026-11-02T08:00:00.000Z', reminderHiddenUntil: null })).toBe(
      'dernière le 02/11/2026',
    );
  });
});

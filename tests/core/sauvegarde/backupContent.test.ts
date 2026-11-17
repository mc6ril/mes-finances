import { mainWorkspace, type Workspace } from '@/core/espaces/workspaces';
import { restoreRequest, settingsSource } from '@/core/sauvegarde/backupContent';
import type { AnyBackupContent } from '@/core/sauvegarde/fullBackup';
import { createInitialDataset } from '@/core/shared/seed';

const persoOld = createInitialDataset('2026-11-17', () => 'audit');
const communData = createInitialDataset('2026-11-17', () => 'audit', 'commun');
const me = mainWorkspace('uid-new');
const maison: Workspace = { id: 'commun-ab', name: 'Maison', kind: 'commun', role: 'owner' };

const complete: AnyBackupContent = {
  kind: 'complete',
  activeId: 'perso-uid-old',
  entries: [
    {
      workspace: { id: 'perso-uid-old', name: 'Perso', kind: 'perso', role: 'owner' },
      dataset: persoOld,
    },
    { workspace: maison, dataset: communData },
  ],
};

const single: AnyBackupContent = { kind: 'workspace', dataset: communData, workspaceName: 'Maison' };

describe('source des réglages à importer', () => {
  it('prend le dataset d’un fichier d’un seul espace, quel que soit l’espace affiché', () => {
    expect(settingsSource(single, me)).toBe(communData);
    expect(settingsSource(single, maison)).toBe(communData);
  });

  it('prend l’espace principal du fichier quand l’espace affiché est le principal', () => {
    expect(settingsSource(complete, me)).toBe(persoOld);
  });

  it('prend l’espace du même identifiant pour un autre espace', () => {
    expect(settingsSource(complete, maison)).toBe(communData);
  });

  it('ne renvoie rien quand l’espace affiché est absent du fichier', () => {
    const autre: Workspace = { id: 'commun-zz', name: 'Vacances', kind: 'commun', role: 'owner' };
    expect(settingsSource(complete, autre)).toBeNull();
  });
});

describe('demande de restauration', () => {
  it('reprend les espaces et l’espace actif d’une sauvegarde complète', () => {
    expect(restoreRequest(complete)).toEqual({
      ok: true,
      value: { entries: complete.entries, activeId: 'perso-uid-old' },
    });
  });

  it('refuse le fichier d’un seul espace, qui ne dit pas où aller', () => {
    const result = restoreRequest(single);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('backup-not-complete');
  });
});

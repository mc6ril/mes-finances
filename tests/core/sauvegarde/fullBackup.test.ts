import { createBackup } from '@/core/sauvegarde/backup';
import { createFullBackup, readAnyBackup } from '@/core/sauvegarde/fullBackup';
import { createInitialDataset } from '@/core/shared/seed';
import { DEFAULT_WORKSPACE, type Workspace } from '@/core/espaces/workspaces';

const dataset = createInitialDataset('2026-11-08', () => 'audit');
const communDataset = createInitialDataset('2026-11-08', () => 'audit', 'commun');
const commun: Workspace = { id: 'w1', name: 'Commun', kind: 'commun', role: 'owner' };

const roundTrip = (value: unknown) => readAnyBackup(JSON.parse(JSON.stringify(value)));

describe('sauvegarde complète', () => {
  it('restitue tous les espaces, leur nature et l’espace actif', () => {
    const backup = createFullBackup(
      [
        { workspace: DEFAULT_WORKSPACE, dataset },
        { workspace: commun, dataset: communDataset },
      ],
      'w1',
      '2026-11-08T10:00:00.000Z',
    );
    const read = roundTrip(backup);
    expect(read).toMatchObject({ ok: true, value: { kind: 'complete', activeId: 'w1' } });
    expect(
      read.ok && read.value.kind === 'complete' && read.value.entries.map((entry) => entry.workspace),
    ).toEqual([DEFAULT_WORKSPACE, commun]);
  });

  it('écrit chaque espace sans son rôle, et redevient propriétaire à la lecture', () => {
    const backup = createFullBackup(
      [
        { workspace: DEFAULT_WORKSPACE, dataset },
        { workspace: { ...commun, role: 'guest' }, dataset: communDataset },
      ],
      'perso',
      '2026-11-08T10:00:00.000Z',
    );
    expect(backup.workspaces[1]?.workspace).toEqual({ id: 'w1', name: 'Commun', kind: 'commun' });
    const read = roundTrip(backup);
    expect(read.ok && read.value.kind === 'complete' && read.value.entries[1]?.workspace).toEqual(commun);
  });

  it('lit l’ancien format de sauvegarde complète (espace importé, dates)', () => {
    const backup = createFullBackup(
      [
        { workspace: DEFAULT_WORKSPACE, dataset },
        { workspace: commun, dataset: communDataset },
      ],
      'perso',
      '2026-11-08T10:00:00.000Z',
    );
    const legacy = {
      ...backup,
      workspaces: backup.workspaces.map((entry) => ({
        ...entry,
        workspace: { id: entry.workspace.id, name: entry.workspace.name, source: 'import', importedAt: null },
      })),
    };
    const read = roundTrip(legacy);
    expect(
      read.ok && read.value.kind === 'complete' && read.value.entries.map((entry) => entry.workspace),
    ).toEqual([DEFAULT_WORKSPACE, commun]);
  });

  it('reconnaît toujours le fichier d’un seul espace', () => {
    expect(roundTrip(createBackup(dataset, '2026-11-08T10:00:00.000Z', 'Commun'))).toMatchObject({
      ok: true,
      value: { kind: 'workspace', workspaceName: 'Commun' },
    });
  });

  it('refuse une sauvegarde complète sans l’espace principal', () => {
    const backup = createFullBackup([{ workspace: commun, dataset }], 'w1', '2026-11-08T10:00:00.000Z');
    expect(roundTrip(backup)).toEqual({ ok: false, error: { code: 'backup-missing-main' } });
  });

  it('signale l’espace dont les données sont corrompues', () => {
    const backup = createFullBackup(
      [
        { workspace: DEFAULT_WORKSPACE, dataset },
        { workspace: commun, dataset: { ...dataset, transactions: 'oops' as never } },
      ],
      'perso',
      '2026-11-08T10:00:00.000Z',
    );
    const read = roundTrip(backup);
    expect(read).toMatchObject({ ok: false, error: { code: 'backup-corrupted', workspaceName: 'Commun' } });
  });
});

import { createBackup } from '@/core/backup';
import { createFullBackup, readAnyBackup } from '@/core/fullBackup';
import { createInitialDataset } from '@/core/seed';
import { DEFAULT_WORKSPACE, type Workspace } from '@/core/workspaces';

const dataset = createInitialDataset('2026-11-08', () => 'audit');
const commun: Workspace = {
  id: 'w1',
  name: 'Commun',
  source: 'import',
  importedAt: '2026-11-08T10:00:00.000Z',
};

const roundTrip = (value: unknown) => readAnyBackup(JSON.parse(JSON.stringify(value)));

describe('sauvegarde complète', () => {
  it('restitue tous les espaces, leur nature et l’espace actif', () => {
    const backup = createFullBackup(
      [
        { workspace: DEFAULT_WORKSPACE, dataset },
        { workspace: commun, dataset },
      ],
      'w1',
      '2026-11-08T10:00:00.000Z',
    );
    const read = roundTrip(backup);
    expect(read).toMatchObject({ ok: true, kind: 'complete', activeId: 'w1' });
    expect(read.ok && read.kind === 'complete' && read.entries.map((entry) => entry.workspace)).toEqual([
      DEFAULT_WORKSPACE,
      commun,
    ]);
  });

  it('reconnaît toujours le fichier d’un seul espace', () => {
    expect(roundTrip(createBackup(dataset, '2026-11-08T10:00:00.000Z', 'Commun'))).toMatchObject({
      ok: true,
      kind: 'workspace',
      workspaceName: 'Commun',
    });
  });

  it('refuse une sauvegarde complète sans l’espace principal', () => {
    const backup = createFullBackup([{ workspace: commun, dataset }], 'w1', '2026-11-08T10:00:00.000Z');
    expect(roundTrip(backup)).toEqual({
      ok: false,
      reason: 'La sauvegarde ne contient pas l’espace principal.',
    });
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
    expect(read.ok).toBe(false);
    expect(!read.ok && read.reason).toMatch(/^Espace « Commun » :/);
  });
});

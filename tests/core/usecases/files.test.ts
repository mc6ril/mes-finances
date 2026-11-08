import { createBackup } from '@/core/backup';
import { fail, ok, type Result } from '@/core/errors';
import type { WorkspaceData } from '@/core/fullBackup';
import type {
  CsvParserInterface,
  FileSaverInterface,
  JsonParserInterface,
  SavedFile,
  TextFileReaderInterface,
  UserFile,
  WorkspaceDataSourceInterface,
} from '@/core/ports';
import { createInitialDataset } from '@/core/seed';
import { createFileUseCases } from '@/core/usecases/files';
import { DEFAULT_WORKSPACE, type Workspace } from '@/core/workspaces';
import { aTransaction } from '../fixtures';

const dataset = createInitialDataset('2026-11-08', () => 'audit');
const commun: Workspace = { id: 'w1', name: 'Épargne commune', source: 'local', importedAt: null };
const file: UserFile = { name: 'fichier.json' };

type Fakes = {
  text?: Result<string>;
  rows?: Result<string[][]>;
  json?: Result<unknown>;
  saveResult?: Result<void>;
  entries?: Result<WorkspaceData[]>;
};

const setup = (fakes: Fakes = {}) => {
  const saved: SavedFile[] = [];
  const shared: string[] = [];
  const reader: TextFileReaderInterface = { read: async () => fakes.text ?? ok('contenu') };
  const csv: CsvParserInterface = { parse: () => fakes.rows ?? ok([['a']]) };
  const json: JsonParserInterface = { parse: (text) => fakes.json ?? ok(JSON.parse(text)) };
  const saver: FileSaverInterface = {
    save: (savedFile) => {
      saved.push(savedFile);
      return fakes.saveResult ?? ok(undefined);
    },
  };
  const workspaces: WorkspaceDataSourceInterface = {
    allWorkspaceData: async () =>
      fakes.entries ??
      ok([
        { workspace: DEFAULT_WORKSPACE, dataset },
        { workspace: commun, dataset },
      ]),
    workspaceData: async (workspaceId) => ok(workspaceId === 'w1' ? { workspace: commun, dataset } : null),
    markShared: (workspaceId) => shared.push(workspaceId),
  };
  const useCases = createFileUseCases({ reader, csv, json, saver, workspaces });
  return { useCases, saved, shared };
};

const now = new Date('2026-11-08T10:00:00.000Z');

describe('lecture d’un fichier de sauvegarde', () => {
  it('fait remonter l’erreur de lecture du fichier', async () => {
    const { useCases } = setup({ text: fail('file-unreadable', { detail: 'fichier.json' }) });
    expect(await useCases.readBackupFile(file)).toEqual({
      ok: false,
      error: { code: 'file-unreadable', detail: 'fichier.json' },
    });
  });

  it('fait remonter un JSON invalide', async () => {
    const { useCases } = setup({ json: fail('invalid-json') });
    expect(await useCases.readBackupFile(file)).toEqual({ ok: false, error: { code: 'invalid-json' } });
  });

  it('reconnaît le fichier d’un espace', async () => {
    const backup = createBackup(dataset, now.toISOString(), 'Commun');
    const { useCases } = setup({ text: ok(JSON.stringify(backup)) });
    expect(await useCases.readBackupFile(file)).toMatchObject({
      ok: true,
      value: { kind: 'workspace', workspaceName: 'Commun' },
    });
  });
});

describe('lecture d’un relevé CSV', () => {
  it('renvoie les lignes du fichier', async () => {
    const { useCases } = setup({ rows: ok([['Date', 'Montant']]) });
    expect(await useCases.readCsvRows(file)).toEqual({ ok: true, value: [['Date', 'Montant']] });
  });

  it('fait remonter un CSV vide', async () => {
    const { useCases } = setup({ rows: fail('empty-csv') });
    expect(await useCases.readCsvRows(file)).toEqual({ ok: false, error: { code: 'empty-csv' } });
  });

  it('refuse un export qui ne vient pas du courtier', async () => {
    const { useCases } = setup({ rows: ok([['Date', 'Libellé']]) });
    expect(await useCases.readBrokerExport(file)).toEqual({
      ok: false,
      error: { code: 'broker-not-recognized' },
    });
  });
});

describe('sauvegarde complète', () => {
  it('enregistre tous les espaces dans un seul fichier daté', async () => {
    const { useCases, saved } = setup();
    expect(await useCases.saveFullBackup('w1', now)).toEqual({ ok: true, value: 2 });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: 'mes-finances-sauvegarde-complete-2026-11-08.json',
      mimeType: 'application/json',
    });
    expect(JSON.parse(saved[0]?.content ?? '')).toMatchObject({ kind: 'complete', activeId: 'w1' });
  });

  it('n’enregistre rien si la lecture des espaces échoue', async () => {
    const { useCases, saved } = setup({ entries: fail('storage-unavailable') });
    expect(await useCases.saveFullBackup('perso', now)).toEqual({
      ok: false,
      error: { code: 'storage-unavailable' },
    });
    expect(saved).toEqual([]);
  });
});

describe('partage d’un espace', () => {
  it('exporte l’espace seul et le marque comme envoyé', async () => {
    const { useCases, saved, shared } = setup();
    expect(await useCases.shareWorkspace('w1', now)).toEqual({ ok: true, value: commun });
    expect(saved[0]?.name).toBe('mes-finances-epargne-commune-2026-11-08.json');
    expect(JSON.parse(saved[0]?.content ?? '')).toMatchObject({ workspaceName: 'Épargne commune' });
    expect(shared).toEqual(['w1']);
  });

  it('ne marque pas l’espace comme envoyé si l’enregistrement échoue', async () => {
    const { useCases, shared } = setup({ saveResult: fail('file-save-failed') });
    expect(await useCases.shareWorkspace('w1', now)).toEqual({
      ok: false,
      error: { code: 'file-save-failed' },
    });
    expect(shared).toEqual([]);
  });

  it('signale un espace introuvable', async () => {
    const { useCases } = setup();
    expect(await useCases.shareWorkspace('inconnu', now)).toEqual({
      ok: false,
      error: { code: 'workspace-not-found' },
    });
  });
});

describe('export des opérations en CSV', () => {
  it('enregistre un CSV lisible par un tableur, nommé d’après sa source', () => {
    const { useCases, saved } = setup();
    const result = useCases.exportOperationsCsv({
      fileLabel: 'Compte courant',
      period: '2026-11-01_2026-11-30',
      transactions: [aTransaction({ label: 'Café' })],
      categories: dataset.categories,
      accounts: dataset.accounts,
    });
    expect(result.ok).toBe(true);
    expect(saved[0]).toMatchObject({
      name: 'mes-finances-compte-courant-operations-2026-11-01_2026-11-30.csv',
      mimeType: 'text/csv',
    });
    expect(saved[0]?.content.startsWith('﻿')).toBe(true);
    expect(saved[0]?.content).toContain('Café');
  });
});

import { createBackup } from '@/core/sauvegarde/backup';
import { fail, ok, type Result } from '@/core/shared/errors';
import type { WorkspaceData } from '@/core/sauvegarde/fullBackup';
import type {
  CsvParserInterface,
  FileSaverInterface,
  SavedFile,
  TextFileReaderInterface,
  UserFile,
} from '@/core/shared/ports';
import type {
  BackupHistory,
  BackupHistoryInterface,
  WorkspaceDataSourceInterface,
} from '@/core/sauvegarde/interface';
import { createInitialDataset } from '@/core/shared/seed';
import { createFileUseCases } from '@/core/usecases/files';
import { DEFAULT_WORKSPACE, type Workspace } from '@/core/espaces/workspaces';
import { aTransaction } from '../fixtures';

const dataset = createInitialDataset('2026-11-08', () => 'audit');
const commun: Workspace = { id: 'w1', name: 'Épargne commune', kind: 'perso', role: 'owner' };
const file: UserFile = { name: 'fichier.json' };

type Fakes = {
  text?: Result<string>;
  rows?: Result<string[][]>;
  saveResult?: Result<void>;
  entries?: Result<WorkspaceData[]>;
  recordResult?: Result<void>;
};

const setup = (fakes: Fakes = {}) => {
  const saved: SavedFile[] = [];
  const reader: TextFileReaderInterface = { read: async () => fakes.text ?? ok('contenu') };
  const csv: CsvParserInterface = { parse: () => fakes.rows ?? ok([['a']]) };
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
  };
  const history: BackupHistory = { lastFullBackupAt: null, reminderHiddenUntil: null };
  const backups: BackupHistoryInterface = {
    load: async () => ok(history),
    save: (patch) => {
      Object.assign(history, patch);
      return fakes.recordResult ?? ok(undefined);
    },
  };
  const useCases = createFileUseCases({ reader, csv, saver, workspaces, backups });
  return { useCases, saved, history };
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
    const { useCases } = setup({ text: ok('{ pas du json') });
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

describe('suivi des sauvegardes', () => {
  it('mémorise la date d’une sauvegarde complète exportée et réaffiche le rappel ensuite', async () => {
    const { useCases, history } = setup();
    history.reminderHiddenUntil = '2026-11-10';
    expect(await useCases.saveFullBackup('perso', now)).toEqual({ ok: true, value: 2 });
    expect(history).toEqual({ lastFullBackupAt: now.toISOString(), reminderHiddenUntil: null });
    expect(await useCases.backupHistory()).toEqual({ ok: true, value: history });
  });

  it('ne mémorise rien si le fichier n’a pas pu être enregistré', async () => {
    const { useCases, history } = setup({ saveResult: fail('file-save-failed') });
    await useCases.saveFullBackup('perso', now);
    expect(history.lastFullBackupAt).toBeNull();
  });

  it('masque le rappel pendant 7 jours', () => {
    const { useCases, history } = setup();
    expect(useCases.hideBackupReminder(now)).toEqual({ ok: true, value: undefined });
    expect(history.reminderHiddenUntil).toBe('2026-11-15');
  });
});

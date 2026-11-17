import { parseBrokerExport, type BrokerExport } from '../patrimoine/brokerImport';
import { transactionsToCsv } from '../comptes/csvImport';
import { todayIso } from '../shared/dates';
import { fail, ok, type Result } from '../shared/errors';
import { createFullBackup, readAnyBackup, type AnyBackupContent } from '../sauvegarde/fullBackup';
import {
  backupPasswordError,
  createEncryptedBackup,
  isEncryptedBackup,
  readEncryptedBackup,
  type BackupCipherInterface,
} from '../sauvegarde/encryptedBackup';
import type { Account, Category, Transaction } from '../shared/model';
import type {
  CsvParserInterface,
  FileSaverInterface,
  TextFileReaderInterface,
  UserFile,
} from '../shared/ports';
import type { BackupHistoryInterface, WorkspaceDataSourceInterface } from '../sauvegarde/interface';
import { snoozedUntil } from '../sauvegarde/reminder';
import { workspaceFileSlug } from '../espaces/workspaces';

export type FilePorts = {
  reader: TextFileReaderInterface;
  csv: CsvParserInterface;
  saver: FileSaverInterface;
  workspaces: WorkspaceDataSourceInterface;
  backups: BackupHistoryInterface;
  cipher: BackupCipherInterface;
};

export type OperationsExport = {
  fileLabel: string;
  period: string;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
};

const JSON_TYPE = 'application/json';

const parseJson = (text: string): Result<unknown> => {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return fail('invalid-json');
  }
};
const CSV_TYPE = 'text/csv';
const UTF8_BOM = '﻿';

const toJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const createFileUseCases = ({ reader, csv, saver, workspaces, backups, cipher }: FilePorts) => {
  const readCsvRows = async (file: UserFile): Promise<Result<string[][]>> => {
    const text = await reader.read(file);
    if (!text.ok) {
      return text;
    }
    return csv.parse(text.value);
  };

  /** Sauvegarde chiffrée : `backup-password-required` tant que le mot de passe n'est pas fourni. */
  const readBackupFile = async (file: UserFile, password?: string): Promise<Result<AnyBackupContent>> => {
    const text = await reader.read(file);
    if (!text.ok) {
      return text;
    }
    const parsed = parseJson(text.value);
    if (!parsed.ok) {
      return parsed;
    }
    if (!isEncryptedBackup(parsed.value)) {
      return readAnyBackup(parsed.value);
    }
    if (password === undefined) {
      return fail('backup-password-required');
    }
    const payload = readEncryptedBackup(parsed.value);
    if (!payload.ok) {
      return payload;
    }
    const decrypted = await cipher.decrypt(payload.value, password);
    if (!decrypted.ok) {
      return decrypted;
    }
    const content = parseJson(decrypted.value);
    if (!content.ok) {
      return fail('backup-corrupted', { detail: 'chiffrement' });
    }
    return readAnyBackup(content.value);
  };

  const readBrokerExport = async (file: UserFile): Promise<Result<BrokerExport>> => {
    const rows = await readCsvRows(file);
    if (!rows.ok) {
      return rows;
    }
    return parseBrokerExport(rows.value);
  };

  /** Exporte tous les espaces dans un fichier chiffré par le mot de passe (toujours obligatoire). */
  const saveFullBackup = async (activeId: string, password: string, now: Date): Promise<Result<number>> => {
    const weak = backupPasswordError(password);
    if (weak) {
      return fail(weak);
    }
    const entries = await workspaces.allWorkspaceData();
    if (!entries.ok) {
      return entries;
    }
    const plaintext = JSON.stringify(createFullBackup(entries.value, activeId, now.toISOString()));
    const encrypted = await cipher.encrypt(plaintext, password);
    if (!encrypted.ok) {
      return encrypted;
    }
    const saved = saver.save({
      name: `mes-finances-sauvegarde-complete-${todayIso(now)}.json`,
      content: toJson(createEncryptedBackup(encrypted.value)),
      mimeType: JSON_TYPE,
    });
    if (!saved.ok) {
      return saved;
    }
    // Le fichier est enregistré : la date part en arrière-plan, l'export reste réussi même hors ligne.
    const recorded = backups.save({ lastFullBackupAt: now.toISOString(), reminderHiddenUntil: null });
    if (!recorded.ok) {
      return recorded;
    }
    return ok(entries.value.length);
  };

  const backupHistory = () => backups.load();

  const hideBackupReminder = (now: Date): Result<void> =>
    backups.save({ reminderHiddenUntil: snoozedUntil(todayIso(now)) });

  const exportOperationsCsv = (operations: OperationsExport): Result<void> =>
    saver.save({
      name: `mes-finances-${workspaceFileSlug(operations.fileLabel)}-operations-${operations.period}.csv`,
      content: `${UTF8_BOM}${transactionsToCsv(operations.transactions, operations.categories, operations.accounts)}`,
      mimeType: CSV_TYPE,
    });

  return {
    readCsvRows,
    readBackupFile,
    readBrokerExport,
    saveFullBackup,
    backupHistory,
    hideBackupReminder,
    exportOperationsCsv,
  };
};

export type FileUseCases = ReturnType<typeof createFileUseCases>;

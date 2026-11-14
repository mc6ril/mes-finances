import { createBackup } from '../sauvegarde/backup';
import { parseBrokerExport, type BrokerExport } from '../patrimoine/brokerImport';
import { transactionsToCsv } from '../comptes/csvImport';
import { todayIso } from '../shared/dates';
import { fail, ok, type Result } from '../shared/errors';
import { createFullBackup, readAnyBackup, type AnyBackupContent } from '../sauvegarde/fullBackup';
import type { Account, Category, Transaction } from '../shared/model';
import type {
  CsvParserInterface,
  FileSaverInterface,
  TextFileReaderInterface,
  UserFile,
} from '../shared/ports';
import type { WorkspaceDataSourceInterface } from '../sauvegarde/interface';
import { workspaceFileSlug, type Workspace } from '../espaces/workspaces';

export type FilePorts = {
  reader: TextFileReaderInterface;
  csv: CsvParserInterface;
  saver: FileSaverInterface;
  workspaces: WorkspaceDataSourceInterface;
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

export const createFileUseCases = ({ reader, csv, saver, workspaces }: FilePorts) => {
  const readCsvRows = async (file: UserFile): Promise<Result<string[][]>> => {
    const text = await reader.read(file);
    if (!text.ok) {
      return text;
    }
    return csv.parse(text.value);
  };

  const readBackupFile = async (file: UserFile): Promise<Result<AnyBackupContent>> => {
    const text = await reader.read(file);
    if (!text.ok) {
      return text;
    }
    const parsed = parseJson(text.value);
    if (!parsed.ok) {
      return parsed;
    }
    return readAnyBackup(parsed.value);
  };

  const readBrokerExport = async (file: UserFile): Promise<Result<BrokerExport>> => {
    const rows = await readCsvRows(file);
    if (!rows.ok) {
      return rows;
    }
    return parseBrokerExport(rows.value);
  };

  const saveFullBackup = async (activeId: string, now: Date): Promise<Result<number>> => {
    const entries = await workspaces.allWorkspaceData();
    if (!entries.ok) {
      return entries;
    }
    const saved = saver.save({
      name: `mes-finances-sauvegarde-complete-${todayIso(now)}.json`,
      content: toJson(createFullBackup(entries.value, activeId, now.toISOString())),
      mimeType: JSON_TYPE,
    });
    if (!saved.ok) {
      return saved;
    }
    return ok(entries.value.length);
  };

  const shareWorkspace = async (workspaceId: string, now: Date): Promise<Result<Workspace>> => {
    const entry = await workspaces.workspaceData(workspaceId);
    if (!entry.ok) {
      return entry;
    }
    if (!entry.value) {
      return fail('workspace-not-found');
    }
    const { workspace, dataset } = entry.value;
    const saved = saver.save({
      name: `mes-finances-${workspaceFileSlug(workspace.name)}-${todayIso(now)}.json`,
      content: toJson(createBackup(dataset, now.toISOString(), workspace.name)),
      mimeType: JSON_TYPE,
    });
    if (!saved.ok) {
      return saved;
    }
    const marked = workspaces.markShared(workspace.id);
    if (!marked.ok) {
      return marked;
    }
    return ok(workspace);
  };

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
    shareWorkspace,
    exportOperationsCsv,
  };
};

export type FileUseCases = ReturnType<typeof createFileUseCases>;

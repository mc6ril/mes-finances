import { BrowserFileSaver } from '@/adapters/files/BrowserFileSaver';
import { BrowserTextFileReader } from '@/adapters/files/BrowserTextFileReader';
import { randomId } from '@/adapters/ids/randomIdGenerator';
import { JsonTextParser } from '@/adapters/parsing/JsonTextParser';
import { PapaCsvParser } from '@/adapters/parsing/PapaCsvParser';
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import {
  databaseNameFor,
  LocalWorkspaceRegistry,
  removeLegacyDemo,
} from '@/adapters/storage/workspaceRegistry';
import { createFileUseCases, type FileUseCases } from '@/core/usecases/files';
import { FinanceStore } from './FinanceStore';

export type Container = {
  store: FinanceStore;
  files: FileUseCases;
  newId: () => string;
};

export const createContainer = (): Container => {
  removeLegacyDemo();
  const store = new FinanceStore(
    (workspaceId) => new IndexedDbRepository(databaseNameFor(workspaceId)),
    new LocalWorkspaceRegistry(),
    randomId,
  );
  const files = createFileUseCases({
    reader: new BrowserTextFileReader(),
    csv: new PapaCsvParser(),
    json: new JsonTextParser(),
    saver: new BrowserFileSaver(),
    workspaces: store,
  });
  return { store, files, newId: randomId };
};

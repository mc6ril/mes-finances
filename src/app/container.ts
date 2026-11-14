import { createFirebaseAuthGateway } from '@/adapters/auth/firebaseAuth';
import { BrowserFileSaver } from '@/adapters/files/BrowserFileSaver';
import { BrowserTextFileReader } from '@/adapters/files/BrowserTextFileReader';
import { randomId } from '@/adapters/ids/randomIdGenerator';
import { PapaCsvParser } from '@/adapters/parsing/PapaCsvParser';
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import {
  databaseNameFor,
  LocalWorkspaceRegistry,
  removeLegacyDemo,
} from '@/adapters/storage/workspaceRegistry';
import { createFileUseCases, type FileUseCases } from '@/core/usecases/files';
import { createFinanceUseCases, type FinanceUseCases } from '@/core/usecases/finance';
import { createAuthUseCases, type AuthUseCases } from '@/core/usecases/auth';
import { AuthSession } from '@/core/store/AuthSession';
import { FinanceStore } from '@/core/store/FinanceStore';

export type Container = {
  store: FinanceStore;
  files: FileUseCases;
  finance: FinanceUseCases;
  session: AuthSession;
  auth: AuthUseCases;
};

export const createContainer = (): Container => {
  removeLegacyDemo();
  const session = new AuthSession(createFirebaseAuthGateway(import.meta.env));
  const auth = createAuthUseCases({ gateway: session });
  const store = new FinanceStore(
    (workspaceId) => new IndexedDbRepository(databaseNameFor(workspaceId)),
    new LocalWorkspaceRegistry(),
    randomId,
  );
  const files = createFileUseCases({
    reader: new BrowserTextFileReader(),
    csv: new PapaCsvParser(),
    saver: new BrowserFileSaver(),
    workspaces: store,
  });
  const finance = createFinanceUseCases({ gateway: store, newId: randomId, now: () => new Date() });
  return { store, files, finance, session, auth };
};

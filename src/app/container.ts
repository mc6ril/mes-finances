import { createFirebaseAuthGateway } from '@/adapters/auth/firebaseAuth';
import { firebaseApp } from '@/adapters/firebase/firebaseApp';
import { BrowserFileSaver } from '@/adapters/files/BrowserFileSaver';
import { BrowserTextFileReader } from '@/adapters/files/BrowserTextFileReader';
import {
  closeBrowserFirestore,
  openBrowserFirestore,
  watchBrowserNetwork,
} from '@/adapters/firestore/browserFirestore';
import { FirestoreBackend } from '@/adapters/firestore/FirestoreBackend';
import { randomId } from '@/adapters/ids/randomIdGenerator';
import { PapaCsvParser } from '@/adapters/parsing/PapaCsvParser';
import { clearBrowserData } from '@/adapters/storage/localData';
import { createFileUseCases, type FileUseCases } from '@/core/usecases/files';
import { createFinanceUseCases, type FinanceUseCases } from '@/core/usecases/finance';
import { createAuthUseCases, type AuthUseCases } from '@/core/usecases/auth';
import { AuthSession } from '@/core/store/AuthSession';
import { FinanceStore } from '@/core/store/FinanceStore';
import type { SyncGatewayInterface, UserDataBackendInterface } from '@/core/sync/interface';

export type Container = {
  store: FinanceStore;
  files: FileUseCases;
  finance: FinanceUseCases;
  session: AuthSession;
  auth: AuthUseCases;
  sync: SyncGatewayInterface;
  backend: UserDataBackendInterface;
};

const browserStorage = () => window.localStorage;

export const createContainer = (): Container => {
  const app = firebaseApp(import.meta.env);
  const session = new AuthSession(app ? createFirebaseAuthGateway(app) : null);
  const backend = new FirestoreBackend({
    openFirestore: () => {
      if (!app) {
        throw new Error('Configuration Firebase absente');
      }
      return openBrowserFirestore(app);
    },
    closeFirestore: closeBrowserFirestore,
    clearLocalData: () => clearBrowserData(),
    storage: browserStorage(),
  });
  watchBrowserNetwork(backend.sync);
  const auth = createAuthUseCases({ gateway: session, sync: backend.sync });
  const store = new FinanceStore(backend.repository, backend.registry, randomId);
  const files = createFileUseCases({
    reader: new BrowserTextFileReader(),
    csv: new PapaCsvParser(),
    saver: new BrowserFileSaver(),
    workspaces: store,
  });
  const finance = createFinanceUseCases({ gateway: store, newId: randomId, now: () => new Date() });
  return { store, files, finance, session, auth, sync: backend.sync, backend };
};

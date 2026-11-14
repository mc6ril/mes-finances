import type { Firestore } from 'firebase/firestore';
import type { AccountDataInterface } from '@/core/auth/interface';
import type { WorkspaceRegistryInterface } from '@/core/espaces/interface';
import type { SharingGatewayInterface } from '@/core/partage/interface';
import { fail, ok, type Result } from '@/core/shared/errors';
import type { Dataset } from '@/core/shared/model';
import type { FinanceRepositoryInterface } from '@/core/store/interface';
import type { UserDataBackendInterface } from '@/core/sync/interface';
import { FirestoreAccountData } from './FirestoreAccountData';
import { FirestoreFinanceRepository } from './FirestoreFinanceRepository';
import { FirestoreSharing } from './FirestoreSharing';
import { FirestoreWorkspaceRegistry, type KeyValueStorage } from './FirestoreWorkspaceRegistry';
import { SyncMonitor } from './SyncMonitor';
import { toDocumentId } from './workspaceIds';

export type FirestoreBackendDeps = {
  openFirestore: () => Firestore;
  /** Ferme la base et efface son cache local. */
  closeFirestore: (db: Firestore) => Promise<void>;
  /** Efface le reste : anciennes bases locales, préférences. */
  clearLocalData: () => Promise<void>;
  storage: KeyValueStorage;
};

type Connection = {
  db: Firestore;
  userId: string;
  registry: FirestoreWorkspaceRegistry;
  accountData: FirestoreAccountData;
  sharing: FirestoreSharing;
};

const disconnected = async <T>(): Promise<Result<T>> => fail('sync-failed');

const NOT_WATCHED = (): void => undefined;

/** Hors connexion, tout échoue proprement (le store n'est démarré qu'une fois connecté). */
const DISCONNECTED_REPOSITORY: FinanceRepositoryInterface = {
  load: () => disconnected<Dataset | null>(),
  watch: () => NOT_WATCHED,
  saveSettings: () => disconnected<void>(),
  put: () => disconnected<void>(),
  remove: () => disconnected<void>(),
  replaceAll: () => disconnected<void>(),
  destroy: () => disconnected<void>(),
  close: async () => undefined,
};

/** Base Firestore de l'utilisateur connecté : une instance par connexion, effacée à la déconnexion. */
export class FirestoreBackend implements UserDataBackendInterface {
  readonly sync = new SyncMonitor();
  readonly #deps: FirestoreBackendDeps;
  #connection: Connection | null = null;

  constructor(deps: FirestoreBackendDeps) {
    this.#deps = deps;
  }

  connect(userId: string): void {
    const db = this.#deps.openFirestore();
    this.#connection = {
      db,
      userId,
      registry: new FirestoreWorkspaceRegistry(db, userId, this.sync, this.#deps.storage),
      accountData: new FirestoreAccountData(db, userId),
      sharing: new FirestoreSharing(db, userId, this.sync),
    };
  }

  async disconnect(): Promise<Result<void>> {
    const connection = this.#connection;
    this.#connection = null;
    let cleared = true;
    if (connection) {
      try {
        await this.#deps.closeFirestore(connection.db);
      } catch {
        cleared = false;
      }
    }
    try {
      await this.#deps.clearLocalData();
    } catch {
      cleared = false;
    }
    this.sync.clearError();
    return cleared ? ok(undefined) : fail('sync-local-data-not-cleared');
  }

  repository = (workspaceId: string): FinanceRepositoryInterface => {
    const connection = this.#connection;
    if (!connection) {
      return DISCONNECTED_REPOSITORY;
    }
    return new FirestoreFinanceRepository(
      connection.db,
      toDocumentId(workspaceId, connection.userId),
      this.sync,
    );
  };

  /** Données en ligne de l'utilisateur connecté, effacées avant la suppression de son compte. */
  readonly accountData: AccountDataInterface = {
    erase: () => this.#connection?.accountData.erase() ?? disconnected(),
  };

  /** Partage des espaces communs de l'utilisateur connecté. */
  readonly sharing: SharingGatewayInterface = {
    createInvitation: (invitation) =>
      this.#connection?.sharing.createInvitation(invitation) ?? disconnected(),
    readInvitation: (token) => this.#connection?.sharing.readInvitation(token) ?? disconnected(),
    acceptInvitation: (invitation) =>
      this.#connection?.sharing.acceptInvitation(invitation) ?? disconnected(),
    pendingInvitations: (workspaceId) =>
      this.#connection?.sharing.pendingInvitations(workspaceId) ?? disconnected(),
    cancelInvitation: (token) => this.#connection?.sharing.cancelInvitation(token) ?? disconnected(),
    revokeGuest: (workspaceId) => this.#connection?.sharing.revokeGuest(workspaceId) ?? disconnected(),
    leaveWorkspace: (workspaceId) => this.#connection?.sharing.leaveWorkspace(workspaceId) ?? disconnected(),
  };

  /** Liste des espaces de l'utilisateur connecté. */
  readonly registry: WorkspaceRegistryInterface = {
    load: () => this.#connection?.registry.load() ?? disconnected(),
    watch: (listener) => this.#connection?.registry.watch(listener) ?? NOT_WATCHED,
    create: (workspace) => this.#connection?.registry.create(workspace) ?? disconnected(),
    rename: (workspaceId, name) => this.#connection?.registry.rename(workspaceId, name) ?? disconnected(),
    remove: (workspaceId) => this.#connection?.registry.remove(workspaceId) ?? disconnected(),
    setActive: (workspaceId) => this.#connection?.registry.setActive(workspaceId) ?? ok(undefined),
  };
}

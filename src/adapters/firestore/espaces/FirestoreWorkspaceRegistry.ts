import {
  collection,
  deleteDoc,
  doc,
  type Firestore,
  getDocs,
  onSnapshot,
  type Query,
  type QueryDocumentSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { toSyncFailure } from '@/adapters/firestore/firestoreErrors';
import type { SyncMonitor } from '@/adapters/firestore/sync/SyncMonitor';
import type { WorkspaceRegistryInterface, WorkspacesListener } from '@/core/espaces/interface';
import {
  mainWorkspace,
  resolveActiveId,
  type Workspace,
  type WorkspaceRegistryState,
} from '@/core/espaces/workspaces';
import { fail, ok, type Result } from '@/core/shared/errors';
import type { WorkspaceKind } from '@/core/shared/model';

/** Mémoire de l'appareil pour l'espace affiché (localStorage dans le navigateur). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

type WorkspaceDocument = { ownerId: string; memberIds: string[]; kind: WorkspaceKind; name: string };

export const ACTIVE_WORKSPACE_KEY_PREFIX = 'mes-finances:espace-actif:';

/** Attente de la confirmation de création de l'espace principal avant de l'ouvrir. */
const MAIN_CREATION_WAIT_MS = 5000;

/** Attente de la réponse du serveur à la création des espaces d'une sauvegarde. */
const CREATE_ALL_WAIT_MS = 15000;

const TIMED_OUT = Symbol('timeout');

const settledWithin = (write: Promise<void>, timeoutMs: number): Promise<undefined | typeof TIMED_OUT> =>
  Promise.race([
    write.then(() => undefined),
    new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), timeoutMs)),
  ]);

/** Espaces dont l'utilisateur est membre (workspaces where memberIds array-contains uid). */
export class FirestoreWorkspaceRegistry implements WorkspaceRegistryInterface {
  readonly #db: Firestore;
  readonly #userId: string;
  readonly #monitor: SyncMonitor;
  readonly #storage: KeyValueStorage;
  #cachedQuery: Query | null = null;

  constructor(db: Firestore, userId: string, monitor: SyncMonitor, storage: KeyValueStorage) {
    this.#db = db;
    this.#userId = userId;
    this.#monitor = monitor;
    this.#storage = storage;
  }

  get #query(): Query {
    this.#cachedQuery ??= query(
      collection(this.#db, 'workspaces'),
      where('memberIds', 'array-contains', this.#userId),
    );
    return this.#cachedQuery;
  }

  #ref(workspaceId: string) {
    return doc(this.#db, 'workspaces', workspaceId);
  }

  #toWorkspace(snapshot: QueryDocumentSnapshot): Workspace {
    const data = snapshot.data() as WorkspaceDocument;
    return {
      id: snapshot.id,
      name: data.name,
      kind: data.kind,
      role: data.ownerId === this.#userId ? 'owner' : 'guest',
      shared: data.memberIds.length > 1,
    };
  }

  get #activeKey(): string {
    return `${ACTIVE_WORKSPACE_KEY_PREFIX}${this.#userId}`;
  }

  #readActive(): string | null {
    try {
      return this.#storage.getItem(this.#activeKey);
    } catch {
      return null;
    }
  }

  /** Écriture mise en file : rend la main tout de suite, confirmée en arrière-plan. */
  #enqueue(write: () => Promise<void>): Result<void> {
    try {
      this.#monitor.track(write());
      return ok(undefined);
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  async load(): Promise<Result<WorkspaceRegistryState>> {
    try {
      const snapshot = await getDocs(this.#query);
      const workspaces = snapshot.docs.map((item) => this.#toWorkspace(item));
      const main = mainWorkspace(this.#userId);
      const hasMain = workspaces.some((item) => item.id === main.id);
      // Première connexion : l'espace principal n'existe pas encore (seul le serveur peut l'affirmer).
      if (!hasMain && !snapshot.metadata.fromCache) {
        const creation = this.#createDocument(main);
        this.#monitor.track(creation);
        await settledWithin(creation, MAIN_CREATION_WAIT_MS);
      }
      const listed = hasMain ? workspaces : [main, ...workspaces];
      return ok({ workspaces: listed, activeId: resolveActiveId(listed, this.#readActive()) });
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  watch(listener: WorkspacesListener): () => void {
    return onSnapshot(
      this.#query,
      (snapshot) => listener(snapshot.docs.map((item) => this.#toWorkspace(item))),
      (error) => this.#monitor.report(error),
    );
  }

  #newDocument(workspace: Workspace) {
    return {
      ownerId: this.#userId,
      memberIds: [this.#userId],
      kind: workspace.kind,
      name: workspace.name,
      createdAt: serverTimestamp(),
    };
  }

  #createDocument(workspace: Workspace): Promise<void> {
    return setDoc(this.#ref(workspace.id), this.#newDocument(workspace));
  }

  async createAll(workspaces: Workspace[]): Promise<Result<void>> {
    try {
      const batch = writeBatch(this.#db);
      workspaces.forEach((workspace) => batch.set(this.#ref(workspace.id), this.#newDocument(workspace)));
      const commit = batch.commit();
      // Hors ligne, le lot reste en file : on n'écrit rien de plus sans la réponse du serveur.
      const settled = await settledWithin(commit, CREATE_ALL_WAIT_MS);
      if (settled === TIMED_OUT) {
        this.#monitor.track(commit);
        return fail('sync-failed');
      }
      return ok(undefined);
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  async create(workspace: Workspace): Promise<Result<void>> {
    return this.#enqueue(() => this.#createDocument(workspace));
  }

  async rename(workspaceId: string, name: string): Promise<Result<void>> {
    return this.#enqueue(() => updateDoc(this.#ref(workspaceId), { name }));
  }

  async remove(workspaceId: string): Promise<Result<void>> {
    return this.#enqueue(() => deleteDoc(this.#ref(workspaceId)));
  }

  setActive(workspaceId: string): Result<void> {
    try {
      this.#storage.setItem(this.#activeKey, workspaceId);
    } catch {
      // Préférence d'affichage seulement : sans stockage, on rouvre l'espace principal.
    }
    return ok(undefined);
  }
}

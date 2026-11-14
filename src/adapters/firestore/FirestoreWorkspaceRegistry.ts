import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { WorkspaceRegistryInterface, WorkspacesListener } from '@/core/espaces/interface';
import {
  DEFAULT_WORKSPACE,
  resolveActiveId,
  type Workspace,
  type WorkspaceRegistryState,
} from '@/core/espaces/workspaces';
import { ok, type Result } from '@/core/shared/errors';
import type { WorkspaceKind } from '@/core/shared/model';
import { toSyncFailure } from './firestoreErrors';
import type { SyncMonitor } from './SyncMonitor';
import { toDocumentId, toWorkspaceId } from './workspaceIds';

/** Mémoire de l'appareil pour l'espace affiché (localStorage dans le navigateur). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

type WorkspaceDocument = { ownerId: string; memberIds: string[]; kind: WorkspaceKind; name: string };

export const ACTIVE_WORKSPACE_KEY_PREFIX = 'mes-finances:espace-actif:';

/** Attente de la confirmation de création de l'espace principal avant de l'ouvrir. */
const MAIN_CREATION_WAIT_MS = 5000;

const settledWithin = (write: Promise<void>, timeoutMs: number): Promise<void> =>
  Promise.race([write, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);

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
    return doc(this.#db, 'workspaces', toDocumentId(workspaceId, this.#userId));
  }

  #toWorkspace(snapshot: QueryDocumentSnapshot): Workspace {
    const data = snapshot.data() as WorkspaceDocument;
    return {
      id: toWorkspaceId(snapshot.id, this.#userId),
      name: data.name,
      kind: data.kind,
      role: data.ownerId === this.#userId ? 'owner' : 'guest',
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
      const hasMain = workspaces.some((item) => item.id === DEFAULT_WORKSPACE.id);
      // Première connexion : l'espace principal n'existe pas encore (seul le serveur peut l'affirmer).
      if (!hasMain && !snapshot.metadata.fromCache) {
        const creation = this.#createDocument(DEFAULT_WORKSPACE);
        this.#monitor.track(creation);
        await settledWithin(creation, MAIN_CREATION_WAIT_MS);
      }
      const listed = hasMain ? workspaces : [DEFAULT_WORKSPACE, ...workspaces];
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

  #createDocument(workspace: Workspace): Promise<void> {
    return setDoc(this.#ref(workspace.id), {
      ownerId: this.#userId,
      memberIds: [this.#userId],
      kind: workspace.kind,
      name: workspace.name,
      createdAt: serverTimestamp(),
    });
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

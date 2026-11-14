import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { SharingGatewayInterface } from '@/core/partage/interface';
import type { Invitation, NewInvitation } from '@/core/partage/model';
import { fail, ok, type Result } from '@/core/shared/errors';
import { toSyncFailure } from './firestoreErrors';
import type { SyncMonitor } from './SyncMonitor';
import { toDocumentId, toWorkspaceId } from './workspaceIds';

/** Création et acceptation n'aboutissent qu'une fois confirmées par le serveur. */
const CONFIRMATION_TIMEOUT_MS = 10000;

const confirmed = async (write: Promise<void>): Promise<Result<void>> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), CONFIRMATION_TIMEOUT_MS);
  });
  try {
    const outcome = await Promise.race([write.then(() => 'done' as const), timeout]);
    return outcome === 'done' ? ok(undefined) : fail('sync-offline');
  } catch (error) {
    return toSyncFailure(error);
  } finally {
    clearTimeout(timer);
  }
};

/** Partage d'un espace commun par lien : invitations/{token}, membres de workspaces/{id}. */
export class FirestoreSharing implements SharingGatewayInterface {
  readonly #db: Firestore;
  readonly #userId: string;
  readonly #monitor: SyncMonitor;

  constructor(db: Firestore, userId: string, monitor: SyncMonitor) {
    this.#db = db;
    this.#userId = userId;
    this.#monitor = monitor;
  }

  #invitationRef(token: string) {
    return doc(this.#db, 'invitations', token);
  }

  #workspaceRef(workspaceId: string) {
    return doc(this.#db, 'workspaces', toDocumentId(workspaceId, this.#userId));
  }

  #toInvitation(token: string, data: DocumentData): Invitation {
    return {
      token,
      workspaceId: toWorkspaceId(data.workspaceId as string, this.#userId),
      workspaceName: data.workspaceName as string,
      ownerId: data.ownerId as string,
      expiresAt: (data.expiresAt as Timestamp).toDate().toISOString(),
      usedBy: (data.usedBy as string | null) ?? null,
    };
  }

  #enqueue(write: () => Promise<void>): Result<void> {
    try {
      this.#monitor.track(write());
      return ok(undefined);
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  async createInvitation(invitation: NewInvitation): Promise<Result<void>> {
    try {
      return await confirmed(
        setDoc(this.#invitationRef(invitation.token), {
          workspaceId: toDocumentId(invitation.workspaceId, this.#userId),
          ownerId: this.#userId,
          workspaceName: invitation.workspaceName,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(new Date(invitation.expiresAt)),
          usedBy: null,
          usedAt: null,
        }),
      );
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  async readInvitation(token: string): Promise<Result<Invitation | null>> {
    try {
      const snapshot = await getDoc(this.#invitationRef(token));
      return ok(snapshot.exists() ? this.#toInvitation(token, snapshot.data()) : null);
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  async acceptInvitation(invitation: Invitation): Promise<Result<void>> {
    try {
      const batch = writeBatch(this.#db);
      batch.update(this.#invitationRef(invitation.token), {
        usedBy: this.#userId,
        usedAt: serverTimestamp(),
      });
      batch.update(this.#workspaceRef(invitation.workspaceId), {
        memberIds: [invitation.ownerId, this.#userId],
        lastInvitation: invitation.token,
      });
      const accepted = await confirmed(batch.commit());
      // Refus des règles : invitation consommée, expirée ou espace déjà partagé entre-temps.
      if (!accepted.ok && accepted.error.code === 'sync-permission-denied') {
        return fail('invitation-used');
      }
      return accepted;
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  async pendingInvitations(workspaceId: string): Promise<Result<Invitation[]>> {
    try {
      const snapshot = await getDocs(
        query(
          collection(this.#db, 'invitations'),
          where('ownerId', '==', this.#userId),
          where('workspaceId', '==', toDocumentId(workspaceId, this.#userId)),
        ),
      );
      return ok(
        snapshot.docs
          .map((item) => this.#toInvitation(item.id, item.data()))
          .filter((invitation) => invitation.usedBy === null),
      );
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  async cancelInvitation(token: string): Promise<Result<void>> {
    return this.#enqueue(() => deleteDoc(this.#invitationRef(token)));
  }

  async revokeGuest(workspaceId: string): Promise<Result<void>> {
    return this.#enqueue(() => updateDoc(this.#workspaceRef(workspaceId), { memberIds: [this.#userId] }));
  }

  async leaveWorkspace(workspaceId: string): Promise<Result<void>> {
    try {
      const snapshot = await getDoc(this.#workspaceRef(workspaceId));
      const ownerId = snapshot.data()?.ownerId as string | undefined;
      if (!ownerId) {
        return fail('workspace-not-found');
      }
      return this.#enqueue(() => updateDoc(this.#workspaceRef(workspaceId), { memberIds: [ownerId] }));
    } catch (error) {
      return toSyncFailure(error);
    }
  }
}

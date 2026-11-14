import {
  collection,
  getDocsFromServer,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import type { AccountDataInterface } from '@/core/auth/interface';
import { ok, type Result } from '@/core/shared/errors';
import { toSyncFailure } from '@/adapters/firestore/firestoreErrors';

type Membership = { ownerId: string; memberIds: string[] };

const MAX_BATCH_WRITES = 450;

/**
 * Efface les données en ligne d'un utilisateur avant la suppression de son compte. Chaque étape
 * attend la confirmation du serveur (réseau exigé) : le compte n'est supprimé qu'une fois tout fait.
 */
export class FirestoreAccountData implements AccountDataInterface {
  readonly #db: Firestore;
  readonly #userId: string;

  constructor(db: Firestore, userId: string) {
    this.#db = db;
    this.#userId = userId;
  }

  async erase(): Promise<Result<void>> {
    try {
      const memberships = await getDocsFromServer(
        query(collection(this.#db, 'workspaces'), where('memberIds', 'array-contains', this.#userId)),
      );
      for (const workspace of memberships.docs) {
        await this.#release(workspace.ref, workspace.data() as Membership);
      }
      // En dernier : rattrape aussi une invitation créée pendant la suppression (autre onglet).
      await this.#eraseInvitations();
      return ok(undefined);
    } catch (error) {
      return toSyncFailure(error);
    }
  }

  /** Invitations créées par l'utilisateur ou utilisées par lui. */
  async #eraseInvitations(): Promise<void> {
    const invitations = collection(this.#db, 'invitations');
    const [created, used] = await Promise.all([
      getDocsFromServer(query(invitations, where('ownerId', '==', this.#userId))),
      getDocsFromServer(query(invitations, where('usedBy', '==', this.#userId))),
    ]);
    await this.#deleteAll([...created.docs, ...used.docs].map((item) => item.ref));
  }

  /** Invité : quitte l'espace. Propriétaire : le transfère à l'invité, ou le supprime s'il est seul. */
  async #release(ref: DocumentReference, membership: Membership): Promise<void> {
    if (membership.ownerId !== this.#userId) {
      await updateDoc(ref, { memberIds: [membership.ownerId] });
      return;
    }
    const others = membership.memberIds.filter((id) => id !== this.#userId);
    const heir = others[0];
    if (heir) {
      await updateDoc(ref, { ownerId: heir, memberIds: [heir] });
      return;
    }
    const data = await getDocsFromServer(collection(ref, 'data'));
    // Données et espace dans le même lot (l'espace en dernier) : aucune écriture ne peut s'intercaler
    // et laisser des données sans espace, que les règles empêcheraient ensuite d'effacer.
    await this.#deleteAll([...data.docs.map((item) => item.ref), ref]);
  }

  async #deleteAll(refs: DocumentReference[]): Promise<void> {
    const unique = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
    for (let start = 0; start < unique.length; start += MAX_BATCH_WRITES) {
      const batch = writeBatch(this.#db);
      unique.slice(start, start + MAX_BATCH_WRITES).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }
}

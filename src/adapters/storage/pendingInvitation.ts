import type { PendingInvitationInterface } from '@/core/partage/interface';

const KEY = 'mes-finances:invitation';

/**
 * Lien ouvert avant la connexion, gardé dans le navigateur (survit à l'onglet ouvert par le lien de
 * confirmation d'adresse). Effacé à la déconnexion avec les autres données de l'application.
 */
export const browserPendingInvitation = (
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): PendingInvitationInterface => ({
  remember: (token) => {
    try {
      storage.setItem(KEY, token);
    } catch {
      // Sans stockage, il suffira de rouvrir le lien une fois connecté.
    }
  },
  take: () => {
    try {
      const token = storage.getItem(KEY);
      storage.removeItem(KEY);
      return token;
    } catch {
      return null;
    }
  },
});

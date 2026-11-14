import { useCallback, useEffect, useState } from 'react';
import type { Workspace } from '@/core/espaces/workspaces';
import type { Invitation, NewInvitation } from '@/core/partage/model';
import type { AppError, Result } from '@/core/shared/errors';
import type { SharingUseCases } from '@/core/usecases/sharing';
import { useCurrentUser } from './useAuth';
import { useContainer, useFinanceState, useFinanceStore } from './useFinance';

export const INVITATION_PATH = '/invitation';

export const useSharingUseCases = (): SharingUseCases => useContainer().sharing;

/** Lien complet à envoyer (route de l'application après le #). */
export const invitationLink = (token: string): string =>
  `${window.location.origin}${window.location.pathname}#${INVITATION_PATH}/${token}`;

type InviteState = {
  invitation: NewInvitation | null;
  pending: boolean;
  error: AppError | null;
};

/** Invitation en cours pour un espace commun : réutilise celle en attente, sinon en crée une. */
export const useWorkspaceInvitation = (workspace: Workspace) => {
  const sharing = useSharingUseCases();
  const [state, setState] = useState<InviteState>({ invitation: null, pending: true, error: null });

  const open = useCallback(async () => {
    setState({ invitation: null, pending: true, error: null });
    const existing = await sharing.pendingInvitations(workspace);
    const reused = existing.ok ? existing.value[0] : undefined;
    const result: Result<NewInvitation> = reused
      ? { ok: true, value: reused }
      : await sharing.invite(workspace);
    setState(
      result.ok
        ? { invitation: result.value, pending: false, error: null }
        : { invitation: null, pending: false, error: result.error },
    );
  }, [sharing, workspace]);

  useEffect(() => {
    void open();
  }, [open]);

  const cancel = useCallback(async (): Promise<Result<void>> => {
    if (!state.invitation) {
      return { ok: true, value: undefined };
    }
    return sharing.cancel(state.invitation.token);
  }, [sharing, state.invitation]);

  return { ...state, cancel };
};

type JoinState =
  | { status: 'loading' }
  | { status: 'ready'; invitation: Invitation }
  | { status: 'joining'; invitation: Invitation }
  | { status: 'error'; error: AppError };

/** Lien d'invitation ouvert une fois connecté : vérifie l'invitation puis rejoint l'espace. */
export const useJoinInvitation = (token: string, onJoined: () => void) => {
  const sharing = useSharingUseCases();
  const user = useCurrentUser();
  const store = useFinanceStore();
  const { workspaces } = useFinanceState();
  const [state, setState] = useState<JoinState>({ status: 'loading' });
  const [joinedId, setJoinedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void sharing.readInvitation(token, user.id).then((result) => {
      if (active) {
        setState(
          result.ok
            ? { status: 'ready', invitation: result.value }
            : { status: 'error', error: result.error },
        );
      }
    });
    return () => {
      active = false;
    };
  }, [sharing, token, user.id]);

  // L'espace rejoint arrive par la liste des espaces (en direct) : on l'ouvre dès qu'il y figure.
  useEffect(() => {
    if (joinedId && workspaces.some((item) => item.id === joinedId)) {
      setJoinedId(null);
      void store.switchWorkspace(joinedId).then(onJoined);
    }
  }, [joinedId, workspaces, store, onJoined]);

  const join = useCallback(async () => {
    if (state.status !== 'ready') {
      return;
    }
    setState({ status: 'joining', invitation: state.invitation });
    const result = await sharing.accept(token, user.id);
    if (!result.ok) {
      setState({ status: 'error', error: result.error });
      return;
    }
    setJoinedId(result.value);
  }, [sharing, state, token, user.id]);

  return { state, join };
};

/** Une fois connecté, reprend le lien d'invitation ouvert avant la connexion. */
export const usePendingInvitation = (navigate: (path: string) => void): void => {
  const sharing = useSharingUseCases();
  useEffect(() => {
    const token = sharing.takePendingInvitation();
    if (token) {
      navigate(`${INVITATION_PATH}/${token}`);
    }
  }, [sharing, navigate]);
};

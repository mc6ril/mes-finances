import { useCallback } from 'react';
import { Users } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useJoinInvitation } from '@/hooks/useSharing';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import Notice from '@/ui/design-system/Notice';
import Text from '@/ui/design-system/Text';
import { errorMessage } from '@/ui/errorMessages';
import PageHeader from '@/ui/layout/PageHeader';

type JoinProps = { token: string };

const JoinInvitation = ({ token }: JoinProps) => {
  const navigate = useNavigate();
  const onJoined = useCallback(() => navigate('/', { replace: true }), [navigate]);
  const { state, join } = useJoinInvitation(token, onJoined);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <PageHeader title="Invitation" />
      <Card>
        {state.status === 'loading' && <Text variant="muted">Vérification du lien…</Text>}
        {state.status === 'error' && (
          <div className="flex flex-col gap-4">
            <Notice tone="error">{errorMessage(state.error)}</Notice>
            <div>
              <Button onClick={() => navigate('/', { replace: true })}>Retour à mes finances</Button>
            </div>
          </div>
        )}
        {(state.status === 'ready' || state.status === 'joining') && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
              <Text>
                On t’invite à suivre l’espace commun{' '}
                <strong className="font-semibold">« {state.invitation.workspaceName} »</strong>. Vous pourrez
                tous les deux le consulter et le modifier ; tes espaces perso restent privés.
              </Text>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void join()} loading={state.status === 'joining'}>
                Rejoindre l’espace
              </Button>
              <Button variant="ghost" onClick={() => navigate('/', { replace: true })}>
                Plus tard
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

/** Lien d'invitation ouvert une fois connecté. */
const InvitationPage = () => {
  const { token } = useParams();
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <JoinInvitation token={token} />;
};

export default InvitationPage;

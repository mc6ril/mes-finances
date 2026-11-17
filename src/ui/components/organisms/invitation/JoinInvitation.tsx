import { Users } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useJoinInvitation } from '@/hooks/useSharing';
import Button from '@/ui/components/atoms/Button';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import Notice from '@/ui/components/molecules/feedback/Notice';
import PageHeader from '@/ui/components/molecules/PageHeader';
import { errorMessage } from '@/ui/errorMessages';

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
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
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

export default JoinInvitation;

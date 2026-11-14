import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { useSharingUseCases } from '@/hooks/useSharing';
import { AUTH_PATHS } from '@/ui/pages/auth/authParts';

/** Lien ouvert sans être connecté : gardé le temps de se connecter ou de créer son compte. */
const RememberInvitation = () => {
  const { token } = useParams();
  const sharing = useSharingUseCases();
  useEffect(() => {
    if (token) {
      sharing.rememberInvitation(token);
    }
  }, [sharing, token]);
  return <Navigate to={AUTH_PATHS.signIn} replace />;
};

export default RememberInvitation;

import { Navigate, useParams } from 'react-router';
import JoinInvitation from '@/ui/components/organisms/invitation/JoinInvitation';

/** Lien d'invitation ouvert une fois connecté. */
const InvitationPage = () => {
  const { token } = useParams();
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <JoinInvitation token={token} />;
};

export default InvitationPage;

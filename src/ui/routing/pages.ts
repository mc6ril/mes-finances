import { INVITATION_PATH } from '@/hooks/useSharing';
import { lazyPage, type LazyPage } from '@/ui/routing/lazyPage';

/** Pages de l'application, chargées à la demande : l'écran de connexion n'embarque ni elles ni recharts. */
export const pages = {
  dashboard: lazyPage(() => import('@/ui/pages/dashboard/DashboardPage')),
  budget: lazyPage(() => import('@/ui/pages/budget/BudgetPage')),
  compte: lazyPage(() => import('@/ui/pages/compte/ComptePage')),
  patrimoine: lazyPage(() => import('@/ui/pages/patrimoine/PatrimoinePage')),
  bilan: lazyPage(() => import('@/ui/pages/bilan/BilanPage')),
  objectifs: lazyPage(() => import('@/ui/pages/objectifs/ObjectifsPage')),
  parametres: lazyPage(() => import('@/ui/pages/parametres/ParametresPage')),
  invitation: lazyPage(() => import('@/ui/pages/invitation/InvitationPage')),
} satisfies Record<string, LazyPage>;

/** Page de l'adresse (« /parametres/xxx » compris), le tableau de bord sinon. */
export const pageForPath = (pathname: string): LazyPage => {
  const segment = pathname.split('/')[1] ?? '';
  if (`/${segment}` === INVITATION_PATH) {
    return pages.invitation;
  }
  return Object.hasOwn(pages, segment) ? pages[segment as keyof typeof pages] : pages.dashboard;
};

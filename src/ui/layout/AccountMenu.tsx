import { LogOut } from 'lucide-react';
import { userLabel } from '@/core/auth/model';
import { useAuthState, useAuthUseCases } from '@/hooks/useAuth';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/components/atoms/Button';
import Text from '@/ui/components/atoms/Text';

/** Utilisateur connecté et déconnexion, en pied de menu. */
const AccountMenu = () => {
  const { user } = useAuthState();
  const auth = useAuthUseCases();
  const report = useReport();
  if (!user) {
    return null;
  }
  const label = userLabel(user);
  return (
    <div className="flex items-center gap-2.5 border-t border-line-card px-2 pt-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft-strong text-xs font-semibold uppercase text-accent-ink-strong"
        aria-hidden
      >
        {label.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <Text variant="strong" className="truncate" title={label}>
          {label}
        </Text>
        {user.email && (
          <Text variant="caption" className="truncate" title={user.email}>
            {user.email}
          </Text>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={LogOut}
        label="Se déconnecter"
        onClick={() => void report(auth.signOut())}
      />
    </div>
  );
};

export default AccountMenu;

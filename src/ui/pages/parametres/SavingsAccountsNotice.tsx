import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useDataset } from '@/hooks/useFinance';
import { isSavingsAccount } from '@/core/comptes/accounts';
import Card from '@/ui/design-system/Card';
import Text from '@/ui/design-system/Text';

/** Les comptes d'épargne se créent et se modifient dans Épargne et patrimoine, avec leurs mouvements. */
const SavingsAccountsNotice = () => {
  const { accounts } = useDataset();
  const count = accounts.filter((account) => isSavingsAccount(account) && !account.archived).length;
  return (
    <Card title="Comptes d’épargne et placements">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text variant="muted">
          {count === 0
            ? 'Livrets, assurance-vie, bourse, épargne commune : ajoute-les depuis Épargne et patrimoine.'
            : `${count} compte${count > 1 ? 's' : ''} suivi${count > 1 ? 's' : ''}. Livrets, assurance-vie, bourse et épargne commune se créent et se modifient depuis Épargne et patrimoine.`}
        </Text>
        <Link
          to="/patrimoine"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
        >
          Épargne et patrimoine <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
};

export default SavingsAccountsNotice;

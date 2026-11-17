import { ArchiveRestore } from 'lucide-react';
import type { Account } from '@/core/shared/model';
import Button from '@/ui/components/atoms/Button';
import Card from '@/ui/components/molecules/cards/Card';
import Text from '@/ui/components/atoms/Text';

type ArchivedAccountsCardProps = { accounts: Account[]; onManage: (account: Account) => void };

/** Comptes d'épargne archivés, à gérer (réactiver) ; rien s'il n'y en a pas. */
const ArchivedAccountsCard = ({ accounts, onManage }: ArchivedAccountsCardProps) => {
  if (accounts.length === 0) {
    return null;
  }
  return (
    <Card title="Comptes archivés" subtitle="Ils restent dans l’historique mais ne sont plus suivis">
      <ul className="divide-y divide-line">
        {accounts.map((account) => (
          <li key={account.id} className="flex items-center justify-between gap-3 py-2">
            <Text>{account.name}</Text>
            <Button size="sm" variant="ghost" icon={ArchiveRestore} onClick={() => onManage(account)}>
              Gérer
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default ArchivedAccountsCard;

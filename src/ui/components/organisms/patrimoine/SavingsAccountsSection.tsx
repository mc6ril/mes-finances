import { Landmark, Plus } from 'lucide-react';
import type { AccountPosition } from '@/core/patrimoine/patrimoine';
import type { Account } from '@/core/shared/model';
import Button from '@/ui/components/atoms/Button';
import Text from '@/ui/components/atoms/Text';
import EmptyState from '@/ui/components/molecules/feedback/EmptyState';
import SavingsAccountCard from './SavingsAccountCard';

type SavingsAccountsSectionProps = {
  accounts: Account[];
  /** Sans aucun compte (même commun), la section invite à en ajouter un. */
  isEmpty: boolean;
  positions: ReadonlyMap<string, AccountPosition>;
  colors: ReadonlyMap<string, string>;
  onOpen: (account: Account) => void;
  onAdd: () => void;
};

/** Grille des comptes d'épargne et placements personnels. */
const SavingsAccountsSection = ({
  accounts,
  isEmpty,
  positions,
  colors,
  onOpen,
  onAdd,
}: SavingsAccountsSectionProps) => (
  <div>
    <Text variant="label" className="mb-3">
      Mes comptes d’épargne et placements
    </Text>
    {isEmpty && (
      <EmptyState
        icon={Landmark}
        title="Aucun compte d’épargne suivi"
        description="Ajoute un livret, une assurance-vie ou un compte-titres : il apparaîtra ici et dans ton budget. Les virements depuis ton compte courant compteront comme versements."
        action={
          <Button icon={Plus} variant="primary" onClick={onAdd}>
            Ajouter un compte
          </Button>
        }
      />
    )}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {accounts.map((account) => {
        const position = positions.get(account.id);
        if (!position) {
          return null;
        }
        return (
          <SavingsAccountCard
            key={account.id}
            account={account}
            position={position}
            color={colors.get(account.id) ?? ''}
            onOpen={() => onOpen(account)}
          />
        );
      })}
    </div>
  </div>
);

export default SavingsAccountsSection;

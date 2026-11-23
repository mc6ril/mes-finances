import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { PatrimoineRange } from '@/core/patrimoine/overview';
import { lastMonths, monthEnd } from '@/core/shared/dates';
import { capitalize, formatDateFr, monthLabel } from '@/core/shared/format';
import type { Account } from '@/core/shared/model';
import { usePatrimoine } from '@/hooks/patrimoine/usePatrimoine';
import Button from '@/ui/components/atoms/Button';
import PageHeader from '@/ui/components/molecules/PageHeader';
import AllocationCard from '@/ui/components/organisms/charts/AllocationCard';
import ComparisonCard from '@/ui/components/organisms/charts/ComparisonCard';
import EvolutionChart from '@/ui/components/organisms/charts/EvolutionChart';
import GainsCard from '@/ui/components/organisms/charts/GainsCard';
import AccountModal from '@/ui/components/organisms/modals/AccountModal';
import SavingsAccountForm from '@/ui/components/organisms/modals/SavingsAccountForm';
import ArchivedAccountsCard from '@/ui/components/organisms/patrimoine/ArchivedAccountsCard';
import JointAccountCard from '@/ui/components/organisms/patrimoine/JointAccountCard';
import PatrimoineStats from '@/ui/components/organisms/patrimoine/PatrimoineStats';
import SavingsAccountsSection from '@/ui/components/organisms/patrimoine/SavingsAccountsSection';

const PatrimoinePage = () => {
  // Trois états indépendants (aucune transition entre eux) : de simples useState suffisent.
  const [range, setRange] = useState<PatrimoineRange>('12');
  const [openAccount, setOpenAccount] = useState<Account | null>(null);
  const [editedAccount, setEditedAccount] = useState<Account | 'new' | null>(null);
  const view = usePatrimoine(range);
  const { month, accounts, positions } = view;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Épargne et patrimoine"
        description={`Situation au ${formatDateFr(view.date)} · ${capitalize(monthLabel(month))}`}
        actions={
          <Button icon={Plus} variant="primary" onClick={() => setEditedAccount('new')}>
            Ajouter un compte
          </Button>
        }
      />

      <PatrimoineStats
        snapshot={view.snapshot}
        hasJointAccount={accounts.joint.length > 0}
        change={view.change}
      />

      <EvolutionChart points={view.evolution} range={range} onRangeChange={setRange} />

      <SavingsAccountsSection
        accounts={accounts.savings}
        isEmpty={accounts.savings.length === 0 && accounts.joint.length === 0}
        positions={positions}
        colors={view.colors}
        onOpen={setOpenAccount}
        onAdd={() => setEditedAccount('new')}
      />

      {accounts.joint.map((account) => {
        const position = positions.get(account.id);
        if (!position) {
          return null;
        }
        return (
          <div key={account.id} className="flex flex-col gap-2">
            <JointAccountCard
              key={`${account.id}-${account.personalSharePercent}`}
              account={account}
              position={position}
            />
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setOpenAccount(account)}>
                Historique et mouvements
              </Button>
            </div>
          </div>
        );
      })}

      <div className="grid gap-4 lg:grid-cols-2">
        <AllocationCard entries={view.allocation} />
        <ComparisonCard entries={view.comparison} />
      </div>

      <GainsCard entries={view.comparison} />

      <ArchivedAccountsCard accounts={accounts.archivedSavings} onManage={setEditedAccount} />

      {editedAccount && (
        <SavingsAccountForm
          account={editedAccount === 'new' ? undefined : editedAccount}
          onClose={() => setEditedAccount(null)}
        />
      )}

      {openAccount && (
        <AccountModal
          account={openAccount}
          onClose={() => setOpenAccount(null)}
          months={lastMonths(month, 12)}
          endDate={monthEnd(month)}
        />
      )}
    </div>
  );
};

export default PatrimoinePage;

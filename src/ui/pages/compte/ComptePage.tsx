import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { defaultFilters } from '@/core/comptes/filters';
import { formatDateFr, monthLabel } from '@/core/shared/format';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import MonthNote, { MonthNoteButton } from '@/ui/components/organisms/commun/MonthNote';
import EmptyState from '@/ui/components/molecules/feedback/EmptyState';
import { Select } from '@/ui/components/atoms/form/Select';
import Notice from '@/ui/components/molecules/feedback/Notice';
import PageHeader from '@/ui/components/molecules/PageHeader';
import Ledger from '@/ui/components/organisms/compte/Ledger';

/** Page Opérations : compte affiché, note du mois et vue « à classer » (?categorie=aucune). */
const ComptePage = () => {
  const dataset = useDataset();
  const { month } = usePeriod();
  const [params] = useSearchParams();
  const toClassifyView = params.get('categorie') === 'aucune';
  const [accountId, setAccountId] = useState(params.get('compte') ?? dataset.settings.mainAccountId);
  const [noteMonth, setNoteMonth] = useState<string | null>(null);
  const account = dataset.accounts.find((item) => item.id === accountId) ?? dataset.accounts[0];
  if (!account) {
    return (
      <EmptyState icon={Wallet} title="Aucun compte" description="Crée un compte dans les paramètres." />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Opérations"
        description={`Opérations de ${monthLabel(month)} · suivi depuis le ${formatDateFr(account.openingDate)}`}
        actions={
          <>
            <MonthNoteButton month={month} onClick={() => setNoteMonth(month)} />
            <div className="w-56">
              <Select
                value={account.id}
                onChange={setAccountId}
                label="Compte affiché"
                options={dataset.accounts
                  .filter((item) => !item.archived)
                  .map((item) => ({ value: item.id, label: item.name }))}
              />
            </div>
          </>
        }
      />
      <MonthNote
        key={`${month}-${noteMonth === month}`}
        month={month}
        editing={noteMonth === month}
        onEditingChange={(editing) => setNoteMonth(editing ? month : null)}
      />
      {toClassifyView && (
        <Notice>
          Opérations à classer, toutes dates confondues. Choisis une catégorie pour chacune (ou sélectionne-en
          plusieurs).{' '}
          <Link to="/compte" className="font-medium underline">
            Revenir aux opérations du mois
          </Link>
        </Notice>
      )}
      <Ledger
        key={`${account.id}-${month}-${toClassifyView}`}
        dataset={dataset}
        account={account}
        initialFilters={defaultFilters({
          transactions: dataset.transactions,
          accountId: account.id,
          month,
          toClassify: toClassifyView,
        })}
      />
    </div>
  );
};

export default ComptePage;

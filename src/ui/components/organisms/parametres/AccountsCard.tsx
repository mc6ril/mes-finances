import { Archive, ArchiveRestore, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { isSavingsAccount } from '@/core/comptes/accounts';
import { parseFlexibleDate } from '@/core/shared/dates';
import type { Account } from '@/core/shared/model';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import Card from '@/ui/components/molecules/cards/Card';
import { Input } from '@/ui/components/atoms/form/Input';
import { Select } from '@/ui/components/atoms/form/Select';
import MoneyInput from '@/ui/components/molecules/form/MoneyInput';
import Text from '@/ui/components/atoms/Text';
import { useInlineName } from '@/ui/pages/parametres/useInlineName';

type AccountRowProps = { account: Account; isMain: boolean };

const AccountRow = ({ account, isMain }: AccountRowProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const save = useCallback(
    (patch: Partial<Account>) =>
      void report(finance.saveAccount({ ...account, ...patch }), 'Compte enregistré'),
    [report, finance, account],
  );
  const saveName = useCallback((name: string) => save({ name }), [save]);
  const { name, setName, commit } = useInlineName(account.name, saveName);
  const [openingDate, setOpeningDate] = useState(account.openingDate);
  return (
    <tr className={account.archived ? 'opacity-50' : ''}>
      <td>
        <Input
          value={name}
          onChange={setName}
          onBlur={commit}
          label="Nom du compte"
          className="h-9 min-w-[160px]"
        />
      </td>
      <td>
        <MoneyInput
          key={`${account.id}-${account.openingBalance}`}
          cents={account.openingBalance}
          allowNegative
          label="Solde de départ"
          onCommit={(openingBalance) => save({ openingBalance })}
          className="w-32"
        />
      </td>
      <td>
        <Input
          type="date"
          value={openingDate}
          onChange={setOpeningDate}
          onBlur={() => {
            const parsed = parseFlexibleDate(openingDate);
            if (parsed && parsed !== account.openingDate) {
              save({ openingDate: parsed });
            }
          }}
          label="À la date du"
          className="h-9"
        />
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {isMain && <Badge tone="brand">Principal</Badge>}
          {account.isJoint && <Badge tone="info">Commun</Badge>}
        </div>
      </td>
      <td className="text-right">
        <Button
          variant="ghost"
          size="sm"
          icon={account.archived ? ArchiveRestore : Archive}
          label={account.archived ? 'Réactiver' : 'Archiver'}
          disabled={isMain}
          onClick={() => save({ archived: !account.archived })}
        />
      </td>
    </tr>
  );
};

const AccountsCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const add = () => void report(finance.createAccount('courant'), 'Compte ajouté');
  const currentAccounts = dataset.accounts.filter((account) => !isSavingsAccount(account));
  return (
    <Card
      title="Comptes courants"
      subtitle="Solde de départ à une date donnée : les opérations antérieures à cette date sont considérées comme incluses dans ce solde"
      padded={false}
      action={
        <Button size="sm" icon={Plus} onClick={add}>
          Ajouter un compte
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="table-base min-w-[620px]">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Solde de départ</th>
              <th>À la date du</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {currentAccounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                isMain={account.id === dataset.settings.mainAccountId}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        <Text variant="small">Compte courant principal :</Text>
        <Select
          value={dataset.settings.mainAccountId}
          onChange={(mainAccountId) =>
            void report(finance.updateSettings({ mainAccountId }, 'Compte principal modifié'))
          }
          className="w-56"
          label="Compte principal"
          options={currentAccounts
            .filter((account) => !account.archived)
            .map((account) => ({ value: account.id, label: account.name }))}
        />
      </div>
    </Card>
  );
};

export default AccountsCard;

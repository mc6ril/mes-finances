import { Archive, ArchiveRestore, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { isSavingsAccount } from '@/core/comptes/accounts';
import { parseFlexibleDate } from '@/core/shared/dates';
import type { Account } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useInlineName } from '@/hooks/useInlineName';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useReport } from '@/hooks/useReport';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import { Input } from '@/ui/components/atoms/form/Input';
import { Select } from '@/ui/components/atoms/form/Select';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import MoneyInput from '@/ui/components/molecules/form/MoneyInput';

type AccountRowProps = { account: Account; isMain: boolean; stacked: boolean };

/** Un compte courant : ligne de tableau sur grand écran, bloc empilé sur téléphone. */
const AccountRow = ({ account, isMain, stacked }: AccountRowProps) => {
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

  const nameField = (
    <Input
      value={name}
      onChange={setName}
      onBlur={commit}
      label="Nom du compte"
      className={stacked ? 'h-9' : 'h-9 min-w-[160px]'}
    />
  );
  const balanceField = (
    <MoneyInput
      key={`${account.id}-${account.openingBalance}`}
      cents={account.openingBalance}
      allowNegative
      label="Solde de départ"
      onCommit={(openingBalance) => save({ openingBalance })}
      className={stacked ? undefined : 'w-32'}
    />
  );
  const dateField = (
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
  );
  const badges = (isMain || account.isJoint) && (
    <div className="flex flex-wrap gap-1">
      {isMain && <Badge tone="brand">Principal</Badge>}
      {account.isJoint && <Badge tone="info">Commun</Badge>}
    </div>
  );
  const archiveButton = (
    <Button
      variant="ghost"
      size="sm"
      icon={account.archived ? ArchiveRestore : Archive}
      label={account.archived ? 'Réactiver' : 'Archiver'}
      disabled={isMain}
      onClick={() => save({ archived: !account.archived })}
    />
  );

  if (stacked) {
    return (
      <li className={account.archived ? 'flex flex-col gap-2 py-4 opacity-50' : 'flex flex-col gap-2 py-4'}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{nameField}</div>
          {badges}
          <div className="-mr-2">{archiveButton}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <Text variant="small">Solde de départ</Text>
            {balanceField}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Text variant="small">À la date du</Text>
            {dateField}
          </div>
        </div>
      </li>
    );
  }
  return (
    <tr className={account.archived ? 'opacity-50' : ''}>
      <td>{nameField}</td>
      <td>{balanceField}</td>
      <td>{dateField}</td>
      <td>{badges}</td>
      <td className="text-right">{archiveButton}</td>
    </tr>
  );
};

const AccountsCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const add = () => void report(finance.createAccount('courant'), 'Compte ajouté');
  const currentAccounts = dataset.accounts.filter((account) => !isSavingsAccount(account));
  const isMobile = useIsMobile();
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
      {isMobile ? (
        <ul className="mx-4 divide-y divide-line-soft border-y border-line-soft">
          {currentAccounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isMain={account.id === dataset.settings.mainAccountId}
              stacked
            />
          ))}
        </ul>
      ) : (
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
                  stacked={false}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        <Text variant="small">Compte courant principal :</Text>
        <Select
          value={dataset.settings.mainAccountId}
          onChange={(mainAccountId) =>
            void report(finance.updateSettings({ mainAccountId }, 'Compte principal modifié'))
          }
          className="w-56 max-sm:w-full"
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

import { Archive, ArchiveRestore } from 'lucide-react';
import { useState } from 'react';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import { newAccountDraft, SAVINGS_KINDS, withKind } from '@/core/comptes/accounts';
import { parseFlexibleDate } from '@/core/shared/dates';
import { parseEuros } from '@/core/shared/money';
import type { Account, AccountKind } from '@/core/shared/model';
import { ACCOUNT_KIND_LABELS } from '@/ui/constants';
import Button from '@/ui/design-system/Button';
import { Field, Input, Select } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';

const centsToText = (cents: number): string =>
  cents === 0 ? '' : (cents / 100).toFixed(2).replace('.', ',');

type SavingsAccountFormProps = { account?: Account; onClose: () => void; onArchived?: () => void };

/**
 * Création ou modification d'un compte d'épargne (livret, assurance-vie, bourse, épargne commune).
 * Seul point d'entrée pour ces comptes : leur catégorie d'épargne suit (création, nom, archivage).
 */
const SavingsAccountForm = ({ account, onClose, onArchived }: SavingsAccountFormProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const { today } = usePeriod();
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'livret');
  const [balance, setBalance] = useState(centsToText(account?.openingBalance ?? 0));
  const [date, setDate] = useState(account?.openingDate ?? today);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const openingDate = parseFlexibleDate(date);
    const openingBalance = balance.trim() === '' ? 0 : parseEuros(balance);
    if (!name.trim() || !openingDate || openingBalance === null || openingBalance < 0) {
      setError('Renseigne un nom, une date et un solde positif (ou vide).');
      return;
    }
    const fields = { name: name.trim(), kind, openingBalance, openingDate };
    const draft = account
      ? { ...withKind(account, kind), name: fields.name, openingBalance, openingDate }
      : newAccountDraft(fields);
    if (await report(finance.saveAccount(draft), account ? 'Compte enregistré' : 'Compte ajouté')) {
      onClose();
    }
  };

  const toggleArchive = async () => {
    if (!account) {
      return;
    }
    const archived = !account.archived;
    if (
      await report(
        finance.saveAccount({ ...account, archived }),
        archived ? 'Compte archivé' : 'Compte réactivé',
      )
    ) {
      onClose();
      if (archived) {
        onArchived?.();
      }
    }
  };

  return (
    <Modal
      title={account ? `Modifier « ${account.name} »` : 'Nouveau compte d’épargne'}
      onClose={onClose}
      footer={
        <>
          {account && (
            <Button
              variant="ghost"
              icon={account.archived ? ArchiveRestore : Archive}
              onClick={() => void toggleArchive()}
              className="mr-auto"
            >
              {account.archived ? 'Réactiver' : 'Archiver'}
            </Button>
          )}
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom">
          <Input value={name} onChange={setName} placeholder="Livret A" autoFocus />
        </Field>
        <Field label="Type">
          <Select
            value={kind}
            onChange={(value) => setKind(value as AccountKind)}
            options={SAVINGS_KINDS.map((value) => ({ value, label: ACCOUNT_KIND_LABELS[value] }))}
          />
        </Field>
        <Field label="Solde de départ (€)">
          <Input value={balance} onChange={setBalance} inputMode="decimal" placeholder="0,00" />
        </Field>
        <Field label="À la date du">
          <Input type="date" value={date} onChange={setDate} />
        </Field>
      </div>
      <Text variant="caption" className="mt-3">
        Les opérations antérieures à cette date sont considérées comme incluses dans ce solde. Une ligne
        d’épargne du même nom est ajoutée au budget.
      </Text>
      {error && <Text className="mt-2 text-red-600 dark:text-red-400">{error}</Text>}
    </Modal>
  );
};

export default SavingsAccountForm;

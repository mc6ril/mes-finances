import { Archive, ArchiveRestore } from 'lucide-react';
import { useState } from 'react';
import { newAccountDraft, SAVINGS_KINDS, validateSavingsAccount, withKind } from '@/core/comptes/accounts';
import type { Account, AccountKind } from '@/core/shared/model';
import { centsToInput } from '@/core/shared/money';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/components/atoms/Button';
import { Input } from '@/ui/components/atoms/form/Input';
import { Select } from '@/ui/components/atoms/form/Select';
import Text from '@/ui/components/atoms/Text';
import { Field } from '@/ui/components/molecules/form/Field';
import { Modal } from '@/ui/components/molecules/overlays/Modal';
import { ACCOUNT_KIND_LABELS } from '@/ui/constants';

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
  const [balance, setBalance] = useState(centsToInput(account?.openingBalance ?? 0, { blankZero: true }));
  const [date, setDate] = useState(account?.openingDate ?? today);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const fields = validateSavingsAccount({ name, balance, date });
    if (!fields) {
      setError('Renseigne un nom, une date et un solde positif (ou vide).');
      return;
    }
    const draft = account ? { ...withKind(account, kind), ...fields } : newAccountDraft({ ...fields, kind });
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
      {error && <Text className="mt-2 text-negative">{error}</Text>}
    </Modal>
  );
};

export default SavingsAccountForm;

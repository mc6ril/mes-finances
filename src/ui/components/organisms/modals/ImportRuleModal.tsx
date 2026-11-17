import { useState } from 'react';
import { memberName, membersOf } from '@/core/commun/household';
import { imputationChoices } from '@/core/commun/imputation';
import { isInternalMoveType } from '@/core/comptes/balances';
import { TYPE_LABELS } from '@/core/comptes/csvImport';
import { normalizeRule, RULE_TYPES, type ImportRuleForm } from '@/core/comptes/importRules';
import { categoriesForType } from '@/core/comptes/transactionDraft';
import type { TransactionType } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/components/atoms/Button';
import { Input } from '@/ui/components/atoms/form/Input';
import { Select } from '@/ui/components/atoms/form/Select';
import Text from '@/ui/components/atoms/Text';
import { Field } from '@/ui/components/molecules/form/Field';
import { Modal } from '@/ui/components/molecules/overlays/Modal';

const memberLabelFor = (type: TransactionType, refund: boolean): string | null => {
  if (type === 'revenu') {
    return 'De qui';
  }
  if (type === 'depense') {
    return refund ? 'Remboursement pour' : 'À la charge de';
  }
  return null;
};

type ImportRuleModalProps = { initial: ImportRuleForm; onClose: () => void };

/** Création ou modification d'une règle d'import. */
const ImportRuleModal = ({ initial, onClose }: ImportRuleModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [form, setForm] = useState<ImportRuleForm>(initial);
  const members = membersOf(dataset);
  // Le revenu déjà choisi d'un membre payé ailleurs reste proposé.
  const incomeChoices = imputationChoices(members, 'revenu', form.memberId ? `revenu:${form.memberId}` : '');
  const memberLabel =
    dataset.settings.kind === 'commun' ? memberLabelFor(form.type, form.refund === true) : null;
  const update = (patch: Partial<ImportRuleForm>) => setForm((current) => ({ ...current, ...patch }));

  const isTransfer = isInternalMoveType(form.type);

  const save = async () => {
    const rule = normalizeRule(form, dataset.settings.kind === 'commun');
    if (await report(finance.saveImportRule(rule), 'Règle enregistrée')) {
      onClose();
    }
  };

  return (
    <Modal
      title={initial.id ? 'Modifier la règle' : 'Nouvelle règle d’import'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={!form.match.trim()} onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Le libellé contient"
          hint="Tous ces mots, dans n’importe quel ordre, majuscules et accents ignorés."
        >
          <Input
            value={form.match}
            onChange={(match) => update({ match })}
            placeholder="ex. NOM DE L’EMPLOYEUR"
            autoFocus
          />
        </Field>
        <Field label="Type">
          <Select
            value={form.type === 'depense' && form.refund ? 'remboursement' : form.type}
            onChange={(value) =>
              update({
                type: value === 'remboursement' ? 'depense' : (value as TransactionType),
                refund: value === 'remboursement',
                categoryId: null,
                memberId: null,
                receivedFor: false,
                counterpartAccountId: null,
              })
            }
            options={[
              { value: 'depense', label: 'Dépense' },
              { value: 'remboursement', label: 'Remboursement (mutuelle, avoir…)' },
              ...RULE_TYPES.filter((type) => type !== 'depense').map((type) => ({
                value: type,
                label: TYPE_LABELS[type],
              })),
            ]}
          />
        </Field>
        {isTransfer && (
          <Field
            label="Vers le compte"
            hint="Livret, assurance-vie, courtier… Sans compte : virement vers l’extérieur (autre banque, une personne)."
          >
            <Select
              value={form.counterpartAccountId ?? ''}
              onChange={(value) => update({ counterpartAccountId: value || null })}
              options={[
                { value: '', label: 'Aucun (hors de l’appli)' },
                ...dataset.accounts
                  .filter((account) => !account.archived)
                  .map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
          </Field>
        )}
        {form.type !== 'virement' && form.type !== 'investissement' && (
          <Field label={form.refund ? 'Remboursement de' : 'Catégorie'}>
            <Select
              value={form.categoryId ?? ''}
              onChange={(value) => update({ categoryId: value || null })}
              options={[
                { value: '', label: 'Sans catégorie' },
                ...categoriesForType(dataset.categories, form.type).map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
          </Field>
        )}
        {memberLabel && form.type === 'revenu' && (
          <Field label="Pour qui">
            <Select
              value={form.memberId ? `${form.receivedFor ? 'charge' : 'revenu'}:${form.memberId}` : ''}
              onChange={(value) => {
                const [kind, memberId] = value.split(':');
                update({ memberId: memberId ?? null, receivedFor: kind === 'charge' });
              }}
              options={[
                { value: '', label: 'Commun (intérêts, retrait d’épargne…)' },
                // Revenus d'abord, puis sommes reçues pour un membre.
                ...incomeChoices
                  .filter((choice) => choice.kind === 'revenu')
                  .map((choice) => ({
                    value: choice.value,
                    label: `Revenu de ${memberName(members, choice.memberId ?? '')}`,
                  })),
                ...incomeChoices
                  .filter((choice) => choice.kind === 'charge')
                  .map((choice) => ({
                    value: choice.value,
                    label: `Reçu pour ${memberName(members, choice.memberId ?? '')} (remboursement à lui reverser)`,
                  })),
              ]}
            />
          </Field>
        )}
        {memberLabel && form.type === 'depense' && (
          <Field label={memberLabel}>
            <Select
              value={form.memberId ?? ''}
              onChange={(value) => update({ memberId: value || null })}
              options={[
                { value: '', label: 'Le commun' },
                ...members.map((member) => ({ value: member.id, label: memberName(members, member.id) })),
              ]}
            />
          </Field>
        )}
        {form.type === 'virement' && (
          <Text variant="small">
            Un virement n’est ni une dépense ni un revenu : il ne compte pas dans le budget (par exemple une
            régularisation entre un compte perso et le commun).
          </Text>
        )}
      </div>
    </Modal>
  );
};

export default ImportRuleModal;

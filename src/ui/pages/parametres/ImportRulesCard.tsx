import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TYPE_LABELS } from '@/core/comptes/csvImport';
import { RULE_TYPES } from '@/core/comptes/importRules';
import type { ImportRule, TransactionType } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Field, Input, Select } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import { categoriesForType } from '@/ui/pages/compte/transactionForm';

type RuleForm = Omit<ImportRule, 'id'> & { id?: string };

const EMPTY: RuleForm = { match: '', type: 'depense', categoryId: null, memberId: null };

const memberLabelFor = (type: TransactionType): string | null => {
  if (type === 'revenu') {
    return 'De qui';
  }
  if (type === 'depense') {
    return 'À la charge de';
  }
  return null;
};

type RuleModalProps = { initial: RuleForm; onClose: () => void };

const RuleModal = ({ initial, onClose }: RuleModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [form, setForm] = useState<RuleForm>(initial);
  const members = dataset.settings.household?.members ?? [];
  const memberLabel = dataset.settings.kind === 'commun' ? memberLabelFor(form.type) : null;
  const update = (patch: Partial<RuleForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    const keepsMember = Boolean(memberLabel && form.memberId);
    const rule: RuleForm = {
      ...form,
      memberId: keepsMember ? form.memberId : null,
      receivedFor: keepsMember && form.type === 'revenu' && form.receivedFor === true,
    };
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
            value={form.type}
            onChange={(value) =>
              update({ type: value as TransactionType, categoryId: null, memberId: null, receivedFor: false })
            }
            options={RULE_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] }))}
          />
        </Field>
        {form.type !== 'virement' && (
          <Field label="Catégorie">
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
                ...members
                  .filter((member) => member.salaryOnCommon || member.id === form.memberId)
                  .map((member) => ({
                    value: `revenu:${member.id}`,
                    label: `Revenu de ${member.name || 'Sans prénom'}`,
                  })),
                ...members.map((member) => ({
                  value: `charge:${member.id}`,
                  label: `Reçu pour ${member.name || 'Sans prénom'} (remboursement à lui reverser)`,
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
                ...members.map((member) => ({ value: member.id, label: member.name || 'Sans prénom' })),
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

/** Règles appliquées à l'import d'un relevé CSV : type, catégorie et personne selon le libellé. */
const ImportRulesCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [editing, setEditing] = useState<RuleForm | null>(null);
  const rules = dataset.settings.importRules ?? [];
  const categoryName = (id: string | null) => dataset.categories.find((category) => category.id === id)?.name;
  const memberName = (id: string | null) =>
    dataset.settings.household?.members.find((member) => member.id === id)?.name;

  return (
    <Card
      title="Règles d’import"
      subtitle="Appliquées aux relevés CSV : la première règle dont les mots figurent dans le libellé l’emporte"
      action={
        <Button size="sm" icon={Plus} onClick={() => setEditing(EMPTY)}>
          Ajouter une règle
        </Button>
      }
    >
      {rules.length === 0 ? (
        <Text variant="small">
          Aucune règle. Exemple : « NOM DE TON EMPLOYEUR » → Revenu, Salaires, de toi.
        </Text>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center gap-2 py-2">
              <Text variant="strong" className="mr-auto">
                « {rule.match} »
              </Text>
              <Badge tone="brand">{TYPE_LABELS[rule.type]}</Badge>
              {categoryName(rule.categoryId) && <Badge>{categoryName(rule.categoryId)}</Badge>}
              {memberName(rule.memberId) && (
                <Badge>{`${rule.receivedFor ? 'Reçu pour' : rule.type === 'revenu' ? 'De' : 'Pour'} ${memberName(rule.memberId)}`}</Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={Pencil}
                label="Modifier la règle"
                onClick={() => setEditing(rule)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                label="Supprimer la règle"
                onClick={() => void report(finance.deleteImportRule(rule.id), 'Règle supprimée')}
              />
            </li>
          ))}
        </ul>
      )}
      {editing && <RuleModal initial={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
};

export default ImportRulesCard;

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { memberName, membersOf } from '@/core/commun/household';
import { TYPE_LABELS } from '@/core/comptes/csvImport';
import type { ImportRuleForm } from '@/core/comptes/importRules';
import type { ImportRule } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import { ConfirmDialog } from '@/ui/components/molecules/overlays/ConfirmDialog';
import ImportRuleModal from '@/ui/components/organisms/modals/ImportRuleModal';

const EMPTY: ImportRuleForm = { match: '', type: 'depense', categoryId: null, memberId: null };

/** Règles appliquées à l'import d'un relevé CSV : type, catégorie et personne selon le libellé. */
const ImportRulesCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [editing, setEditing] = useState<ImportRuleForm | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ImportRule | null>(null);
  const rules = dataset.settings.importRules ?? [];
  const categoryName = (id: string | null) => dataset.categories.find((category) => category.id === id)?.name;
  const accountName = (id: string | null | undefined) =>
    dataset.accounts.find((account) => account.id === id)?.name;
  const members = membersOf(dataset);
  /** Membre visé par une règle : son nom affiché, ou rien si la règle n'en vise pas (ou plus). */
  const ruleMember = (id: string | null) =>
    id !== null && members.some((member) => member.id === id) ? memberName(members, id) : null;

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
        <ul className="flex flex-col divide-y divide-line">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-start gap-2 py-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
                <Text variant="strong" className="mr-auto break-words">
                  « {rule.match} »
                </Text>
                <Badge tone="brand">{rule.refund ? 'Remboursement' : TYPE_LABELS[rule.type]}</Badge>
                {categoryName(rule.categoryId) && <Badge>{categoryName(rule.categoryId)}</Badge>}
                {accountName(rule.counterpartAccountId) && (
                  <Badge>{`Vers ${accountName(rule.counterpartAccountId)}`}</Badge>
                )}
                {ruleMember(rule.memberId) && (
                  <Badge>{`${rule.receivedFor ? 'Reçu pour' : rule.type === 'revenu' ? 'De' : 'Pour'} ${ruleMember(rule.memberId)}`}</Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center">
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
                  onClick={() => setPendingDelete(rule)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <ImportRuleModal initial={editing} onClose={() => setEditing(null)} />}
      {pendingDelete && (
        <ConfirmDialog
          title="Supprimer la règle ?"
          message={`La règle « ${pendingDelete.match} » ne s’appliquera plus aux prochains imports. Les opérations déjà importées ne changent pas.`}
          confirmLabel="Supprimer"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void report(finance.deleteImportRule(pendingDelete.id), 'Règle supprimée');
            setPendingDelete(null);
          }}
        />
      )}
    </Card>
  );
};

export default ImportRulesCard;

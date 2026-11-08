import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { newId, useDataset, usePeriod, useFileUseCases } from '@/app/FinanceContext';
import { useFinanceActions } from '@/app/useFinanceActions';
import { MOVEMENT_LABELS } from '@/constants/misc';
import { planBrokerImport, type BrokerDraft, type BrokerRowStatus } from '@/core/brokerImport';
import { parseFlexibleDate } from '@/core/dates';
import { formatDateFr } from '@/core/format';
import { parseEuros } from '@/core/money';
import type { Account, SavingsMovement, Valuation } from '@/core/model';
import { errorMessage } from '@/ui/errorMessages';
import Amount from '@/ui/design-system/Amount';
import Badge, { type BadgeTone } from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import { Checkbox, Field, Input } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';

const STATUS_BADGE: Record<BrokerRowStatus, { tone: BadgeTone; label: string } | null> = {
  nouveau: null,
  'deja-importe': { tone: 'neutral', label: 'Déjà importé' },
  'deja-saisi': { tone: 'warning', label: 'Déjà saisi depuis le compte courant' },
};

const SIGN: Record<BrokerDraft['kind'], 1 | -1> = { versement: 1, interets: 1, retrait: -1, frais: -1 };

const valuationOf = (accountId: string, value: number | null, date: string | null): Valuation | null => {
  if (value === null || !date) {
    return null;
  }
  return { id: newId(), accountId, date, value };
};

type BrokerImportModalProps = { account: Account; onClose: () => void };

const BrokerImportModal = ({ account, onClose }: BrokerImportModalProps) => {
  const dataset = useDataset();
  const { today } = usePeriod();
  const actions = useFinanceActions();
  const files = useFileUseCases();
  const [drafts, setDrafts] = useState<BrokerDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjustOpening, setAdjustOpening] = useState(true);
  const [value, setValue] = useState('');
  const [valueDate, setValueDate] = useState(today);

  const onFile = async (file: File) => {
    setError(null);
    const parsed = await files.readBrokerExport(file);
    if (!parsed.ok) {
      setError(errorMessage(parsed.error));
      return;
    }
    setDrafts(parsed.value.drafts);
  };

  const plan = drafts
    ? planBrokerImport({
        drafts,
        account,
        movements: dataset.savingsMovements,
        transactions: dataset.transactions,
      })
    : null;
  const toImport = plan?.rows.filter((entry) => entry.status === 'nouveau') ?? [];

  const confirm = async () => {
    if (!plan) {
      return;
    }
    const valuationCents = value.trim() ? parseEuros(value) : null;
    const valuationDay = parseFlexibleDate(valueDate);
    if (value.trim() && (valuationCents === null || valuationCents < 0 || !valuationDay)) {
      setError('Valeur actuelle invalide (ex. 1 250,00).');
      return;
    }
    const movements: SavingsMovement[] = toImport.map(({ draft }) => ({
      id: newId(),
      accountId: account.id,
      date: draft.date,
      kind: draft.kind,
      amount: draft.amount,
      comment: draft.comment,
      externalId: draft.externalId,
    }));
    const valuation = valuationOf(account.id, valuationCents, valuationDay);
    const openingPatch = adjustOpening ? plan.openingAdjustment : null;
    if (await actions.importBrokerExport(account, movements, openingPatch, valuation)) {
      onClose();
    }
  };

  return (
    <Modal
      title={`Importer un export Trade Republic · ${account.name}`}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          {plan && (
            <Button variant="primary" onClick={() => void confirm()}>
              Importer {toImport.length} mouvement{toImport.length > 1 ? 's' : ''}
            </Button>
          )}
        </>
      }
    >
      {!plan && (
        <div className="flex flex-col gap-4">
          <Text variant="muted">
            Dans l’application Trade Republic : Profil → Activité / Documents → Exporter les transactions
            (CSV). Le fichier est lu uniquement dans ton navigateur : rien n’est envoyé sur Internet, et ni
            nom ni IBAN ne sont conservés.
          </Text>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-200 px-6 py-10 text-center hover:border-brand-400 dark:border-stone-700">
            <FileUp className="h-6 w-6 text-brand-600" aria-hidden />
            <Text variant="strong">Choisir l’export CSV</Text>
            <Text variant="small">
              Les achats et ventes de titres restent internes au compte : seuls les virements, dividendes et
              frais sont importés.
            </Text>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onFile(file);
                }
              }}
            />
          </label>
        </div>
      )}

      {plan && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Total label="Versements" cents={plan.totals.deposits} />
            <Total label="Retraits" cents={-plan.totals.withdrawals} />
            <Total label="Dividendes / intérêts" cents={plan.totals.income} />
            <Total label="Frais et taxes" cents={-plan.totals.fees} />
          </div>

          {plan.openingAdjustment && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <Checkbox checked={adjustOpening} onChange={setAdjustOpening}>
                Faire démarrer le compte le {formatDateFr(plan.openingAdjustment.openingDate)} avec un solde
                initial de 0 € (recommandé)
              </Checkbox>
              <Text variant="small" className="mt-1 pl-6">
                Actuellement ouvert le {formatDateFr(account.openingDate)} avec{' '}
                <Amount cents={account.openingBalance} />. Sans ce réglage, les mouvements antérieurs à
                l’ouverture seraient ignorés, et ce solde initial s’ajouterait aux versements.
              </Text>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Valeur actuelle du compte (€)"
              hint="Affichée dans Trade Republic : titres + espèces"
            >
              <Input value={value} onChange={setValue} inputMode="decimal" placeholder="1 250,00" />
            </Field>
            <Field label="À la date du">
              <Input type="date" value={valueDate} onChange={setValueDate} />
            </Field>
          </div>
          {error && <Text className="text-red-600 dark:text-red-400">{error}</Text>}

          <div className="max-h-[40vh] overflow-auto rounded-xl border border-stone-100 dark:border-stone-800">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nature</th>
                  <th className="text-right">Montant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plan.rows.map(({ draft, status }) => (
                  <tr key={draft.externalId} className={status === 'nouveau' ? '' : 'opacity-60'}>
                    <td className="whitespace-nowrap">{formatDateFr(draft.date)}</td>
                    <td>{MOVEMENT_LABELS[draft.kind]}</td>
                    <td className="text-right">
                      <Amount cents={SIGN[draft.kind] * draft.amount} signed colored />
                    </td>
                    <td>
                      {STATUS_BADGE[status] && (
                        <Badge tone={STATUS_BADGE[status]?.tone}>{STATUS_BADGE[status]?.label}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!plan && error && <Text className="mt-3 text-red-600 dark:text-red-400">{error}</Text>}
    </Modal>
  );
};

type TotalProps = { label: string; cents: number };

const Total = ({ label, cents }: TotalProps) => (
  <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
    <Text variant="label">{label}</Text>
    <div className="mt-1 text-base font-semibold">
      <Amount cents={cents} signed colored />
    </div>
  </div>
);

export default BrokerImportModal;

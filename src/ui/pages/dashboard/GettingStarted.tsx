import { CheckCircle2, Circle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { DashboardContent } from '@/core/budget/overview';
import { parseEuros } from '@/core/shared/money';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Input } from '@/ui/design-system/Field';
import Text from '@/ui/design-system/Text';
import { settingsPath } from '@/ui/layout/navigation';

const LINK = 'shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300';

/** Première étape : le solde du compte courant aujourd'hui, saisi sans quitter le tableau de bord. */
const OpeningBalanceForm = () => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const cents = parseEuros(text);
    if (cents === null) {
      setError('Montant invalide (ex. 1 250,40 ou -80)');
      return;
    }
    setError(null);
    await report(finance.setMainOpeningBalance(cents), 'Solde de départ enregistré');
  };
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="relative w-40">
        <Input
          value={text}
          onChange={setText}
          inputMode="decimal"
          placeholder="0,00"
          label="Solde du compte courant aujourd’hui"
          className="pr-7 text-right"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-stone-400">
          €
        </span>
      </div>
      <Button type="submit" variant="primary" disabled={text.trim() === ''}>
        Enregistrer
      </Button>
      {error && <Text className="w-full text-xs text-red-600 dark:text-red-400">{error}</Text>}
    </form>
  );
};

type Step = {
  done: boolean;
  title: string;
  description: string;
  to: string;
  cta: string;
  form?: ReactNode;
};

const stepsOf = (content: DashboardContent): Step[] => [
  {
    done: content.hasOpeningBalance,
    title: 'Combien as-tu sur ton compte courant aujourd’hui ?',
    description: 'Ce solde sert de point de départ à tous les calculs.',
    to: settingsPath('comptes'),
    cta: 'Autre date : Paramètres → Comptes',
    form: content.hasOpeningBalance ? undefined : <OpeningBalanceForm />,
  },
  {
    done: !content.isEmpty,
    title: 'Ajouter tes opérations',
    description: 'Saisis-les une à une ou importe le relevé CSV exporté depuis ta banque.',
    to: '/compte',
    cta: 'Opérations',
  },
  {
    done: content.hasBudget,
    title: 'Fixer ton budget',
    description: 'Un montant prévu par catégorie : il s’applique aussi aux mois suivants.',
    to: '/budget',
    cta: 'Budget',
  },
  {
    done: content.hasSavingsAccounts,
    title: 'Ajouter tes comptes d’épargne (facultatif)',
    description: 'Livrets, assurance-vie, placements : pour suivre ton épargne et ton patrimoine.',
    to: '/patrimoine',
    cta: 'Épargne et patrimoine',
  },
];

type GettingStartedProps = { content: DashboardContent };

/** Premiers pas d'un espace sans opération : le tableau de bord se remplit avec ce qui est saisi. */
const GettingStarted = ({ content }: GettingStartedProps) => (
  <Card title="Pour démarrer" subtitle="Le tableau de bord se remplira au fur et à mesure de ta saisie.">
    <ol className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
      {stepsOf(content).map((step) => {
        const Icon = step.done ? CheckCircle2 : Circle;
        return (
          <li key={step.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <Icon
              className={
                step.done
                  ? 'mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400'
                  : 'mt-0.5 h-5 w-5 shrink-0 text-stone-300 dark:text-stone-600'
              }
              aria-label={step.done ? 'Fait' : 'À faire'}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <Text variant="strong" className={step.done ? 'line-through opacity-60' : undefined}>
                  {step.title}
                </Text>
                <Text variant="small">{step.description}</Text>
                {step.form}
              </div>
              <Link to={step.to} className={step.form ? `${LINK} text-xs font-normal` : LINK}>
                {step.cta}
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  </Card>
);

export default GettingStarted;

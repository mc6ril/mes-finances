import { CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router';
import type { DashboardContent } from '@/core/budget/overview';
import Card from '@/ui/design-system/Card';
import Text from '@/ui/design-system/Text';

type Step = { done: boolean; title: string; description: string; to: string; cta: string };

const stepsOf = (content: DashboardContent): Step[] => [
  {
    done: content.hasOpeningBalance,
    title: 'Renseigner le solde de ton compte courant',
    description: 'Le solde à une date donnée sert de point de départ à tous les calculs.',
    to: '/parametres',
    cta: 'Paramètres → Comptes',
  },
  {
    done: !content.isEmpty,
    title: 'Ajouter tes opérations',
    description: 'Saisis-les une à une ou importe le relevé CSV exporté depuis ta banque.',
    to: '/compte',
    cta: 'Compte courant',
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
    to: '/parametres',
    cta: 'Paramètres → Comptes',
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
              </div>
              <Link
                to={step.to}
                className="shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
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

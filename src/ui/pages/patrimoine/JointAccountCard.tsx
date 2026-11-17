import { Users } from 'lucide-react';
import { useState } from 'react';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { parseSharePercent } from '@/core/patrimoine/overview';
import { personalValueOf, type AccountPosition } from '@/core/patrimoine/patrimoine';
import type { Account } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import Card from '@/ui/design-system/Card';
import { Field, Input } from '@/ui/design-system/Field';
import Text from '@/ui/design-system/Text';

type JointAccountCardProps = { account: Account; position: AccountPosition };

/** Compte commun : affiché à part, compté dans le patrimoine personnel une fois la quote-part saisie. */
const JointAccountCard = ({ account, position }: JointAccountCardProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [share, setShare] = useState(
    account.personalSharePercent === null ? '' : String(account.personalSharePercent),
  );
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    const parsed = parseSharePercent(share);
    if (!parsed.ok) {
      setError('Entre 0 et 100 %');
      return;
    }
    setError(null);
    void report(finance.saveAccount({ ...account, personalSharePercent: parsed.value }), 'Compte enregistré');
  };
  const personal = personalValueOf(account, position.value);
  return (
    <Card
      title={account.name}
      subtitle="Compte commun : affiché à part de ton patrimoine personnel"
      action={<Users className="h-4 w-4 text-stone-400" aria-hidden />}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Text variant="label">Solde total du compte</Text>
          <div className="mt-1 text-xl font-semibold">
            <Amount cents={position.value} />
          </div>
          <Text variant="caption">Montant provisoire, à confirmer</Text>
        </div>
        <Field label="Ta quote-part (%)" error={error} hint="Laisse vide tant qu’elle n’est pas définie">
          <Input
            value={share}
            onChange={setShare}
            onBlur={commit}
            inputMode="decimal"
            placeholder="Non renseignée"
          />
        </Field>
        <div>
          <Text variant="label">Ta part</Text>
          <div className="mt-1 text-xl font-semibold">
            {personal === null ? (
              <Text as="span" variant="muted">
                Non comptée
              </Text>
            ) : (
              <Amount cents={personal} />
            )}
          </div>
          <Text variant="caption">
            {personal === null ? 'Exclue du patrimoine personnel' : 'Incluse dans le patrimoine personnel'}
          </Text>
        </div>
      </div>
    </Card>
  );
};

export default JointAccountCard;

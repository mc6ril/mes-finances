import type { Result } from '../shared/errors';
import { formatEuros } from '../shared/format';
import type { SavingsMovement, Valuation } from '../shared/model';
import { withId, type Draft, type FinanceDeps } from './shared';

export const createSavingsUseCases = ({ gateway, newId }: FinanceDeps) => {
  const saveMovement = async (draft: Draft<SavingsMovement>): Promise<Result<void>> => {
    const { entity, isNew } = withId(draft, newId);
    return gateway.upsert('savingsMovements', [entity], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Mouvement d’épargne',
      summary: `${entity.kind} ${formatEuros(entity.amount)}`,
    });
  };

  const deleteMovement = (movement: SavingsMovement): Promise<Result<void>> =>
    gateway.remove('savingsMovements', [movement.id], {
      action: 'suppression',
      entity: 'Mouvement d’épargne',
      summary: formatEuros(movement.amount),
    });

  const saveValuation = async (draft: Draft<Valuation>): Promise<Result<void>> => {
    const { entity, isNew } = withId(draft, newId);
    return gateway.upsert('valuations', [entity], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Valorisation',
      summary: `${entity.date} : ${formatEuros(entity.value)}`,
    });
  };

  const deleteValuation = (valuation: Valuation): Promise<Result<void>> =>
    gateway.remove('valuations', [valuation.id], {
      action: 'suppression',
      entity: 'Valorisation',
      summary: valuation.date,
    });

  return { saveMovement, deleteMovement, saveValuation, deleteValuation };
};

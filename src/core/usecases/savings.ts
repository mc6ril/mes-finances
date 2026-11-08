import { ok, type Result } from '../shared/errors';
import { formatEuros } from '../shared/format';
import type { Account, SavingsMovement, Valuation } from '../shared/model';
import { plural, withId, type Draft, type FinanceDeps } from './shared';

export type BrokerImport = {
  account: Account;
  movements: Draft<SavingsMovement>[];
  openingPatch: Pick<Account, 'openingDate' | 'openingBalance'> | null;
  valuation: Draft<Valuation> | null;
};

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

  const importBrokerExport = async ({
    account,
    movements,
    openingPatch,
    valuation,
  }: BrokerImport): Promise<Result<number>> => {
    const entity = 'Import Trade Republic';
    if (openingPatch) {
      const updated = await gateway.upsert('accounts', [{ ...account, ...openingPatch }], {
        action: 'import',
        entity,
        summary: `${account.name} : ouverture au ${openingPatch.openingDate}`,
      });
      if (!updated.ok) {
        return updated;
      }
    }
    if (valuation) {
      const saved = await gateway.upsert('valuations', [withId(valuation, newId).entity], {
        action: 'import',
        entity,
        summary: `${account.name} : valorisation ${formatEuros(valuation.value)}`,
      });
      if (!saved.ok) {
        return saved;
      }
    }
    if (movements.length === 0) {
      return ok(0);
    }
    const saved = await gateway.upsert(
      'savingsMovements',
      movements.map((movement) => withId(movement, newId).entity),
      { action: 'import', entity, summary: `${account.name} : ${plural(movements.length, 'mouvement')}` },
    );
    if (!saved.ok) {
      return saved;
    }
    return ok(movements.length);
  };

  return { saveMovement, deleteMovement, saveValuation, deleteValuation, importBrokerExport };
};

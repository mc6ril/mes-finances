import type { Result } from '../shared/errors';
import { todayIso } from '../shared/dates';
import type { Account, Category, Goal, Recurring } from '../shared/model';
import { withId, type Draft, type FinanceDeps } from './shared';

const NEW_ACCOUNT: Omit<Account, 'id' | 'openingDate'> = {
  name: 'Nouveau compte',
  kind: 'livret',
  group: 'securise',
  openingBalance: 0,
  isJoint: false,
  personalSharePercent: null,
  archived: false,
  color: '#64748b',
};

export const createEntityUseCases = ({ gateway, newId, now }: FinanceDeps) => {
  const saveAccount = async (draft: Draft<Account>): Promise<Result<void>> => {
    const { entity, isNew } = withId(draft, newId);
    return gateway.upsert('accounts', [entity], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Compte',
      summary: entity.name,
    });
  };

  const createAccount = (): Promise<Result<void>> =>
    saveAccount({ ...NEW_ACCOUNT, openingDate: todayIso(now()) });

  const saveCategory = async (draft: Draft<Category>): Promise<Result<void>> => {
    const { entity, isNew } = withId(draft, newId);
    return gateway.upsert('categories', [entity], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Catégorie',
      summary: entity.name,
    });
  };

  const saveRecurring = async (draft: Draft<Recurring>): Promise<Result<void>> => {
    const { entity, isNew } = withId(draft, newId);
    return gateway.upsert('recurrings', [entity], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Récurrence',
      summary: entity.label,
    });
  };

  const deleteRecurring = (recurring: Recurring): Promise<Result<void>> =>
    gateway.remove('recurrings', [recurring.id], {
      action: 'suppression',
      entity: 'Récurrence',
      summary: recurring.label,
    });

  const saveGoal = async (draft: Draft<Goal>): Promise<Result<void>> => {
    const { entity, isNew } = withId(draft, newId);
    return gateway.upsert('goals', [entity], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Objectif',
      summary: entity.name,
    });
  };

  const deleteGoal = (goal: Goal): Promise<Result<void>> =>
    gateway.remove('goals', [goal.id], { action: 'suppression', entity: 'Objectif', summary: goal.name });

  return { saveAccount, createAccount, saveCategory, saveRecurring, deleteRecurring, saveGoal, deleteGoal };
};

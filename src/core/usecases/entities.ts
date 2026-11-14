import { savingsCategoryOfAccount } from '../budget/budget';
import { newAccountDraft } from '../comptes/accounts';
import { fail, type Result } from '../shared/errors';
import { todayIso } from '../shared/dates';
import type { Account, AccountKind, Category, Cents, Goal, Recurring } from '../shared/model';
import { withId, type Draft, type FinanceDeps } from './shared';

export const createEntityUseCases = ({ gateway, newId, now }: FinanceDeps) => {
  const saveAccount = async (draft: Draft<Account>): Promise<Result<void>> => {
    const { entity, isNew } = withId(draft, newId);
    const dataset = gateway.currentDataset();
    const previous = dataset?.accounts.find((account) => account.id === entity.id);
    const saved = await gateway.upsert('accounts', [entity], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Compte',
      summary: entity.name,
    });
    const category = dataset && savingsCategoryOfAccount(entity, previous, dataset.categories, newId);
    if (!saved.ok || !category) {
      return saved;
    }
    return gateway.upsert('categories', [category], {
      action: isNew ? 'creation' : 'modification',
      entity: 'Catégorie',
      summary: category.name,
    });
  };

  /** Compte vierge du type donné, daté du jour : courant depuis Paramètres, épargne depuis Patrimoine. */
  const createAccount = (kind: AccountKind = 'courant', name = 'Nouveau compte'): Promise<Result<void>> =>
    saveAccount(newAccountDraft({ name, kind, openingBalance: 0, openingDate: todayIso(now()) }));

  /** « Pour démarrer » : solde du compte principal aujourd'hui, point de départ de tous les calculs. */
  const setMainOpeningBalance = async (openingBalance: Cents): Promise<Result<void>> => {
    const dataset = gateway.currentDataset();
    const main = dataset?.accounts.find((account) => account.id === dataset.settings.mainAccountId);
    if (!main) {
      return fail('data-not-loaded');
    }
    return saveAccount({ ...main, openingBalance, openingDate: todayIso(now()) });
  };

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

  return {
    saveAccount,
    createAccount,
    setMainOpeningBalance,
    saveCategory,
    saveRecurring,
    deleteRecurring,
    saveGoal,
    deleteGoal,
  };
};

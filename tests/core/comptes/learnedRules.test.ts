import { firstRuleSuggestion, isImported, ruleSuggestion } from '@/core/comptes/learnedRules';
import type { ImportRule } from '@/core/shared/model';
import { aTransaction } from '../fixtures';

const imported = aTransaction({
  label: 'CB CARREFOUR MARKET 12/03 PARIS',
  categoryId: null,
  imported: true,
});
const recategorized = { ...imported, categoryId: 'courses' };

describe('règles d’import apprises', () => {
  it('reconnaît une opération importée, y compris avant le champ dédié', () => {
    expect(isImported(imported)).toBe(true);
    expect(isImported(aTransaction({ comment: 'Import releve.csv', paymentMethod: '' }))).toBe(true);
    expect(isImported(aTransaction({ comment: 'Import manuel', paymentMethod: 'Carte' }))).toBe(false);
    expect(isImported(aTransaction())).toBe(false);
  });

  it('propose de toujours classer les mots du libellé dans la nouvelle catégorie', () => {
    expect(ruleSuggestion(imported, recategorized, [])).toEqual({
      match: 'cb carrefour market',
      type: 'depense',
      categoryId: 'courses',
      memberId: null,
    });
  });

  it('marque la règle comme remboursement pour une dépense positive', () => {
    const refund = aTransaction({
      label: 'Remb mutuelle Harmonie',
      amount: 2500,
      imported: true,
      categoryId: null,
    });
    expect(ruleSuggestion(refund, { ...refund, categoryId: 'sante' }, [])).toMatchObject({
      match: 'remb mutuelle harmonie',
      refund: true,
    });
  });

  it('ne propose rien si une règle couvre déjà le libellé', () => {
    const rule: ImportRule = {
      id: 'r',
      match: 'carrefour',
      type: 'depense',
      categoryId: 'x',
      memberId: null,
    };
    expect(ruleSuggestion(imported, recategorized, [rule])).toBeNull();
  });

  it('ne propose rien pour une saisie manuelle, une catégorie inchangée ou retirée, un virement', () => {
    const manual = aTransaction({ label: 'Carrefour', categoryId: null });
    expect(ruleSuggestion(manual, { ...manual, categoryId: 'courses' }, [])).toBeNull();
    expect(ruleSuggestion(recategorized, recategorized, [])).toBeNull();
    expect(ruleSuggestion(recategorized, { ...recategorized, categoryId: null }, [])).toBeNull();
    expect(
      ruleSuggestion(imported, { ...recategorized, type: 'virement', counterpartAccountId: 'livret' }, []),
    ).toBeNull();
    const digits = aTransaction({ label: '12/03 0042', imported: true, categoryId: null });
    expect(ruleSuggestion(digits, { ...digits, categoryId: 'courses' }, [])).toBeNull();
  });

  it('prend la première suggestion valable d’une modification groupée', () => {
    const manual = aTransaction({ label: 'Boulangerie', categoryId: null });
    expect(
      firstRuleSuggestion(
        [
          { before: manual, after: { ...manual, categoryId: 'courses' } },
          { before: imported, after: recategorized },
        ],
        [],
      ),
    ).toMatchObject({ match: 'cb carrefour market' });
  });
});

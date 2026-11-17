import { imputationChoices } from '@/core/commun/imputation';

const members = [
  { id: 'm1', name: 'Alex', salaryOnCommon: true },
  { id: 'm2', name: 'Sam', salaryOnCommon: false },
];

const values = (type: Parameters<typeof imputationChoices>[1], current?: string) =>
  imputationChoices(members, type, current).map((choice) => choice.value);

describe('membres proposés selon le type d’opération', () => {
  it('propose pour une dépense : le commun, à la charge de chacun, avancé par chacun', () => {
    expect(values('depense')).toEqual(['', 'charge:m1', 'charge:m2', 'avance:m1', 'avance:m2']);
  });

  it('propose pour un revenu : le commun, reçu pour chacun, et le revenu des seuls salaires versés sur le commun', () => {
    expect(values('revenu')).toEqual(['', 'charge:m1', 'charge:m2', 'revenu:m1']);
  });

  it('garde le revenu déjà choisi d’un membre payé ailleurs', () => {
    expect(values('revenu', 'revenu:m2')).toEqual(['', 'charge:m1', 'charge:m2', 'revenu:m1', 'revenu:m2']);
  });

  it('ne propose rien pour un virement ou un investissement', () => {
    expect(values('virement')).toEqual([]);
    expect(values('investissement')).toEqual([]);
  });

  it('décrit chaque choix par son type et son membre', () => {
    expect(imputationChoices(members, 'depense')[3]).toEqual({
      value: 'avance:m1',
      kind: 'avance',
      memberId: 'm1',
    });
    expect(imputationChoices(members, 'depense')[0]).toEqual({ value: '', kind: 'commun', memberId: null });
  });
});

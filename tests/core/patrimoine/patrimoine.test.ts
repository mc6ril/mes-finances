import { accountPosition, patrimoineAt, patrimoineSeries } from '@/core/patrimoine/patrimoine';
import { anAccount, aMovement, aTransaction, aValuation } from '../fixtures';

const courant = anAccount({ id: 'courant', openingBalance: 100000, openingDate: '2026-01-01' });
const livret = anAccount({
  id: 'ldds',
  name: 'LDDS',
  kind: 'livret',
  group: 'securise',
  openingBalance: 920000,
  openingDate: '2026-01-01',
});
const av = anAccount({
  id: 'av',
  name: 'Assurance-vie',
  kind: 'assurance-vie',
  group: 'investissement',
  openingBalance: 240000,
  openingDate: '2026-01-01',
});
const immo = anAccount({
  id: 'immo',
  name: 'Épargne immobilière commune',
  kind: 'commun-immo',
  group: 'securise',
  openingBalance: 2000000,
  openingDate: '2026-01-01',
  isJoint: true,
  personalSharePercent: null,
});

describe('accountPosition', () => {
  it('distingue versements, intérêts, frais et valeur d’un livret', () => {
    const movements = [
      aMovement({ accountId: 'ldds', kind: 'versement', amount: 20000, date: '2026-02-01' }),
      aMovement({ accountId: 'ldds', kind: 'retrait', amount: 5000, date: '2026-02-10' }),
      aMovement({ accountId: 'ldds', kind: 'interets', amount: 2300, date: '2026-12-31' }),
    ];
    expect(
      accountPosition(livret, { transactions: [], movements, valuations: [] }, '2026-12-31'),
    ).toMatchObject({
      contributions: 935000,
      deposits: 20000,
      withdrawals: 5000,
      interests: 2300,
      fees: 0,
      value: 937300,
      performance: 2300,
      marketGain: 0,
    });
  });

  it('compte un virement depuis le compte courant comme un versement sur le placement', () => {
    const transactions = [
      aTransaction({
        date: '2026-03-05',
        amount: -10000,
        type: 'investissement',
        categoryId: 'av',
        counterpartAccountId: 'av',
      }),
    ];
    expect(accountPosition(av, { transactions, movements: [], valuations: [] }, '2026-03-31')).toMatchObject({
      deposits: 10000,
      contributions: 250000,
      value: 250000,
      performance: 0,
    });
  });

  it('utilise la dernière valorisation et y ajoute les versements postérieurs', () => {
    const movements = [
      aMovement({ accountId: 'av', kind: 'versement', amount: 10000, date: '2026-02-05' }),
      aMovement({ accountId: 'av', kind: 'versement', amount: 10000, date: '2026-04-05' }),
      aMovement({ accountId: 'av', kind: 'frais', amount: 300, date: '2026-03-15' }),
    ];
    const valuations = [
      aValuation({ accountId: 'av', date: '2026-01-31', value: 241000 }),
      aValuation({ accountId: 'av', date: '2026-03-31', value: 256000 }),
    ];
    const position = accountPosition(av, { transactions: [], movements, valuations }, '2026-04-30');
    expect(position).toMatchObject({
      contributions: 260000,
      value: 266000,
      performance: 6000,
      fees: 300,
      marketGain: 6300,
    });
    expect(position.valuationDate).toBe('2026-03-31');
  });

  it('ne confond pas la croissance par versements avec la performance', () => {
    const movements = [aMovement({ accountId: 'av', kind: 'versement', amount: 100000, date: '2026-02-05' })];
    const valuations = [aValuation({ accountId: 'av', date: '2026-03-31', value: 335000 })];
    const position = accountPosition(av, { transactions: [], movements, valuations }, '2026-03-31');
    expect(position.value - 240000).toBe(95000);
    expect(position.performance).toBe(-5000);
  });

  it('renvoie le solde du compte courant pour un compte courant', () => {
    const transactions = [aTransaction({ date: '2026-03-05', amount: -2500 })];
    expect(
      accountPosition(courant, { transactions, movements: [], valuations: [] }, '2026-03-31').value,
    ).toBe(97500);
  });
});

describe('patrimoineAt', () => {
  const ctx = { transactions: [], movements: [], valuations: [] };

  it('sépare le compte commun du patrimoine personnel tant que la quote-part n’est pas renseignée', () => {
    const result = patrimoineAt([courant, livret, av, immo], ctx, '2026-03-31');
    expect(result.personalTotal).toBe(1260000);
    expect(result.joint).toEqual({ gross: 2000000, personal: 0, shareMissing: true });
  });

  it('intègre la quote-part personnelle du compte commun quand elle est renseignée', () => {
    const shared = { ...immo, personalSharePercent: 40 };
    const result = patrimoineAt([courant, livret, av, shared], ctx, '2026-03-31');
    expect(result.joint).toEqual({ gross: 2000000, personal: 800000, shareMissing: false });
    expect(result.personalTotal).toBe(1260000 + 800000);
  });

  it('ventile courant, épargne sécurisée et investissements', () => {
    const result = patrimoineAt([courant, livret, av], ctx, '2026-03-31');
    expect(result.byGroup).toEqual({ courant: 100000, securise: 920000, investissement: 240000 });
  });

  it('ignore les comptes archivés', () => {
    const result = patrimoineAt([courant, { ...av, archived: true }], ctx, '2026-03-31');
    expect(result.personalTotal).toBe(100000);
  });
});

describe('patrimoineSeries', () => {
  it('donne un point par fin de mois', () => {
    const movements = [
      aMovement({ accountId: 'ldds', kind: 'versement', amount: 10000, date: '2026-02-10' }),
    ];
    const series = patrimoineSeries([livret], { transactions: [], movements, valuations: [] }, [
      '2026-01',
      '2026-02',
    ]);
    expect(series.map((point) => point.personalTotal)).toEqual([920000, 930000]);
    expect(series.map((point) => point.contributions)).toEqual([920000, 930000]);
  });
});

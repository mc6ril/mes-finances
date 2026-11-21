import type { SettlementLine } from '@/core/commun/household';
import {
  adjustmentDraft,
  defaultSettlementSelection,
  displayedAmount,
  isSettled,
  pendingSettlements,
  settledPayments,
  settlementGroups,
  settlementSelection,
  settlementsOf,
} from '@/core/commun/settlement';
import type { Dataset, Settlement } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction } from '../fixtures';

const members = [
  { id: 'm1', name: 'Alex', salaryOnCommon: true },
  { id: 'm2', name: 'Sam', salaryOnCommon: false },
];

const aSettlement = (overrides: Partial<Settlement> = {}): Settlement => ({
  id: 's1',
  month: '2026-10',
  memberId: 'm2',
  amount: -50000,
  date: '2026-10-31',
  transactionId: 'tx-virement',
  ...overrides,
});

const commonDataset = (overrides: Partial<Dataset> = {}): Dataset => {
  const base = createInitialDataset('2026-10-01', () => 'id');
  return {
    ...base,
    settings: {
      ...base.settings,
      kind: 'commun',
      household: { members, contributionRate: 0, savingsPaidBy: 'commun' },
    },
    ...overrides,
  };
};

describe('sélection des virements qui règlent le mois', () => {
  const exact = aTransaction({ id: 'exact', type: 'virement', amount: 50000 });
  const other = aTransaction({ id: 'autre', type: 'virement', amount: 20000 });

  it('présélectionne le premier virement quand il règle le montant exact', () => {
    expect(defaultSettlementSelection([exact, other], -50000)).toEqual(['exact']);
  });

  it('ne présélectionne rien quand le premier virement ne tombe pas juste', () => {
    expect(defaultSettlementSelection([other, exact], -50000)).toEqual([]);
    expect(defaultSettlementSelection([], -50000)).toEqual([]);
  });

  it('additionne la sélection dans le sens du règlement et donne l’écart reporté', () => {
    expect(settlementSelection([exact, other], new Set(['autre']), -50000)).toEqual({
      total: -20000,
      gap: -30000,
    });
    expect(settlementSelection([exact, other], new Set(['exact']), -50000)).toEqual({
      total: -50000,
      gap: 0,
    });
  });
});

describe('ajustement hors compte', () => {
  it('compte en négatif ce que le membre doit au commun, en positif ce que le commun lui doit', () => {
    expect(adjustmentDraft('owes', ' Abonnement ', 1500)).toEqual({ label: 'Abonnement', amount: -1500 });
    expect(adjustmentDraft('owed', 'Part du canapé', 20000)).toEqual({
      label: 'Part du canapé',
      amount: 20000,
    });
  });

  it('refuse un libellé vide ou un montant nul', () => {
    expect(adjustmentDraft('owes', '  ', 1500)).toBeNull();
    expect(adjustmentDraft('owes', 'Abonnement', 0)).toBeNull();
  });
});

describe('récapitulatif du règlement', () => {
  const lines: SettlementLine[] = [
    { kind: 'contribution', label: 'Part du commun', amount: -80000 },
    { kind: 'avance', label: 'Courses', amount: 6000, transactionId: 'a1' },
    { kind: 'charge', label: 'Pharmacie', amount: -2000, transactionId: 'c1' },
    { kind: 'charge', label: 'Remboursement', amount: 500, transactionId: 'c2' },
    { kind: 'avance', label: 'Mutuelle', amount: -700, transactionId: 'a2' },
  ];

  it('lit les montants du côté de ce que le commun doit, ou de ce que le membre doit', () => {
    expect(displayedAmount(-80000, false)).toBe(-80000);
    expect(displayedAmount(-80000, true)).toBe(80000);
  });

  it('affiche toujours les groupes de base, et les autres seulement s’ils ont des lignes', () => {
    const owed = settlementGroups(lines, false).map((group) => group.key);
    expect(owed).toEqual(['income', 'contribution', 'avance', 'receivedByMember', 'charge', 'received']);
    const owes = settlementGroups(lines, true).map((group) => group.key);
    expect(owes).toEqual(['contribution', 'avance', 'receivedByMember', 'charge', 'received']);
  });

  it('sépare les charges payées par le commun et les sommes reçues pour le membre', () => {
    const groups = settlementGroups(lines, false);
    const charge = groups.find((group) => group.key === 'charge');
    const received = groups.find((group) => group.key === 'received');
    expect(charge?.lines.map((line) => line.transactionId)).toEqual(['c1']);
    expect(received?.lines.map((line) => line.transactionId)).toEqual(['c2']);
  });

  it('sépare les dépenses avancées par le membre et les remboursements reçus sur son compte', () => {
    const groups = settlementGroups(lines, false);
    const avance = groups.find((group) => group.key === 'avance');
    const receivedByMember = groups.find((group) => group.key === 'receivedByMember');
    expect(avance?.lines.map((line) => line.transactionId)).toEqual(['a1']);
    expect(receivedByMember?.lines.map((line) => line.transactionId)).toEqual(['a2']);
  });

  it('détaille l’épargne quand un remboursement y a été placé', () => {
    const savings = (extra: SettlementLine[]) =>
      settlementGroups(
        [{ kind: 'savings', label: 'Épargne versée sur les livrets', amount: 28000 }, ...extra],
        true,
      ).find((group) => group.key === 'savings');
    expect(savings([])?.detailed).toBe(false);
    const detailed = savings([{ kind: 'savings', label: 'MAIF', amount: 10500, transactionId: 'm' }]);
    expect(detailed?.detailed).toBe(true);
    expect(detailed?.total).toBe(-38500);
  });

  it('inverse totaux et lignes pour un membre qui doit au commun', () => {
    const avance = settlementGroups(lines, true).find((group) => group.key === 'avance');
    expect(avance?.total).toBe(-6000);
    expect(avance?.lines.map((line) => line.shown)).toEqual([-6000]);
    expect(avance?.detailed).toBe(true);
  });
});

describe('règlements faits', () => {
  it('ne garde que ceux du mois et du membre', () => {
    const dataset = commonDataset({
      settlements: [
        aSettlement({ id: 'ok' }),
        aSettlement({ id: 'autre-mois', month: '2026-09' }),
        aSettlement({ id: 'autre-membre', memberId: 'm1' }),
      ],
    });
    expect(settlementsOf(dataset, '2026-10', 'm2').map((item) => item.id)).toEqual(['ok']);
  });

  it('déduit le virement de ce que doit le membre : il s’affiche en négatif', () => {
    // Sam doit 500 € au commun et les vire : le règlement vaut −500 € (sens « commun → membre »).
    // Dans son récapitulatif, lu du côté de ce qu'il doit, ce virement vient en déduction.
    expect(settledPayments([aSettlement({ amount: -50000 })], true)).toEqual([
      { id: 's1', date: '2026-10-31', amount: -50000 },
    ]);
  });

  it('déduit le virement de ce que le commun doit au membre', () => {
    expect(settledPayments([aSettlement({ amount: 30000 })], false)).toEqual([
      { id: 's1', date: '2026-10-31', amount: -30000 },
    ]);
  });

  it('marque réglé un membre qui a un règlement et plus rien à régler', () => {
    expect(isSettled([aSettlement()], 0)).toBe(true);
    expect(isSettled([aSettlement()], -100)).toBe(false);
    expect(isSettled([], 0)).toBe(false);
  });
});

describe('virements de fin de mois en attente', () => {
  it('liste les membres qui ont encore un montant à régler', () => {
    const dataset = commonDataset({
      commonMonths: [
        {
          month: '2026-10',
          envelope: 0,
          savingsRates: null,
          adjustments: [{ id: 'adj', memberId: 'm2', label: 'Abonnement', amount: -1500 }],
        },
      ],
    });
    expect(pendingSettlements(dataset, '2026-10')).toEqual([{ memberId: 'm2', amount: -1500 }]);
  });
});

import { mainWorkspace, type Workspace } from '@/core/espaces/workspaces';
import { planRestore, restoreTargets } from '@/core/sauvegarde/restorePlan';
import { createInitialDataset } from '@/core/shared/seed';

const perso = createInitialDataset('2026-11-17', () => 'audit');
const communData = createInitialDataset('2026-11-17', () => 'audit', 'commun');
const me = mainWorkspace('uid-new');
const shared: Workspace = { id: 'commun-ab', name: 'Maison', kind: 'commun', role: 'guest', shared: true };
const context = { main: me, workspaces: [me, shared] };

const backup = [
  {
    workspace: { id: 'perso-uid-old', name: 'Perso', kind: 'perso' as const, role: 'owner' as const },
    dataset: perso,
  },
  {
    workspace: { id: 'commun-ab', name: 'Maison', kind: 'commun' as const, role: 'owner' as const },
    dataset: communData,
  },
  {
    workspace: { id: 'commun-x', name: 'Maison', kind: 'commun' as const, role: 'owner' as const },
    dataset: communData,
  },
];

const counter = () => {
  let next = 0;
  return () => {
    next += 1;
    return `copie-${next}`;
  };
};

describe('restauration chez soi', () => {
  it('perso du fichier → mon perso, commun dont je suis membre → remplacé, autre → copie', () => {
    expect(restoreTargets(backup, context)).toEqual(['main', 'replace', 'copy']);
  });

  it('écrit le perso dans l’espace principal du compte connecté, quel que soit le compte d’origine', () => {
    const plan = planRestore(backup, 'perso-uid-old', context, counter());
    expect(plan.steps[0]?.workspace).toBe(me);
    expect(plan.activeId).toBe(me.id);
  });

  it('garde un espace dont on est membre avec son rôle actuel', () => {
    expect(planRestore(backup, 'commun-ab', context, counter()).steps[1]?.workspace).toBe(shared);
  });

  it('copie un espace dont on n’est pas membre sous un nouvel id et un nom libre, et y bascule', () => {
    const plan = planRestore(backup, 'commun-x', context, counter());
    expect(plan.steps[2]?.workspace).toEqual({
      id: 'copie-1',
      name: 'Maison (restauré)',
      kind: 'commun',
      role: 'owner',
    });
    expect(plan.activeId).toBe('copie-1');
  });

  it('numérote les copies quand le nom est déjà pris plusieurs fois', () => {
    const twice = [backup[2]!, { ...backup[2]!, workspace: { ...backup[2]!.workspace, id: 'commun-y' } }];
    const plan = planRestore(twice, 'commun-x', context, counter());
    expect(plan.steps.map((step) => step.workspace.name)).toEqual([
      'Maison (restauré)',
      'Maison (restauré 2)',
    ]);
  });

  it('un second espace principal dans le fichier devient une copie, jamais un autre perso-<uid>', () => {
    const extra = { ...backup[0]!, workspace: { ...backup[0]!.workspace, id: 'perso-uid-other' } };
    const plan = planRestore([backup[0]!, extra], 'perso-uid-old', context, counter());
    expect(plan.steps.map((step) => [step.target, step.workspace.id])).toEqual([
      ['main', me.id],
      ['copy', 'copie-1'],
    ]);
  });
});

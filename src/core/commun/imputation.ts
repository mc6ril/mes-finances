import type { HouseholdMember, Imputation, TransactionType } from '../shared/model';

export type ImputationChoice = {
  /** Valeur du formulaire : '' pour le commun, sinon « type:membre ». */
  value: string;
  kind: 'commun' | Imputation['kind'];
  memberId: string | null;
};

const COMMON: ImputationChoice = { value: '', kind: 'commun', memberId: null };

const choicesOf = (members: HouseholdMember[], kind: Imputation['kind']): ImputationChoice[] =>
  members.map((member) => ({ value: `${kind}:${member.id}`, kind, memberId: member.id }));

/**
 * Pour qui ou de qui est une opération du commun, selon son type :
 * - dépense : le commun, à la charge d'un membre, ou avancée par un membre ;
 * - revenu : le commun, reçu pour un membre, ou son revenu. Le revenu n'est proposé que pour un
 *   salaire versé sur le commun (l'autre se saisit dans le mois du commun), sauf s'il est déjà choisi.
 * Les virements et investissements ne se rattachent à personne.
 */
export const imputationChoices = (
  members: HouseholdMember[],
  type: TransactionType,
  current = '',
): ImputationChoice[] => {
  if (type === 'depense') {
    return [COMMON, ...choicesOf(members, 'charge'), ...choicesOf(members, 'avance')];
  }
  if (type === 'revenu') {
    const earners = members.filter((member) => member.salaryOnCommon || current === `revenu:${member.id}`);
    return [COMMON, ...choicesOf(members, 'charge'), ...choicesOf(earners, 'revenu')];
  }
  return [];
};

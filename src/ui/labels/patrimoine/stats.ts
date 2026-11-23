/** Précise si le patrimoine personnel inclut la part de l'épargne commune. */
export const patrimoineHint = (hasJointAccount: boolean, shareMissing: boolean): string => {
  if (!hasJointAccount) {
    return 'Épargne et placements';
  }
  if (shareMissing) {
    return 'Hors épargne commune (quote-part à renseigner)';
  }
  return 'Avec ta part de l’épargne commune';
};

import { APP_ERROR_CODES, type AppError } from '@/core/errors';
import { errorMessage } from '@/ui/errorMessages';

describe('messages d’erreur', () => {
  it('a un message en français pour chaque code d’erreur', () => {
    APP_ERROR_CODES.forEach((code) => {
      expect(errorMessage({ code }).trim().length).toBeGreaterThan(10);
    });
  });

  it('précise l’espace et la collection concernés par une sauvegarde corrompue', () => {
    const error: AppError = { code: 'backup-corrupted', detail: 'transactions', workspaceName: 'Commun' };
    expect(errorMessage(error)).toBe(
      'Espace « Commun » : la sauvegarde est corrompue (collection « transactions » invalide).',
    );
  });

  it('nomme le fichier illisible', () => {
    expect(errorMessage({ code: 'file-unreadable', detail: 'releve.csv' })).toBe(
      'Impossible de lire le fichier « releve.csv ».',
    );
  });
});

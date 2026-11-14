import { MIN_PASSWORD_LENGTH } from '@/core/auth/validation';
import type { AppError, AppErrorCode } from '@/core/shared/errors';

const MESSAGES: Record<AppErrorCode, (error: AppError) => string> = {
  'storage-unavailable': () => 'Le stockage local est indisponible (navigation privée ou stockage bloqué).',
  'storage-full': () =>
    'L’espace de stockage du navigateur est plein. Exporte une sauvegarde puis libère de la place.',
  'storage-failed': () => 'Une erreur inattendue est survenue pendant l’enregistrement local.',
  'file-unreadable': ({ detail }) => `Impossible de lire le fichier${detail ? ` « ${detail} »` : ''}.`,
  'file-save-failed': () => 'Le fichier n’a pas pu être enregistré.',
  'invalid-json': () => 'Le fichier n’est pas un JSON valide.',
  'empty-csv': () => 'Le fichier CSV est vide ou illisible.',
  'backup-not-recognized': () => 'Ce fichier n’est pas une sauvegarde de Mes finances.',
  'backup-too-recent': () =>
    'Cette sauvegarde provient d’une version plus récente de l’application. Mets l’application à jour avant de la restaurer.',
  'backup-corrupted': ({ detail }) =>
    detail
      ? `la sauvegarde est corrompue (collection « ${detail} » invalide).`
      : 'la sauvegarde est corrompue.',
  'backup-missing-main': () => 'La sauvegarde ne contient pas l’espace principal.',
  'broker-not-recognized': () => 'Ce fichier ne ressemble pas à un export de transactions Trade Republic.',
  'workspace-name-empty': () => 'Donne un nom à l’espace.',
  'workspace-name-taken': () => 'Un espace porte déjà ce nom.',
  'workspace-not-found': () => 'Espace introuvable.',
  'workspace-main-protected': () =>
    'L’espace principal ne peut être ni supprimé ni remplacé par un import : utilise « Restaurer ».',
  'invalid-date': () => 'Date illisible',
  'invalid-amount': () => 'Montant illisible',
  'data-not-loaded': () => 'Les données ne sont pas encore chargées. Réessaie dans un instant.',
  'auth-not-configured': () =>
    'La connexion n’est pas configurée : renseigne les variables VITE_FIREBASE_* (voir .env.example).',
  'auth-name-empty': () => 'Indique ton prénom.',
  'auth-email-invalid': () => 'Cette adresse e-mail n’est pas valide.',
  'auth-password-empty': () => 'Saisis ton mot de passe.',
  'auth-password-too-short': () =>
    `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  'auth-password-mismatch': () => 'Les deux mots de passe ne correspondent pas.',
  'auth-invalid-credentials': () => 'E-mail ou mot de passe incorrect.',
  'auth-email-taken': () => 'Un compte existe déjà avec cette adresse. Connecte-toi plutôt.',
  'auth-too-many-requests': () => 'Trop de tentatives. Patiente quelques minutes avant de réessayer.',
  'auth-network': () => 'Connexion Internet indisponible. Vérifie ton réseau puis réessaie.',
  'auth-cancelled': () => 'La connexion a été annulée.',
  'auth-popup-blocked': () =>
    'Le navigateur a bloqué la fenêtre de connexion. Autorise les pop-ups puis réessaie.',
  'auth-other-provider': () =>
    'Un compte existe déjà avec cette adresse via une autre méthode. Connecte-toi avec celle-ci.',
  'auth-user-disabled': () => 'Ce compte a été désactivé.',
  'auth-provider-disabled': () => 'Cette méthode de connexion n’est pas activée sur le projet.',
  'auth-unauthorized-domain': () => 'Ce domaine n’est pas autorisé pour la connexion.',
  'auth-failed': () => 'La connexion a échoué. Réessaie dans un instant.',
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const errorMessage = (error: AppError): string => {
  const message = MESSAGES[error.code](error);
  if (error.workspaceName) {
    return `Espace « ${error.workspaceName} » : ${message}`;
  }
  return capitalize(message);
};

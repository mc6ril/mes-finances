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
  'workspace-main-protected': () => 'L’espace principal ne peut pas être supprimé.',
  'workspace-not-owner': () => 'Seul le propriétaire de l’espace peut faire cette action.',
  'workspace-already-shared': () =>
    'Cet espace est déjà partagé. Retire l’accès de la personne invitée avant d’inviter quelqu’un d’autre.',
  'workspace-not-shared': () => 'Cet espace n’est partagé avec personne.',
  'workspace-owner-cannot-leave': () =>
    'Tu es propriétaire de cet espace : retire l’accès de la personne invitée ou supprime l’espace.',
  'invitation-not-found': () => 'Ce lien d’invitation n’existe pas ou a été annulé.',
  'invitation-expired': () => 'Ce lien d’invitation a expiré. Demande-en un nouveau.',
  'invitation-used': () => 'Ce lien d’invitation a déjà servi ou n’est plus valable. Demande-en un nouveau.',
  'invitation-own-workspace': () => 'Ce lien invite dans un espace qui t’appartient déjà.',
  'workspace-schema-too-recent': () =>
    'Cet espace a été modifié avec une version plus récente de l’application. Recharge la page pour la mettre à jour.',
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
  'auth-email-not-verified': () =>
    'Ton adresse n’est pas encore confirmée. Clique sur le lien reçu par e-mail, puis réessaie.',
  'auth-requires-recent-login': () => 'Par sécurité, reconnecte-toi avant de faire cette action.',
  'auth-user-mismatch': () => 'Ce n’est pas le compte Google connecté. Choisis le même compte.',
  'auth-failed': () => 'La connexion a échoué. Réessaie dans un instant.',
  'sync-offline': () =>
    'Connexion Internet indisponible et données pas encore présentes sur cet appareil. Réessaie une fois en ligne.',
  'sync-permission-denied': () =>
    'Accès refusé à ces données : l’espace n’est peut-être plus partagé avec toi.',
  'sync-quota-exceeded': () =>
    'Le quota gratuit quotidien de la base en ligne est atteint. Les modifications seront envoyées plus tard.',
  'sync-document-too-large': () =>
    'Ces données sont trop volumineuses pour être enregistrées en ligne. Exporte une sauvegarde complète.',
  'sync-pending-writes': () =>
    'Des modifications ne sont pas encore envoyées (hors ligne ?). Reconnecte-toi à Internet avant de te déconnecter.',
  'sync-local-data-not-cleared': () =>
    'Déconnexion faite, mais les données de cet appareil n’ont pas pu être effacées : ferme tous les onglets de l’application puis recharge la page.',
  'sync-failed': () => 'L’enregistrement en ligne a échoué. Réessaie dans un instant.',
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const errorMessage = (error: AppError): string => {
  const message = MESSAGES[error.code](error);
  if (error.workspaceName) {
    return `Espace « ${error.workspaceName} » : ${message}`;
  }
  return capitalize(message);
};

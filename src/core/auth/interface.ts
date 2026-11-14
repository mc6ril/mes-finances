import type { Result } from '../shared/errors';
import type { AuthUser, Reauthentication, SignUpCredentials } from './model';

export type AuthListener = (user: AuthUser | null) => void;

/** Fournisseur d'identité : les erreurs techniques sont traduites en codes `auth-*`. */
export interface AuthGatewayInterface {
  onChange(listener: AuthListener): () => void;
  signUp(credentials: SignUpCredentials): Promise<Result<AuthUser>>;
  signIn(email: string, password: string): Promise<Result<AuthUser>>;
  signInWithGoogle(): Promise<Result<AuthUser>>;
  signOut(): Promise<Result<void>>;
  sendPasswordReset(email: string): Promise<Result<void>>;
  sendEmailVerification(): Promise<Result<void>>;
  /** Relit le profil auprès du fournisseur (confirmation d'adresse) ; null si personne n'est connecté. */
  reloadUser(): Promise<Result<AuthUser | null>>;
  /** Redemande l'identité avant une action sensible (mot de passe ou fenêtre Google). */
  reauthenticate(reauthentication: Reauthentication): Promise<Result<void>>;
  /** Supprime définitivement le compte connecté (ré-authentifié juste avant). */
  deleteAccount(): Promise<Result<void>>;
}

/** Données en ligne de l'utilisateur connecté, à effacer avant la suppression du compte (RGPD). */
export interface AccountDataInterface {
  /**
   * Supprime ses espaces, transfère à l'invité les espaces communs partagés, le retire des espaces
   * communs où il est invité et efface ses invitations. Exige le réseau ; peut être relancé.
   */
  erase(): Promise<Result<void>>;
}

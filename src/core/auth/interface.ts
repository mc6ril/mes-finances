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
  /** Supprime définitivement le compte connecté, après ré-authentification. */
  deleteAccount(reauthentication: Reauthentication): Promise<Result<void>>;
}

import {
  needsEmailVerification,
  type AuthUser,
  type Reauthentication,
  type SignUpCredentials,
} from '@/core/auth/model';
import { fail, ok, type AppError, type Failure, type Result } from '@/core/shared/errors';
import type { AuthGatewayInterface, AuthListener } from '@/core/auth/interface';

export type AuthStatus = 'checking' | 'signed-in' | 'unverified' | 'signed-out' | 'unavailable';

export type AuthState = { status: AuthStatus; user: AuthUser | null; error: AppError | null };

type Listener = () => void;

const notConfigured = (): Failure => fail('auth-not-configured');

/**
 * Session de l'utilisateur, observable par l'UI (subscribe / getSnapshot).
 * Sert aussi de passerelle aux cas d'usage : sans fournisseur configuré, tout échoue proprement.
 */
export class AuthSession implements AuthGatewayInterface {
  #gateway: AuthGatewayInterface | null;
  #state: AuthState = { status: 'checking', user: null, error: null };
  #listeners = new Set<Listener>();
  #unsubscribe: (() => void) | null = null;

  constructor(gateway: AuthGatewayInterface | null) {
    this.#gateway = gateway;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): AuthState => this.#state;

  #set(state: AuthState) {
    this.#state = state;
    this.#listeners.forEach((listener) => listener());
  }

  #signedIn(user: AuthUser) {
    this.#set({ status: needsEmailVerification(user) ? 'unverified' : 'signed-in', user, error: null });
  }

  #signedOut() {
    this.#set({ status: 'signed-out', user: null, error: null });
  }

  start(): void {
    if (!this.#gateway) {
      this.#set({ status: 'unavailable', user: null, error: notConfigured().error });
      return;
    }
    if (this.#unsubscribe) {
      return;
    }
    this.#unsubscribe = this.#gateway.onChange((user) => {
      if (user) {
        this.#signedIn(user);
      } else {
        this.#signedOut();
      }
    });
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  onChange(listener: AuthListener): () => void {
    return this.subscribe(() => listener(this.#state.user));
  }

  async #withUser(pending: Promise<Result<AuthUser>>): Promise<Result<AuthUser>> {
    const result = await pending;
    if (result.ok) {
      this.#signedIn(result.value);
    }
    return result;
  }

  signUp(credentials: SignUpCredentials): Promise<Result<AuthUser>> {
    if (!this.#gateway) {
      return Promise.resolve(notConfigured());
    }
    return this.#withUser(this.#gateway.signUp(credentials));
  }

  signIn(email: string, password: string): Promise<Result<AuthUser>> {
    if (!this.#gateway) {
      return Promise.resolve(notConfigured());
    }
    return this.#withUser(this.#gateway.signIn(email, password));
  }

  signInWithGoogle(): Promise<Result<AuthUser>> {
    if (!this.#gateway) {
      return Promise.resolve(notConfigured());
    }
    return this.#withUser(this.#gateway.signInWithGoogle());
  }

  async signOut(): Promise<Result<void>> {
    return this.#gateway ? this.#gateway.signOut() : notConfigured();
  }

  async sendPasswordReset(email: string): Promise<Result<void>> {
    return this.#gateway ? this.#gateway.sendPasswordReset(email) : notConfigured();
  }

  async sendEmailVerification(): Promise<Result<void>> {
    return this.#gateway ? this.#gateway.sendEmailVerification() : notConfigured();
  }

  async reloadUser(): Promise<Result<AuthUser | null>> {
    if (!this.#gateway) {
      return notConfigured();
    }
    const reloaded = await this.#gateway.reloadUser();
    if (reloaded.ok) {
      if (reloaded.value) {
        this.#signedIn(reloaded.value);
      } else {
        this.#signedOut();
      }
    }
    return reloaded;
  }

  /** Au retour sur l'onglet : relit le profil seulement si une confirmation d'adresse est attendue. */
  async refresh(): Promise<Result<void>> {
    if (this.#state.status !== 'unverified') {
      return ok(undefined);
    }
    const reloaded = await this.reloadUser();
    return reloaded.ok ? ok(undefined) : reloaded;
  }

  async deleteAccount(reauthentication: Reauthentication): Promise<Result<void>> {
    if (!this.#gateway) {
      return notConfigured();
    }
    const deleted = await this.#gateway.deleteAccount(reauthentication);
    if (deleted.ok) {
      this.#signedOut();
    }
    return deleted;
  }
}

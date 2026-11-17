import {
  needsEmailVerification,
  type AuthUser,
  type Reauthentication,
  type SignInForm,
  type SignUpForm,
} from '../auth/model';
import {
  validateEmail,
  validateNewPassword,
  validateReauthentication,
  validateSignIn,
  validateSignUp,
} from '../auth/validation';
import { fail, ok, type Result } from '../shared/errors';
import type { AccountDataInterface, AuthGatewayInterface } from '../auth/interface';
import type { SyncGatewayInterface } from '../sync/interface';
import { SIGN_OUT_FLUSH_MS } from '../sync/model';

export type AuthPorts = {
  gateway: AuthGatewayInterface;
  sync: SyncGatewayInterface;
  accountData: AccountDataInterface;
};

export const createAuthUseCases = ({ gateway, sync, accountData }: AuthPorts) => {
  const signUp = async (form: SignUpForm): Promise<Result<AuthUser>> => {
    const credentials = validateSignUp(form);
    if (!credentials.ok) {
      return credentials;
    }
    const created = await gateway.signUp(credentials.value);
    if (!created.ok) {
      return created;
    }
    // Le compte existe : un e-mail de vérification non parti ne doit pas faire échouer l'inscription.
    await gateway.sendEmailVerification();
    return created;
  };

  const signIn = async (form: SignInForm): Promise<Result<AuthUser>> => {
    const credentials = validateSignIn(form);
    if (!credentials.ok) {
      return credentials;
    }
    return gateway.signIn(credentials.value.email, credentials.value.password);
  };

  const signInWithGoogle = (): Promise<Result<AuthUser>> => gateway.signInWithGoogle();

  /** Les modifications faites hors ligne doivent partir avant : les données locales sont ensuite effacées. */
  const signOut = async (): Promise<Result<void>> => {
    const flushed = await sync.flush(SIGN_OUT_FLUSH_MS);
    if (!flushed.ok) {
      return flushed;
    }
    return gateway.signOut();
  };

  /** Renvoie l'adresse normalisée à laquelle le lien a été envoyé. */
  const requestPasswordReset = async (email: string): Promise<Result<string>> => {
    const validEmail = validateEmail(email);
    if (!validEmail.ok) {
      return validEmail;
    }
    const sent = await gateway.sendPasswordReset(validEmail.value);
    if (!sent.ok) {
      return sent;
    }
    return validEmail;
  };

  const resendEmailVerification = (): Promise<Result<void>> => gateway.sendEmailVerification();

  /** Vérifie auprès du fournisseur que l'adresse a été confirmée via le lien reçu. */
  const confirmEmailVerified = async (): Promise<Result<AuthUser>> => {
    const reloaded = await gateway.reloadUser();
    if (!reloaded.ok) {
      return reloaded;
    }
    if (!reloaded.value) {
      return fail('auth-failed');
    }
    return needsEmailVerification(reloaded.value) ? fail('auth-email-not-verified') : ok(reloaded.value);
  };

  /**
   * Lien de confirmation reçu par e-mail. Renvoie l'utilisateur connecté dans ce navigateur, relu pour
   * refléter la confirmation, ou null (personne de connecté, ou relecture impossible : l'adresse reste
   * confirmée et la session la verra au prochain retour sur l'onglet).
   */
  const confirmEmail = async (code: string): Promise<Result<AuthUser | null>> => {
    const applied = await gateway.applyActionCode(code);
    if (!applied.ok) {
      return applied;
    }
    const reloaded = await gateway.reloadUser();
    return ok(reloaded.ok ? reloaded.value : null);
  };

  /** Lien « ce n'était pas moi » reçu après un changement d'adresse : l'ancienne adresse est rétablie. */
  const recoverEmail = async (code: string): Promise<Result<void>> => {
    const applied = await gateway.applyActionCode(code);
    if (!applied.ok) {
      return applied;
    }
    await gateway.reloadUser();
    return ok(undefined);
  };

  /** Vérifie le lien de réinitialisation avant d'afficher le formulaire ; renvoie l'adresse du compte. */
  const verifyPasswordReset = (code: string): Promise<Result<string>> =>
    gateway.verifyPasswordResetCode(code);

  const resetPassword = async (
    code: string,
    password: string,
    confirmation: string,
  ): Promise<Result<void>> => {
    const valid = validateNewPassword({ password, confirmation });
    if (!valid.ok) {
      return valid;
    }
    return gateway.confirmPasswordReset(code, valid.value);
  };

  /** Les données en ligne sont effacées avant le compte : si elles ne peuvent pas l'être, le compte reste. */
  const deleteAccount = async (reauthentication: Reauthentication): Promise<Result<void>> => {
    const valid = validateReauthentication(reauthentication);
    if (!valid.ok) {
      return valid;
    }
    const reauthenticated = await gateway.reauthenticate(valid.value);
    if (!reauthenticated.ok) {
      return reauthenticated;
    }
    const erased = await accountData.erase();
    if (!erased.ok) {
      return erased;
    }
    return gateway.deleteAccount();
  };

  return {
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    requestPasswordReset,
    resendEmailVerification,
    confirmEmailVerified,
    confirmEmail,
    recoverEmail,
    verifyPasswordReset,
    resetPassword,
    deleteAccount,
  };
};

export type AuthUseCases = ReturnType<typeof createAuthUseCases>;

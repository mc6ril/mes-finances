import type { AuthUser, SignInForm, SignUpForm } from '../auth/model';
import { validateEmail, validateSignIn, validateSignUp } from '../auth/validation';
import type { Result } from '../shared/errors';
import type { AuthGatewayInterface } from '../auth/interface';

export type AuthPorts = { gateway: AuthGatewayInterface };

export const createAuthUseCases = ({ gateway }: AuthPorts) => {
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

  const signOut = (): Promise<Result<void>> => gateway.signOut();

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

  return { signUp, signIn, signInWithGoogle, signOut, requestPasswordReset, resendEmailVerification };
};

export type AuthUseCases = ReturnType<typeof createAuthUseCases>;

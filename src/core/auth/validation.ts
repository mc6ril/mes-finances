import { fail, ok, type Result } from '../shared/errors';
import type { NewPasswordForm, Reauthentication, SignInForm, SignUpCredentials, SignUpForm } from './model';

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const validateEmail = (email: string): Result<string> => {
  const normalized = normalizeEmail(email);
  return EMAIL_PATTERN.test(normalized) ? ok(normalized) : fail('auth-email-invalid');
};

export const validateSignIn = ({ email, password }: SignInForm): Result<SignInForm> => {
  const validEmail = validateEmail(email);
  if (!validEmail.ok) {
    return validEmail;
  }
  if (password.length === 0) {
    return fail('auth-password-empty');
  }
  return ok({ email: validEmail.value, password });
};

/** Mot de passe choisi (inscription, réinitialisation) : longueur minimale et confirmation identique. */
export const validateNewPassword = ({ password, confirmation }: NewPasswordForm): Result<string> => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail('auth-password-too-short');
  }
  if (password !== confirmation) {
    return fail('auth-password-mismatch');
  }
  return ok(password);
};

export const validateSignUp = (form: SignUpForm): Result<SignUpCredentials> => {
  const displayName = form.displayName.trim();
  if (!displayName) {
    return fail('auth-name-empty');
  }
  const validEmail = validateEmail(form.email);
  if (!validEmail.ok) {
    return validEmail;
  }
  const password = validateNewPassword(form);
  if (!password.ok) {
    return password;
  }
  return ok({ displayName, email: validEmail.value, password: password.value });
};

export const validateReauthentication = (reauthentication: Reauthentication): Result<Reauthentication> => {
  if (reauthentication.method === 'password' && reauthentication.password.length === 0) {
    return fail('auth-password-empty');
  }
  return ok(reauthentication);
};

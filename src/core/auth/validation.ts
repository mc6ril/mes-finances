import { fail, ok, type Result } from '../shared/errors';
import type { Reauthentication, SignInForm, SignUpCredentials, SignUpForm } from './model';

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

export const validateSignUp = (form: SignUpForm): Result<SignUpCredentials> => {
  const displayName = form.displayName.trim();
  if (!displayName) {
    return fail('auth-name-empty');
  }
  const validEmail = validateEmail(form.email);
  if (!validEmail.ok) {
    return validEmail;
  }
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    return fail('auth-password-too-short');
  }
  if (form.password !== form.confirmation) {
    return fail('auth-password-mismatch');
  }
  return ok({ displayName, email: validEmail.value, password: form.password });
};

export const validateReauthentication = (reauthentication: Reauthentication): Result<Reauthentication> => {
  if (reauthentication.method === 'password' && reauthentication.password.length === 0) {
    return fail('auth-password-empty');
  }
  return ok(reauthentication);
};

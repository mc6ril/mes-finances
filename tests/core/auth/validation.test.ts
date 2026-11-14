import {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  validateEmail,
  validateSignIn,
  validateSignUp,
} from '@/core/auth/validation';

const validSignUp = {
  displayName: '  Camille  ',
  email: ' Camille.D@Example.com ',
  password: 'motdepasse',
  confirmation: 'motdepasse',
};

describe('adresse e-mail', () => {
  it('supprime les espaces et passe en minuscules', () => {
    expect(normalizeEmail('  Jean.D@Example.COM ')).toBe('jean.d@example.com');
  });

  it.each(['', '   ', 'jean', 'jean@', '@example.com', 'jean@example', 'jean d@example.com'])(
    'refuse « %s »',
    (email) => {
      expect(validateEmail(email)).toEqual({ ok: false, error: { code: 'auth-email-invalid' } });
    },
  );

  it('accepte une adresse valide et la renvoie normalisée', () => {
    expect(validateEmail(' Jean.D+finances@Example.fr ')).toEqual({
      ok: true,
      value: 'jean.d+finances@example.fr',
    });
  });
});

describe('validation de la connexion', () => {
  it('exige une adresse e-mail valide', () => {
    expect(validateSignIn({ email: 'jean', password: 'x' })).toEqual({
      ok: false,
      error: { code: 'auth-email-invalid' },
    });
  });

  it('exige un mot de passe', () => {
    expect(validateSignIn({ email: 'jean@example.com', password: '' })).toEqual({
      ok: false,
      error: { code: 'auth-password-empty' },
    });
  });

  it('normalise l’e-mail sans toucher au mot de passe', () => {
    expect(validateSignIn({ email: ' Jean@Example.com', password: ' secret ' })).toEqual({
      ok: true,
      value: { email: 'jean@example.com', password: ' secret ' },
    });
  });
});

describe('validation de l’inscription', () => {
  it('exige un prénom', () => {
    expect(validateSignUp({ ...validSignUp, displayName: '   ' })).toEqual({
      ok: false,
      error: { code: 'auth-name-empty' },
    });
  });

  it('exige une adresse e-mail valide', () => {
    expect(validateSignUp({ ...validSignUp, email: 'camille@' })).toEqual({
      ok: false,
      error: { code: 'auth-email-invalid' },
    });
  });

  it(`exige au moins ${MIN_PASSWORD_LENGTH} caractères`, () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateSignUp({ ...validSignUp, password: short, confirmation: short })).toEqual({
      ok: false,
      error: { code: 'auth-password-too-short' },
    });
  });

  it('exige une confirmation identique', () => {
    expect(validateSignUp({ ...validSignUp, confirmation: 'motdepassf' })).toEqual({
      ok: false,
      error: { code: 'auth-password-mismatch' },
    });
  });

  it('renvoie des identifiants nettoyés', () => {
    expect(validateSignUp(validSignUp)).toEqual({
      ok: true,
      value: { displayName: 'Camille', email: 'camille.d@example.com', password: 'motdepasse' },
    });
  });
});

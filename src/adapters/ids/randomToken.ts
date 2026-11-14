const TOKEN_BYTES = 24;

/** Secret d'un lien d'invitation : 192 bits aléatoires, 32 caractères base64url. */
export const randomToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

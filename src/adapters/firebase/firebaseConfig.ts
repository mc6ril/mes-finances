import type { FirebaseOptions } from 'firebase/app';

type Env = Record<string, string | boolean | undefined>;

const KEYS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const;

/** Configuration web Firebase lue dans les variables Vite ; null si une valeur manque. */
export const readFirebaseConfig = (env: Env): FirebaseOptions | null => {
  const entries = Object.entries(KEYS).map(([option, key]) => [option, env[key]] as const);
  if (entries.some(([, value]) => typeof value !== 'string' || value.trim() === '')) {
    return null;
  }
  return Object.fromEntries(entries) as FirebaseOptions;
};

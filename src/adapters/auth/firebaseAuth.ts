import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { AuthGatewayInterface } from '@/core/auth/interface';
import { FirebaseAuthGateway } from './FirebaseAuthGateway';
import { readFirebaseConfig } from './firebaseConfig';

/** Initialise Firebase Auth (session conservée dans le navigateur) ; null si la configuration manque. */
export const createFirebaseAuthGateway = (env: ImportMetaEnv): AuthGatewayInterface | null => {
  const config = readFirebaseConfig(env);
  if (!config) {
    return null;
  }
  const auth = getAuth(initializeApp(config));
  auth.languageCode = 'fr';
  return new FirebaseAuthGateway(auth);
};

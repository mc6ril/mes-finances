import { getAuth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { AuthGatewayInterface } from '@/core/auth/interface';
import { FirebaseAuthGateway } from './FirebaseAuthGateway';

/** Firebase Auth (session conservée dans le navigateur, textes en français). */
export const createFirebaseAuthGateway = (app: FirebaseApp): AuthGatewayInterface => {
  const auth = getAuth(app);
  auth.languageCode = 'fr';
  return new FirebaseAuthGateway(auth);
};

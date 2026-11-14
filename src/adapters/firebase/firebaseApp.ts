import { initializeApp, type FirebaseApp } from 'firebase/app';
import { readFirebaseConfig } from './firebaseConfig';

let app: FirebaseApp | null | undefined;

/** Application Firebase partagée par l'authentification et la base ; null si la configuration manque. */
export const firebaseApp = (env: ImportMetaEnv): FirebaseApp | null => {
  if (app === undefined) {
    const config = readFirebaseConfig(env);
    app = config ? initializeApp(config) : null;
  }
  return app;
};

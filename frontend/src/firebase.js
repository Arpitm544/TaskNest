import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Assumes your Firebase config is provided via Vite env vars.
// If you already have a firebase config file, you can delete this and reuse yours.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configured = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId;
export const auth = configured ? getAuth(initializeApp(firebaseConfig)) : null;


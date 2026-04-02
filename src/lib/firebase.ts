import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
);

const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const initFirebaseAnalytics = async () => {
  if (!firebaseApp || typeof window === 'undefined' || !firebaseConfig.measurementId) {
    return null;
  }

  const analytics = await import('firebase/analytics');
  const supported = await analytics.isSupported();
  if (!supported) return null;
  return analytics.getAnalytics(firebaseApp);
};

let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;

const initFirebaseAuth = async (): Promise<Auth | null> => {
  if (!firebaseApp || typeof window === 'undefined') return null;
  if (firebaseAuth) return firebaseAuth;

  const auth = await import('firebase/auth');
  firebaseAuth = auth.getAuth(firebaseApp);
  return firebaseAuth;
};

const initFirebaseFirestore = async (): Promise<Firestore | null> => {
  if (!firebaseApp || typeof window === 'undefined') return null;
  if (firebaseDb) return firebaseDb;

  const firestore = await import('firebase/firestore');
  firebaseDb = firestore.getFirestore(firebaseApp);
  return firebaseDb;
};

const initFirebaseStorage = async (): Promise<FirebaseStorage | null> => {
  if (!firebaseApp || typeof window === 'undefined') return null;
  if (firebaseStorage) return firebaseStorage;

  const storage = await import('firebase/storage');
  firebaseStorage = storage.getStorage(firebaseApp, 'gs://autohire247.firebasestorage.app');
  return firebaseStorage;
};

const signInWithEmailPassword = async (email: string, password: string) => {
  const auth = await initFirebaseAuth();
  if (!auth) throw new Error('Firebase auth is not configured');
  const firebaseAuthLib = await import('firebase/auth');
  return firebaseAuthLib.signInWithEmailAndPassword(auth, email, password);
};

const signUpWithEmailPassword = async (email: string, password: string) => {
  const auth = await initFirebaseAuth();
  if (!auth) throw new Error('Firebase auth is not configured');
  const firebaseAuthLib = await import('firebase/auth');
  return firebaseAuthLib.createUserWithEmailAndPassword(auth, email, password);
};

const signInWithGooglePopup = async () => {
  const auth = await initFirebaseAuth();
  if (!auth) throw new Error('Firebase auth is not configured');
  const firebaseAuthLib = await import('firebase/auth');
  const provider = new firebaseAuthLib.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return firebaseAuthLib.signInWithPopup(auth, provider);
};

export {
  firebaseApp,
  firebaseConfig,
  isFirebaseConfigured,
  initFirebaseAnalytics,
  initFirebaseAuth,
  initFirebaseFirestore,
  initFirebaseStorage,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithGooglePopup,
};

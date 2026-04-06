import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const hasAdminCredentials = Boolean(projectId && clientEmail && privateKey);
const hasAdminStorageConfig = Boolean(storageBucket);
const hasAdminConfig = hasAdminCredentials;

let adminInitError: string | null = null;
let adminApp = getApps()[0] ?? null;

if (!adminApp && hasAdminCredentials) {
  try {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      ...(storageBucket ? { storageBucket } : {}),
    });
  } catch (error) {
    adminInitError = error instanceof Error ? error.message : 'Failed to initialize Firebase Admin';
    adminApp = null;
  }
}

const adminDb = adminApp ? getFirestore(adminApp) : null;
const adminStorage = adminApp && storageBucket ? getStorage(adminApp).bucket(storageBucket) : null;
const adminAuth = adminApp ? getAuth(adminApp) : null;

export { hasAdminConfig, hasAdminCredentials, hasAdminStorageConfig, adminInitError, adminDb, adminStorage, adminAuth };

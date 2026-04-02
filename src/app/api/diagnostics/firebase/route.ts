import { NextResponse } from 'next/server';
import { adminDb, adminStorage, hasAdminConfig } from '@/lib/firebaseAdmin';
import { isSuperAdmin, verifyRequestUser } from '@/lib/serverAuth';

const collectionNames = [
  'users',
  'workflow_states',
  'applications',
  'tasks',
  'tailored_resumes',
  'dispatch',
  'searched',
  'applied',
] as const;

type CollectionCount = {
  name: (typeof collectionNames)[number];
  count: number | null;
  error?: string;
};

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const requestUser = await verifyRequestUser(req);
  if (!requestUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const superAdmin = await isSuperAdmin(requestUser);
  if (!superAdmin) {
    return NextResponse.json({ error: 'Forbidden: superadmin access required' }, { status: 403 });
  }

  const envChecks = {
    firebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    firebaseClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    firebasePrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    firebaseStorageBucket: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
    nextPublicApiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  };

  if (!hasAdminConfig || !adminDb || !adminStorage) {
    return NextResponse.json({
      ok: false,
      message: 'Firebase Admin is not fully configured.',
      envChecks,
      hasAdminConfig,
      firestoreReachable: false,
      storageReachable: false,
      collections: [] as CollectionCount[],
    });
  }

  let firestoreReachable = false;
  let storageReachable = false;
  const collectionCounts: CollectionCount[] = [];

  try {
    await adminDb.listCollections();
    firestoreReachable = true;
  } catch {
    firestoreReachable = false;
  }

  try {
    await adminStorage.getFiles({ maxResults: 1 });
    storageReachable = true;
  } catch {
    storageReachable = false;
  }

  for (const name of collectionNames) {
    try {
      const aggregate = await adminDb.collection(name).count().get();
      collectionCounts.push({ name, count: aggregate.data().count });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown count error';
      collectionCounts.push({ name, count: null, error: message });
    }
  }

  return NextResponse.json({
    ok: firestoreReachable && storageReachable,
    message: 'Firebase diagnostics collected.',
    envChecks,
    hasAdminConfig,
    firestoreReachable,
    storageReachable,
    collections: collectionCounts,
  });
}

import { NextResponse } from 'next/server';
import { adminAuth, adminDb, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const requestUser = await verifyRequestUser(req);
  if (!requestUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAdminConfig || !adminDb) {
    return NextResponse.json({ error: 'Firebase Admin is not configured.' }, { status: 500 });
  }

  const userRef = adminDb.collection('users').doc(requestUser.uid);
  const existing = await userRef.get();
  const existingData = existing.data() ?? {};
  const existingRole = typeof existingData.role === 'string' ? existingData.role : null;

  const superAdminSnapshot = await adminDb.collection('users').where('role', '==', 'superadmin').limit(1).get();
  const hasAnySuperAdmin = !superAdminSnapshot.empty;

  const role = !hasAnySuperAdmin || existingRole === 'superadmin' ? 'superadmin' : 'user';
  const now = new Date().toISOString();

  await userRef.set(
    {
      userId: requestUser.uid,
      email: requestUser.email,
      role,
      updatedAt: now,
      createdAt: existingData.createdAt ?? now,
    },
    { merge: true }
  );

  if (adminAuth && role === 'superadmin') {
    const userRecord = await adminAuth.getUser(requestUser.uid);
    const claims = userRecord.customClaims ?? {};
    if (claims.role !== 'superadmin' || claims.superadmin !== true) {
      await adminAuth.setCustomUserClaims(requestUser.uid, {
        ...claims,
        role: 'superadmin',
        superadmin: true,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    userId: requestUser.uid,
    role,
    promotedToSuperAdmin: role === 'superadmin' && !hasAnySuperAdmin,
  });
}

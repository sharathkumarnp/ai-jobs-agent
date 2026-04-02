import { adminAuth, adminDb, hasAdminConfig } from '@/lib/firebaseAdmin';

export type VerifiedRequestUser = {
  uid: string;
  email: string | null;
  claims: Record<string, unknown>;
};

export async function verifyRequestUser(req: Request): Promise<VerifiedRequestUser | null> {
  if (!hasAdminConfig || !adminAuth) return null;

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      claims: decoded as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export async function isSuperAdmin(user: VerifiedRequestUser): Promise<boolean> {
  const roleClaim = user.claims.role;
  const flagClaim = user.claims.superadmin;
  if (roleClaim === 'superadmin' || flagClaim === true) return true;

  if (!adminDb) return false;
  try {
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const role = userDoc.data()?.role;
    return role === 'superadmin';
  } catch {
    return false;
  }
}

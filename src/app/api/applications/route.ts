import { NextResponse } from 'next/server';
import { adminDb, adminInitError, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  source: string | null;
  url: string | null;
  updatedAt: string | null;
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const makeKey = (company: string | null, role: string | null, source: string | null, url: string | null) =>
  `${(company || '').toLowerCase()}::${(role || '').toLowerCase()}::${(source || '').toLowerCase()}::${(url || '').toLowerCase()}`;

export async function GET(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAdminConfig || !adminDb) {
      return NextResponse.json({ error: adminInitError || 'Firebase Admin is not configured.' }, { status: 500 });
    }

    const [appsSnapshot, searchedSnapshot, appliedSnapshot] = await Promise.all([
      adminDb.collection('applications').where('userId', '==', requestUser.uid).limit(500).get(),
      adminDb.collection('searched').where('userId', '==', requestUser.uid).limit(500).get(),
      adminDb.collection('applied').where('userId', '==', requestUser.uid).limit(500).get(),
    ]);

    const merged = new Map<string, ApplicationRow>();

    for (const doc of appsSnapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const status = asString(data.status) ?? 'unknown';
      const company = asString(data.company) ?? 'Unknown company';
      const role = asString(data.title) ?? asString(data.role) ?? 'Unknown role';
      const source = asString(data.source);
      const url = asString(data.url);
      const updatedAt =
        asString(data.updatedAt) ??
        asString(data.searchedAt) ??
        asString(data.appliedAt) ??
        null;

      const key = makeKey(company, role, source, url);
      merged.set(key, {
        id: doc.id,
        company,
        role,
        status,
        source,
        url,
        updatedAt,
      });
    }

    for (const doc of searchedSnapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const company = asString(data.company) ?? 'Unknown company';
      const role = asString(data.title) ?? asString(data.role) ?? 'Unknown role';
      const source = asString(data.source);
      const url = asString(data.url);
      const updatedAt = asString(data.searchedAt) ?? asString(data.updatedAt) ?? null;
      const key = makeKey(company, role, source, url);

      if (!merged.has(key)) {
        merged.set(key, {
          id: `searched-${doc.id}`,
          company,
          role,
          status: 'searched',
          source,
          url,
          updatedAt,
        });
      }
    }

    for (const doc of appliedSnapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const message = asString(data.message) ?? '';
      const company = asString(data.company) ?? (message.match(/for\s+(.+?)\s+\(/i)?.[1] ?? 'Unknown company');
      const role = asString(data.title) ?? asString(data.role) ?? 'Unknown role';
      const source = asString(data.source);
      const url = asString(data.url);
      const updatedAt = asString(data.appliedAt) ?? asString(data.updatedAt) ?? null;
      const key = makeKey(company, role, source, url);

      const existing = merged.get(key);
      if (existing) {
        if (existing.status !== 'submitted') {
          merged.set(key, { ...existing, status: 'submitted', updatedAt: updatedAt ?? existing.updatedAt });
        }
      } else {
        merged.set(key, {
          id: `applied-${doc.id}`,
          company,
          role,
          status: 'submitted',
          source,
          url,
          updatedAt,
        });
      }
    }

    const rows = Array.from(merged.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return NextResponse.json({ applications: rows, total: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load applications.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAdminConfig || !adminDb) {
      return NextResponse.json({ error: adminInitError || 'Firebase Admin is not configured.' }, { status: 500 });
    }

    const body = (await req.json()) as { applicationId?: string; action?: 'approve' | 'reject' };
    if (!body.applicationId || !body.action) {
      return NextResponse.json({ error: 'applicationId and action are required.' }, { status: 400 });
    }

    const appRef = adminDb.collection('applications').doc(body.applicationId);
    const appDoc = await appRef.get();
    if (!appDoc.exists) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    const appData = appDoc.data() as Record<string, unknown>;
    if (appData.userId !== requestUser.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const company = typeof appData.company === 'string' ? appData.company : 'Unknown company';
    const role = typeof appData.title === 'string' ? appData.title : 'Unknown role';
    const source = typeof appData.source === 'string' ? appData.source : 'Unknown source';

    if (body.action === 'approve') {
      await appRef.set(
        {
          status: 'submitted',
          approvedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await Promise.all([
        adminDb.collection('dispatch').add({
          userId: requestUser.uid,
          email: requestUser.email,
          message: `Manual approval confirmed for ${company} (${role}).`,
          dispatchedAt: now,
          source,
          applicationId: body.applicationId,
        }),
        adminDb.collection('applied').add({
          userId: requestUser.uid,
          email: requestUser.email,
          message: `Application marked submitted after manual approval for ${company} (${role}).`,
          appliedAt: now,
          source,
          applicationId: body.applicationId,
        }),
      ]);
    } else {
      await appRef.set(
        {
          status: 'rejected',
          rejectedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update application.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

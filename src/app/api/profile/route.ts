import { NextResponse } from 'next/server';
import { adminDb, adminInitError, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

type ProfileSectionKey = 'generalInfo' | 'apiConfig' | 'subscription' | 'security';

export async function GET(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAdminConfig || !adminDb) {
      return NextResponse.json(
        { error: adminInitError || 'Firebase Admin is not configured.' },
        { status: 500 }
      );
    }

    const doc = await adminDb.collection('users').doc(requestUser.uid).get();
    const data = doc.data() ?? {};

    const profile =
      data.profile && typeof data.profile === 'object'
        ? (data.profile as Record<string, unknown>)
        : {};

    return NextResponse.json({
      profile,
      user: {
        userId: requestUser.uid,
        email: requestUser.email,
        role: data.role ?? 'user',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAdminConfig || !adminDb) {
      return NextResponse.json(
        { error: adminInitError || 'Firebase Admin is not configured.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      section?: ProfileSectionKey;
      value?: Record<string, unknown>;
    };

    if (!body.section || !['generalInfo', 'apiConfig', 'subscription', 'security'].includes(body.section)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
    }

    if (!body.value || typeof body.value !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await adminDb
      .collection('users')
      .doc(requestUser.uid)
      .set(
        {
          userId: requestUser.uid,
          email: requestUser.email,
          profile: {
            [body.section]: body.value,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, section: body.section });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save profile settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

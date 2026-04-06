import { NextResponse } from 'next/server';
import { adminDb, adminStorage, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

type TailoredResumeItem = {
  id: string;
  company: string | null;
  title: string | null;
  source: string | null;
  confidence: number | null;
  createdAt: string | null;
  storagePath: string | null;
  resumeText: string;
  downloadUrl: string | null;
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

export async function GET(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAdminConfig || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin is not configured.' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || 25);
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 25;

    const snapshot = await adminDb
      .collection('tailored_resumes')
      .where('userId', '==', requestUser.uid)
      .limit(safeLimit)
      .get();

    const resumes = await Promise.all(
      snapshot.docs.map(async (doc): Promise<TailoredResumeItem> => {
        const data = doc.data() as Record<string, unknown>;
        const storagePath = asString(data.storagePath);
        let downloadUrl: string | null = null;

        if (adminStorage && storagePath) {
          try {
            const [url] = await adminStorage.file(storagePath).getSignedUrl({
              action: 'read',
              expires: Date.now() + 1000 * 60 * 15,
            });
            downloadUrl = url;
          } catch {
            downloadUrl = null;
          }
        }

        return {
          id: doc.id,
          company: asString(data.company),
          title: asString(data.title),
          source: asString(data.source),
          confidence: asNumber(data.confidence),
          createdAt: asString(data.createdAt),
          storagePath,
          resumeText: asString(data.tailoredResume) ?? '',
          downloadUrl,
        };
      })
    );

    resumes.sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });

    return NextResponse.json({ resumes });
  } catch (error) {
    console.error('Tailored resume list error:', error);
    return NextResponse.json({ error: 'Failed to load tailored resumes.' }, { status: 500 });
  }
}

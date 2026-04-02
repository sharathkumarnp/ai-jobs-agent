import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminDb, adminStorage, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const isPlaceholderMasterResume = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('no master resume detected') ||
    normalized.includes('fallback base used') ||
    normalized.includes('no master resume was provided')
  );
};

export async function POST(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobDescription, masterResume, job } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: 'Missing required context' }, { status: 400 });
    }

    const persistTailoredResume = async (payload: { tailoredResume: string; confidence: number }) => {
      if (!hasAdminConfig || !adminDb) return;
      const ownerId = requestUser.uid;
      const ownerEmail = requestUser.email;
      const now = new Date().toISOString();
      const timestamp = Date.now();
      const safeCompany = typeof job?.company === 'string' ? job.company.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() : 'company';
      const safeTitle = typeof job?.title === 'string' ? job.title.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() : 'role';
      const storagePath = `resumes/${ownerId}/tailored/${timestamp}-${safeCompany}-${safeTitle}.txt`;

      if (adminStorage) {
        const object = adminStorage.file(storagePath);
        await object.save(payload.tailoredResume, {
          metadata: {
            contentType: 'text/plain; charset=utf-8',
            metadata: {
              uploadedBy: ownerId,
              uploadedByEmail: ownerEmail || 'unknown',
              type: 'tailored-resume',
            },
          },
        });
      }

      const entry = {
        userId: ownerId,
        email: ownerEmail,
        company: typeof job?.company === 'string' ? job.company : null,
        title: typeof job?.title === 'string' ? job.title : null,
        source: typeof job?.source === 'string' ? job.source : null,
        confidence: payload.confidence,
        tailoredResume: payload.tailoredResume,
        storagePath: adminStorage ? storagePath : null,
        createdAt: now,
      };
      await adminDb.collection('tailored_resumes').add(entry);
    };

    let effectiveMasterResume = typeof masterResume === 'string' ? masterResume.trim() : '';
    if (isPlaceholderMasterResume(effectiveMasterResume)) {
      effectiveMasterResume = '';
    }
    if (!effectiveMasterResume && hasAdminConfig && adminDb) {
      try {
        const latest = await adminDb.collection('master_resumes').doc(requestUser.uid).get();
        const fromMasterCollection = latest.data()?.text;
        if (typeof fromMasterCollection === 'string' && fromMasterCollection.trim()) {
          effectiveMasterResume = fromMasterCollection.trim();
        } else {
          const userDoc = await adminDb.collection('users').doc(requestUser.uid).get();
          const fallbackText = userDoc.data()?.latestResume?.extractedText;
          if (typeof fallbackText === 'string' && fallbackText.trim()) {
            effectiveMasterResume = fallbackText.trim();
          }
        }
      } catch {
        // If lookup fails, we still return a clear message below.
      }
    }

    if (!effectiveMasterResume) {
      return NextResponse.json(
        {
          error: 'No Master Resume was provided or found in your account. Please upload and parse your resume first.',
        },
        { status: 400 }
      );
    }

    if (!ai) {
      // Mock generation if API key is missing
      const mocked = {
        tailoredResume: `[MOCKED TAILORED RESUME]\n\nGenerated for: ${jobDescription}\n\nThe system has detected missing GEMINI_API_KEY. Add it to .env.local to activate Live LLM capabilities.`,
        confidence: 0.85 
      };
      await persistTailoredResume(mocked);
      return NextResponse.json(mocked);
    }

    const prompt = `You are an expert ATS-Optimization AI.
Given the master resume below, tailor it specifically against the provided job description.
Highlight relevant experience, strip irrelevant bullets, and ensure keywords match perfectly.
Return ONLY the tailored resume text.
Do NOT invent companies, roles, years, metrics, links, or contact details that are not present in the master resume.
If a detail is missing in the master resume, omit it instead of fabricating.

=== JOB DESCRIPTION ===
${jobDescription}

=== MASTER RESUME ===
${effectiveMasterResume}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const result = {
      tailoredResume: response.text,
      confidence: 0.98
    };
    await persistTailoredResume(result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Tailoring Engine Error:', error);
    return NextResponse.json({ error: 'Failed to tailor' }, { status: 500 });
  }
}

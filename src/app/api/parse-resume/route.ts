import { NextResponse } from 'next/server';
import { adminDb, adminStorage, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';

export async function POST(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('resume') as File | null;
    const userId = requestUser.uid;
    const userEmail = requestUser.email;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF with an ESM/CJS-safe resolver for Turbopack.
    const pdfParseModule = await import('pdf-parse');
    const moduleDefault = (pdfParseModule as { default?: unknown }).default;

    let parser: ((input: Buffer) => Promise<{ text: string; numpages: number; info: unknown }>) | null = null;
    if (typeof moduleDefault === 'function') {
      parser = moduleDefault as (input: Buffer) => Promise<{ text: string; numpages: number; info: unknown }>;
    } else if (typeof (moduleDefault as { default?: unknown })?.default === 'function') {
      parser = (moduleDefault as { default: (input: Buffer) => Promise<{ text: string; numpages: number; info: unknown }> })
        .default;
    } else if (typeof (pdfParseModule as unknown) === 'function') {
      parser = pdfParseModule as unknown as (input: Buffer) => Promise<{ text: string; numpages: number; info: unknown }>;
    }

    if (!parser) {
      throw new Error('Unable to resolve pdf-parse parser function.');
    }

    const data = await parser(buffer);

    let storagePath: string | null = null;
    if (hasAdminConfig && adminStorage) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `resumes/${userId}/${timestamp}-${safeName}`;
      const object = adminStorage.file(storagePath);
      await object.save(buffer, {
        metadata: {
          contentType: file.type || 'application/pdf',
          metadata: {
            uploadedBy: userId,
            uploadedByEmail: userEmail || 'unknown',
          },
        },
      });
    }

    if (hasAdminConfig && adminDb) {
      await adminDb.collection('users').doc(userId).set(
        {
          userId,
          email: userEmail,
          latestResume: {
            fileName: file.name,
            pages: data.numpages,
            storagePath,
            extractedText: data.text,
            uploadedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await adminDb.collection('master_resumes').doc(userId).set(
        {
          userId,
          email: userEmail,
          text: data.text,
          fileName: file.name,
          storagePath,
          pages: data.numpages,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    
    return NextResponse.json({
      text: data.text,
      pages: data.numpages,
      info: data.info,
      storagePath
    });

  } catch (error) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}

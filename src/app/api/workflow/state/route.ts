import { NextResponse } from 'next/server';
import { adminDb, adminInitError, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAdminConfig || !adminDb) {
      return NextResponse.json({ error: adminInitError || 'Firebase Admin is not configured.' }, { status: 500 });
    }

    const workflowDoc = await adminDb.collection('workflow_states').doc(requestUser.uid).get();
    const workflowData = workflowDoc.data() ?? {};

    let workflowState =
      workflowData.workflowState && typeof workflowData.workflowState === 'object'
        ? (workflowData.workflowState as Record<string, unknown>)
        : null;

    // Backward-compat migration read: old shape in users/{uid}.workflowState
    if (!workflowState) {
      const legacyDoc = await adminDb.collection('users').doc(requestUser.uid).get();
      const legacyData = legacyDoc.data() ?? {};
      workflowState =
        legacyData.workflowState && typeof legacyData.workflowState === 'object'
          ? (legacyData.workflowState as Record<string, unknown>)
          : {};
    }

    return NextResponse.json({ workflowState });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load workflow state.';
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
      return NextResponse.json({ error: adminInitError || 'Firebase Admin is not configured.' }, { status: 500 });
    }

    const body = (await req.json()) as {
      metrics?: {
        scanned: number;
        discarded: number;
        tailored: number;
        submitted: number;
        failed: number;
      };
      activityLogs?: Array<{
        id: string;
        timestamp: string;
        nodeId: 'discovery' | 'filter' | 'forge' | 'dispatcher';
        message: string;
      }>;
      blueprintConfig?: {
        targetRole: string;
        location: string;
        workMode: string;
        blacklisted: string[];
        experience: number;
        compensation: number;
      };
    };

    const workflowState: Record<string, unknown> = {};
    if (body.metrics) workflowState.metrics = body.metrics;
    if (Array.isArray(body.activityLogs)) workflowState.activityLogs = body.activityLogs.slice(0, 100);
    if (body.blueprintConfig) workflowState.blueprintConfig = body.blueprintConfig;

    await adminDb.collection('workflow_states').doc(requestUser.uid).set(
      {
        userId: requestUser.uid,
        email: requestUser.email,
        workflowState,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save workflow state.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

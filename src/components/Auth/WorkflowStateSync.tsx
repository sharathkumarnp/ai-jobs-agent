'use client';

import React from 'react';
import { initFirebaseAuth } from '@/lib/firebase';
import { useWorkflowStore } from '@/store/useWorkflowStore';

type PersistedWorkflowState = {
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

export function WorkflowStateSync() {
  const currentUserId = useWorkflowStore((s) => s.currentUserId);
  const metrics = useWorkflowStore((s) => s.metrics);
  const activityLogs = useWorkflowStore((s) => s.activityLogs);
  const blueprintConfig = useWorkflowStore((s) => s.blueprintConfig);
  const hydrateFromRemote = useWorkflowStore((s) => s.hydrateFromRemote);

  const [hydratedUserId, setHydratedUserId] = React.useState<string | null>(null);
  const isHydratingRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!currentUserId) {
        setHydratedUserId(null);
        return;
      }

      const auth = await initFirebaseAuth();
      const user = auth?.currentUser;
      if (!user || user.uid !== currentUserId) return;

      const idToken = await user.getIdToken();
      isHydratingRef.current = true;

      try {
        const res = await fetch('/api/workflow/state', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { workflowState?: PersistedWorkflowState };
        const persisted = payload.workflowState ?? {};
        hydrateFromRemote(currentUserId, {
          metrics: persisted.metrics,
          activityLogs: persisted.activityLogs?.map((entry) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          })),
          blueprintConfig: persisted.blueprintConfig,
        });
      } finally {
        if (!cancelled) {
          setHydratedUserId(currentUserId);
        }
        isHydratingRef.current = false;
      }
    };

    load().catch(() => {
      if (!cancelled) setHydratedUserId(currentUserId);
      isHydratingRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, hydrateFromRemote]);

  React.useEffect(() => {
    if (!currentUserId || hydratedUserId !== currentUserId || isHydratingRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const auth = await initFirebaseAuth();
        const user = auth?.currentUser;
        if (!user || user.uid !== currentUserId) return;
        const idToken = await user.getIdToken();

        await fetch('/api/workflow/state', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            metrics,
            activityLogs: activityLogs.map((entry) => ({
              id: entry.id,
              timestamp: entry.timestamp.toISOString(),
              nodeId: entry.nodeId,
              message: entry.message,
            })),
            blueprintConfig,
          }),
        });
      } catch {
        // best-effort persistence; avoid interrupting UX
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [currentUserId, hydratedUserId, metrics, activityLogs, blueprintConfig]);

  return null;
}

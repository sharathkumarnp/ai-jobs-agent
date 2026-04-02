'use client';

import React from 'react';
import { initFirebaseAuth } from '@/lib/firebase';

type DiagnosticsPayload = {
  ok: boolean;
  message: string;
  hasAdminConfig: boolean;
  firestoreReachable: boolean;
  storageReachable: boolean;
  envChecks: Record<string, boolean>;
  collections: Array<{ name: string; count: number | null; error?: string }>;
};

export default function DiagnosticsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [user, setUser] = React.useState<{ uid: string | null; email: string | null }>({
    uid: null,
    email: null,
  });
  const [data, setData] = React.useState<DiagnosticsPayload | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    initFirebaseAuth()
      .then(async (auth) => {
        if (!auth || cancelled) return;
        const authLib = await import('firebase/auth');
        unsubscribe = authLib.onAuthStateChanged(auth, async (currentUser) => {
          if (cancelled) return;
          setUser({
            uid: currentUser?.uid ?? null,
            email: currentUser?.email ?? null,
          });

          if (!currentUser) {
            setError('Please sign in to access diagnostics.');
            setLoading(false);
            return;
          }

          try {
            const idToken = await currentUser.getIdToken();
            const res = await fetch('/api/diagnostics/firebase', {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            });
            if (!res.ok) {
              if (res.status === 403) throw new Error('Superadmin access is required to view global diagnostics.');
              if (res.status === 401) throw new Error('Please sign in again to access diagnostics.');
              throw new Error(`Diagnostics failed (${res.status})`);
            }
            const payload = (await res.json()) as DiagnosticsPayload;
            if (cancelled) return;
            setData(payload);
            setError('');
          } catch (err) {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
          } finally {
            if (!cancelled) setLoading(false);
          }
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setUser({ uid: null, email: null });
        setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <div className="w-full max-w-none p-6 md:p-8 pb-24 premium-enter">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[var(--foreground)] tracking-tight mb-2">Firebase Diagnostics</h1>
        <p className="text-[var(--text-muted)]">Quick visibility into Firebase auth, admin config, Firestore, Storage, and collection counts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="premium-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">Signed-in user</p>
          <p className="text-sm text-[var(--foreground)]">{user.email ?? 'Not signed in'}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 break-all">{user.uid ?? '-'}</p>
        </div>
        <div className="premium-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">Admin configured</p>
          <p className={`text-sm font-medium ${data?.hasAdminConfig ? 'text-emerald-300' : 'text-amber-300'}`}>
            {data?.hasAdminConfig ? 'Yes' : 'No'}
          </p>
        </div>
        <div className="premium-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">Overall status</p>
          <p className={`text-sm font-medium ${data?.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {data?.ok ? 'Healthy' : 'Needs attention'}
          </p>
        </div>
      </div>

      <div className="premium-card rounded-xl p-5 mb-6">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">Environment checks</h2>
        {loading ? (
          <p className="text-[var(--text-muted)]">Loading diagnostics...</p>
        ) : error ? (
          <p className="text-red-300">{error}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(data?.envChecks ?? {}).map(([key, ok]) => (
              <div key={key} className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-md px-3 py-2">
                <span className="text-sm text-[var(--text-muted)]">{key}</span>
                <span className={`text-xs font-medium ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{ok ? 'set' : 'missing'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="premium-card rounded-xl p-5">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">Collection counts</h2>
        {loading ? (
          <p className="text-[var(--text-muted)]">Loading collection counts...</p>
        ) : error ? (
          <p className="text-red-300">{error}</p>
        ) : (
          <div className="space-y-2">
            {data?.collections?.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-md px-3 py-2">
                <span className="text-sm text-[var(--foreground)]">{entry.name}</span>
                <span className="text-sm text-[var(--text-muted)]">
                  {entry.count ?? 'n/a'}
                  {entry.error ? ` (${entry.error})` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

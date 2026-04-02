'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { initFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import { useWorkflowStore } from '@/store/useWorkflowStore';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const resetForUser = useWorkflowStore((s) => s.resetForUser);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (!isFirebaseConfigured) {
      setIsReady(true);
      return;
    }

    initFirebaseAuth()
      .then(async (auth) => {
        if (!auth) {
          setIsReady(true);
          return;
        }
        const authLib = await import('firebase/auth');
        unsubscribe = authLib.onAuthStateChanged(auth, async (user) => {
          resetForUser(user?.uid ?? null);
          const isLoginRoute = pathname === '/login';
          if (!user && !isLoginRoute) {
            router.replace('/login');
            setIsReady(false);
            return;
          }
          if (user && isLoginRoute) {
            router.replace('/');
            setIsReady(false);
            return;
          }

          if (user && !isLoginRoute) {
            try {
              const idToken = await user.getIdToken();
              await fetch('/api/auth/sync-user', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${idToken}`,
                },
              });
            } catch {
              // Best effort sync to avoid blocking app access.
            }
          }

          setIsReady(true);
        });
      })
      .catch(() => setIsReady(true));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [pathname, resetForUser, router]);

  if (!isReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--background)] text-sm text-[var(--text-muted)]">
        Verifying session...
      </div>
    );
  }

  return <>{children}</>;
}

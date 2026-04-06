'use client';

import { useEffect } from 'react';
import { initFirebaseAnalytics, isFirebaseConfigured } from '@/lib/firebase';

export function FirebaseAnalytics() {
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    initFirebaseAnalytics().catch((error) => {
      console.error('Firebase analytics init failed:', error);
    });
  }, []);

  return null;
}

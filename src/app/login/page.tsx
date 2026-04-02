'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, ArrowRight, ShieldCheck } from 'lucide-react';
import {
  initFirebaseAuth,
  isFirebaseConfigured,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithGooglePopup,
} from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const allowedDomains = React.useMemo(
    () => new Set(['gmail.com', 'yahoo.com', 'zoho.com', 'codeyspace.com', 'autohire24.com']),
    []
  );

  const getDomain = (value: string) => value.trim().toLowerCase().split('@')[1] || '';
  const isAllowedEmailDomain = (value: string) => allowedDomains.has(getDomain(value));

  const formatAuthError = React.useCallback((err: unknown) => {
    if (!(err instanceof Error)) {
      return 'Unable to sign in. Please verify your credentials.';
    }

    if (err.message.includes('auth/invalid-credential')) {
      return 'Invalid email or password.';
    }
    if (err.message.includes('auth/user-not-found')) {
      return 'No account found with this email.';
    }
    if (err.message.includes('auth/wrong-password')) {
      return 'Incorrect password.';
    }
    if (err.message.includes('auth/popup-closed-by-user')) {
      return 'Google sign-in was cancelled.';
    }
    if (err.message.includes('auth/too-many-requests')) {
      return 'Too many failed attempts. Try again in a few minutes.';
    }
    if (err.message.includes('auth/email-already-in-use')) {
      return 'This email is already registered. Please sign in.';
    }
    if (err.message.includes('auth/weak-password')) {
      return 'Password is too weak. Use at least 6 characters.';
    }

    return err.message;
  }, []);

  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (!isFirebaseConfigured) {
      setIsCheckingAuth(false);
      return;
    }

    initFirebaseAuth()
      .then(async (auth) => {
        if (!auth) {
          setIsCheckingAuth(false);
          return;
        }
        const authLib = await import('firebase/auth');
        unsubscribe = authLib.onAuthStateChanged(auth, (user) => {
          if (user) {
            router.replace('/');
            return;
          }
          setIsCheckingAuth(false);
        });
      })
      .catch(() => setIsCheckingAuth(false));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add your Firebase values in .env.local.');
      return;
    }

    if (mode === 'signup' && !isAllowedEmailDomain(email)) {
      setError('Signup allowed only for: gmail.com, yahoo.com, zoho.com, codeyspace.com, autohire24.com');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    try {
      setIsLoading(true);
      if (mode === 'signup') {
        await signUpWithEmailPassword(email, password);
      } else {
        await signInWithEmailPassword(email, password);
      }
      router.replace('/');
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSSO = async () => {
    setError('');

    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add your Firebase values in .env.local.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await signInWithGooglePopup();
      const signedInEmail = result.user?.email || '';
      if (!isAllowedEmailDomain(signedInEmail)) {
        const auth = await initFirebaseAuth();
        const firebaseAuthLib = await import('firebase/auth');
        if (auth) {
          await firebaseAuthLib.signOut(auth);
        }
        setError('Google account domain is not allowed.');
        return;
      }
      router.replace('/');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center absolute inset-0 z-50 bg-[var(--background)]">
        <div className="text-sm text-[var(--text-muted)]">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 absolute inset-0 z-50 bg-[var(--background)]">

      <div className="w-full max-w-md relative z-10 premium-enter">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-12 h-12 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4 backdrop-blur-xl shadow-[0_0_20px_rgba(5,8,14,0.2)] premium-hover-lift">
            <Terminal className="text-[var(--foreground)]" size={24} />
          </div>
          <h1 className="text-3xl font-semibold text-[var(--foreground)] tracking-tight mb-2">AutoHire24/7</h1>
          <p className="text-[var(--text-muted)]">
            {mode === 'signup' ? 'Create your orchestration account.' : 'Sign in to your premium orchestration console.'}
          </p>
        </div>

        <div className="premium-card rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full premium-input rounded-lg px-4 py-3 transition-colors"
                placeholder="you@gmail.com"
              />
              {mode === 'signup' ? (
                <p className="text-[11px] text-zinc-500 mt-2">
                  Allowed domains: gmail.com, yahoo.com, zoho.com, codeyspace.com, autohire24.com
                </p>
              ) : null}
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">Password</label>
                <span className="text-xs text-[var(--brand)] cursor-pointer hover:underline premium-soft-pulse">Forgot?</span>
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full premium-input rounded-lg px-4 py-3 transition-colors"
                placeholder="••••••••"
              />
            </div>
            {mode === 'signup' ? (
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full premium-input rounded-lg px-4 py-3 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20">
                {error}
              </p>
            ) : null}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center px-4 py-3 premium-button rounded-lg text-sm transition-colors"
            >
              {isLoading ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : mode === 'signup' ? 'Create Account' : 'Initialize Workspace'}
              {!isLoading ? <ArrowRight size={16} className="ml-2" /> : null}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-[var(--text-muted)]">
            {mode === 'signup' ? 'Already have an account?' : 'New here?'}
            <button
              type="button"
              onClick={() => {
                setMode((prev) => (prev === 'signup' ? 'signin' : 'signup'));
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
              className="ml-1 text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
            >
              {mode === 'signup' ? 'Sign in' : 'Create account'}
            </button>
          </div>

          <div className="mt-6 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-white/10 after:mt-0.5 after:flex-1 after:border-t after:border-white/10">
            <p className="mx-4 text-center text-xs text-[var(--text-muted)] font-medium">OR</p>
          </div>

          <button
            onClick={handleGoogleSSO}
            disabled={isLoading}
            className="w-full mt-6 py-3 btn-violet rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 premium-hover-lift"
          >
            <ShieldCheck size={16} className="text-[var(--foreground)]" />
            {isLoading ? 'Please wait...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  );
}

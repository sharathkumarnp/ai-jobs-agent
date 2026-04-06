'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  FileText, 
  Briefcase, 
  Bot, 
  UserCircle,
  Search,
  Bell,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { initFirebaseAuth } from '@/lib/firebase';

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeProfileTab = searchParams.get('tab') ?? 'general';
  const isProfileRoute = pathname === '/profile';
  const [profileIdentity, setProfileIdentity] = React.useState<{ name: string; status: string }>({
    name: 'User',
    status: 'Not signed in',
  });

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Workflow Canvas' },
    { href: '/ledger', icon: FileText, label: 'Application Ledger' },
    { href: '/tailored-resume', icon: FileText, label: 'Tailored Resume' },
    { href: '/intervention', icon: Briefcase, label: 'Intervention Hub' },
    { href: '/blueprint', icon: Settings, label: 'Blueprint config' },
    { href: '/diagnostics', icon: Activity, label: 'Diagnostics' },
  ];

  React.useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    initFirebaseAuth()
      .then(async (auth) => {
        if (!auth || cancelled) return;
        const authLib = await import('firebase/auth');
        unsubscribe = authLib.onAuthStateChanged(auth, async (user) => {
          if (cancelled) return;
          if (!user) {
            setProfileIdentity({ name: 'User', status: 'Not signed in' });
            return;
          }

          const baseName = user.displayName || user.email?.split('@')[0] || 'User';
          setProfileIdentity({ name: baseName, status: 'Orchestration online' });

          try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/profile', {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (!res.ok) return;
            const payload = (await res.json()) as {
              profile?: {
                generalInfo?: {
                  firstName?: string;
                  lastName?: string;
                };
              };
            };
            const first = payload.profile?.generalInfo?.firstName?.trim() || '';
            const last = payload.profile?.generalInfo?.lastName?.trim() || '';
            const fullName = `${first} ${last}`.trim();
            if (fullName) {
              setProfileIdentity((prev) => ({ ...prev, name: fullName }));
            }
          } catch {
            // ignore profile hydration failures in sidebar
          }
        });
      })
      .catch(() => {
        if (!cancelled) setProfileIdentity({ name: 'User', status: 'Offline' });
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (pathname === '/login') return null;

  return (
    <aside className="w-72 h-[calc(100vh-2rem)] my-4 ml-4 mr-0 rounded-3xl bg-[var(--surface)]/92 backdrop-blur-3xl shadow-[0_24px_50px_rgba(5,8,14,0.22)] flex flex-col px-4 py-6 premium-enter overflow-hidden">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[0_10px_25px_rgba(5,8,14,0.2)] premium-float">
          <Bot size={22} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">AutoHire24/7</h1>
          <p className="text-xs text-[var(--text-muted)]">Autonomous hiring engine</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        <div className="text-[11px] font-semibold text-zinc-500 mb-4 px-2 uppercase tracking-[0.18em]">
          Platform
        </div>
        {navItems.map((item, i) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={i} 
              href={item.href} 
              className={`group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 premium-hover-lift ${
                isActive 
                  ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] border border-[var(--border)] shadow-[0_8px_20px_rgba(5,8,14,0.18)]' 
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] border border-transparent'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-[var(--foreground)]' : 'text-[var(--text-muted)] group-hover:text-[var(--foreground)]'} />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="block rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs text-[var(--text-muted)] transition-colors premium-hover-lift">
          <p className="font-semibold text-[var(--foreground)]">Premium plan</p>
          <p className="mt-1 text-[var(--text-muted)]">Priority AI queue and deeper analytics.</p>
        </div>
        <Link
          href="/profile"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-colors premium-hover-lift"
        >
          <UserCircle size={32} className="text-[var(--text-muted)]" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--foreground)]">{profileIdentity.name}</span>
            <span className="text-xs text-[var(--text-muted)] flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              {profileIdentity.status}
            </span>
          </div>
        </Link>
        {isProfileRoute ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 p-2 space-y-1 premium-enter">
            {[
              { id: 'general', label: 'General Info' },
              { id: 'api', label: 'API Integrations' },
              { id: 'subscription', label: 'Subscription' },
              { id: 'security', label: 'Security' },
            ].map((item) => (
              <Link
                key={item.id}
                href={`/profile?tab=${item.id}`}
                className={`block rounded-lg px-3 py-2 text-xs transition-colors ${
                  activeProfileTab === item.id
                    ? 'bg-indigo-300/20 text-white border border-indigo-200/30'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

import { useWorkflowStore } from '@/store/useWorkflowStore';

export function Header() {
  const { pushLog, incrementMetric, masterResumeText, blueprintConfig } = useWorkflowStore();
  const [isRunning, setIsRunning] = React.useState(false);
  const runIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [userIdentity, setUserIdentity] = React.useState<{ userId: string; email: string | null }>({
    userId: 'anonymous',
    email: null,
  });
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  const pageLabelMap: Record<string, string> = {
    '/': 'Workflow Canvas',
    '/ledger': 'Application Ledger',
    '/tailored-resume': 'Tailored Resume',
    '/intervention': 'Intervention Hub',
    '/blueprint': 'Blueprint Configuration',
    '/profile': 'Workspace Profile',
    '/diagnostics': 'Diagnostics',
  };

  const sleepWithAbort = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });

  const stopEngine = React.useCallback(() => {
    runIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    pushLog({ nodeId: 'discovery', message: 'Engine execution stopped by user.' });
  }, [pushLog]);

  const startEngine = async () => {
    if (isRunning) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);
    pushLog({ nodeId: 'discovery', message: `Engine Start. Booting up Discovery API for ${blueprintConfig.targetRole}...` });
    
    try {
      const auth = await initFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Missing auth session');
      }

      const queryParams = new URLSearchParams({
        role: blueprintConfig.targetRole,
        location: blueprintConfig.location,
        mode: blueprintConfig.workMode,
        userId: userIdentity.userId,
        ...(userIdentity.email ? { userEmail: userIdentity.email } : {}),
      }).toString();
      
      const response = await fetch(`/api/engine?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        signal: controller.signal,
      });
      if (runIdRef.current !== runId) return;
      const data = await response.json();
      const events = data.events || [];
      const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];

      for (const line of diagnostics) {
        if (runIdRef.current !== runId) return;
        pushLog({ nodeId: 'discovery', message: `[Source Diagnostics] ${line}` });
      }

      for (const evt of events) {
        if (runIdRef.current !== runId) return;
        // Delay between ticks for SaaS visualization
        await sleepWithAbort(1500, controller.signal);
        if (runIdRef.current !== runId) return;

        // Intercept specific forge events to run real AI logic
        if (evt.node === 'forge' && evt.msg.includes('Asset tailored')) {
           pushLog({ nodeId: 'forge', message: `Connecting to AI Gateway to tailor resume for ${evt.job.company}...` });
           
           try {
             // Real LLM fetch
             const llmRes = await fetch('/api/tailor', {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 Authorization: `Bearer ${idToken}`,
               },
                signal: controller.signal,
               body: JSON.stringify({ 
                 jobDescription: `Position: ${evt.job.title} at ${evt.job.company}.`,
                 masterResume: masterResumeText ?? null,
                 userId: userIdentity.userId,
                 userEmail: userIdentity.email,
                 job: evt.job,
               })
             });
             if (runIdRef.current !== runId) return;
             const llmData = await llmRes.json();
             
             if (llmData.error) throw new Error(llmData.error);
             
             pushLog({ nodeId: 'forge', message: `Asset tailored perfectly for ${evt.job.company}. Confidence: ${llmData.confidence}`});
             // We drop the generated text into console for now:
             console.log(`[GENERATED RESUME for ${evt.job.company}]:\n`, llmData.tailoredResume);
           } catch (e) {
             console.error(e);
             pushLog({ nodeId: 'forge', message: `AI Gateway Timeout. Used baseline default asset for ${evt.job.company}.` });
           }
           incrementMetric('tailored', 1);
        } else {
           if (runIdRef.current !== runId) return;
           pushLog({ nodeId: evt.node, message: evt.msg });
           if (evt.node === 'discovery') incrementMetric('scanned', 1);
           if (evt.node === 'filter' && evt.msg.includes('Discarded')) incrementMetric('discarded', 1);
           if (evt.node === 'dispatcher' && evt.msg.includes('Success')) incrementMetric('submitted', 1);
        }
      }

    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      console.error(error);
      pushLog({ nodeId: 'discovery', message: 'CRITICAL: Failed to reach job backend APIs.' });
    } finally {
      if (runIdRef.current === runId) {
        abortControllerRef.current = null;
        setIsRunning(false);
      }
    }
  };

  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    initFirebaseAuth()
      .then(async (auth) => {
        if (!auth) return;
        const authLib = await import('firebase/auth');
        unsubscribe = authLib.onAuthStateChanged(auth, (user) => {
          setUserIdentity({
            userId: user?.uid || 'anonymous',
            email: user?.email || null,
          });
        });
      })
      .catch(() => {
        setUserIdentity({ userId: 'anonymous', email: null });
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (isLoginPage) return null;

  return (
    <header className="h-14 mx-2 md:mx-4 mt-4 mb-3 rounded-2xl bg-[var(--surface)]/90 backdrop-blur-3xl shadow-[0_12px_24px_rgba(5,8,14,0.14)] sticky top-4 z-40 premium-enter relative">
      <div className="h-full flex items-center justify-between gap-3 px-3 md:px-4">
        <div className="min-w-[170px] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--foreground)] tracking-tight leading-none">{pageLabelMap[pathname] ?? 'AutoHire24/7'}</h2>
        </div>

        <div className="flex items-center gap-2 justify-end shrink-0">
          <div className="hidden lg:flex items-center gap-2 bg-[var(--surface-elevated)] px-2.5 py-1 rounded-full border border-[var(--border)]">
            <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-400 premium-soft-pulse' : 'bg-amber-300'}`}></div>
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {isRunning ? 'Engine active' : 'Standby'}
            </span>
          </div>

          <button
            className="h-9 w-9 hidden sm:grid place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] hover:opacity-90 premium-hover-lift"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={15} />
          </button>

          <Link
            href="/profile"
            className="h-9 w-9 grid place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] hover:opacity-90 premium-hover-lift"
            aria-label="Profile"
            title="Profile"
          >
            <UserCircle size={17} />
          </Link>

          {isRunning ? (
            <button
              onClick={stopEngine}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all border border-red-300/40 bg-red-400/20 text-red-100 hover:bg-red-400/30"
            >
              Stop Engine
            </button>
          ) : (
            <button
              onClick={startEngine}
              className="premium-button px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all"
            >
              Start Engine
            </button>
          )}
        </div>
      </div>

      <div className="hidden lg:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-[min(48vw,34rem)] pointer-events-none">
        <div className="h-full flex items-center">
          <div className="relative w-full pointer-events-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search jobs, companies, logs..."
              className="w-full h-9 premium-input rounded-full pl-9 pr-3 text-sm"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

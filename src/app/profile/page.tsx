'use client';

import React from 'react';
import { Camera, ChevronDown, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initFirebaseAuth, initFirebaseStorage } from '@/lib/firebase';

type ProfileSection = 'general' | 'api' | 'subscription' | 'security';
type ToastState = {
  visible: boolean;
  message: string;
  tone: 'success' | 'error';
};

const fallbackTimezones = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Stockholm',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Jakarta',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Pacific/Fiji',
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-zinc-300 leading-none">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 cursor-pointer ${
          checked
            ? 'bg-indigo-500/90 border-indigo-300/40 shadow-[0_6px_16px_rgba(99,102,241,0.35)]'
            : 'bg-zinc-700/70 border-zinc-500/40'
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

function TimezoneDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const timezones = React.useMemo(() => {
    const intlWithSupported = Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    };
    try {
      const tz = intlWithSupported.supportedValuesOf?.('timeZone') ?? [];
      if (Array.isArray(tz) && tz.length > 0) return tz;
    } catch {
      // use fallback list below
    }
    return fallbackTimezones;
  }, []);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return timezones;
    return timezones.filter((tz) => tz.toLowerCase().includes(needle));
  }, [query, timezones]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full premium-input rounded-md px-4 py-2.5 text-sm text-left flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-zinc-100' : 'text-zinc-500'}>{value || 'Select timezone'}</span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_42px_rgba(5,8,14,0.35)] overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search timezone..."
                className="w-full premium-input rounded-md pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((tz) => (
                <button
                  key={tz}
                  type="button"
                  onClick={() => {
                    onChange(tz);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    value === tz
                      ? 'bg-indigo-300/20 text-indigo-100'
                      : 'text-zinc-300 hover:bg-white/[0.03]'
                  }`}
                >
                  {tz}
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-zinc-500">No timezone found.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileImageInputRef = React.useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = React.useState<ProfileSection>('general');
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [avatarUploadMessage, setAvatarUploadMessage] = React.useState('');
  const [toast, setToast] = React.useState<ToastState>({
    visible: false,
    message: '',
    tone: 'success',
  });
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [generalInfo, setGeneralInfo] = React.useState({
    profilePictureUrl: '',
    firstName: '',
    lastName: '',
    mobile: '',
    location: '',
    designation: '',
    company: '',
    timezone: '',
    linkedin: '',
    website: '',
  });

  const [apiConfig, setApiConfig] = React.useState({
    provider: 'OpenAI',
    rapidApiKey: '',
    openAiKey: '',
    anthropicKey: '',
    googleKey: '',
  });

  const [subscription, setSubscription] = React.useState({
    plan: 'Free',
    billingCycle: 'Monthly',
    seats: 1,
    autoRenew: true,
  });

  const [security, setSecurity] = React.useState({
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    emailAlerts: true,
    pushAlerts: false,
    weeklySummary: true,
    loginAlerts: true,
    twoFactor: false,
  });

  React.useEffect(() => {
    const tab = searchParams.get('tab');
    const allowedTabs: ProfileSection[] = ['general', 'api', 'subscription', 'security'];
    setActiveSection(allowedTabs.includes(tab as ProfileSection) ? (tab as ProfileSection) : 'general');
  }, [searchParams]);

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
            return;
          }

          if (user.email) {
            setSecurity((prev) => ({ ...prev, email: user.email || prev.email }));
          }
          if (user.displayName) {
            const parts = user.displayName.trim().split(/\s+/);
            setGeneralInfo((prev) => ({
              ...prev,
              firstName: prev.firstName || parts[0] || '',
              lastName: prev.lastName || parts.slice(1).join(' '),
            }));
          }

          const idToken = await user.getIdToken();
          const res = await fetch('/api/profile', {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (!res.ok) return;
          const payload = (await res.json()) as { profile?: Record<string, unknown> };
          const profileData = payload.profile ?? {};

          if (profileData.generalInfo && typeof profileData.generalInfo === 'object') {
            setGeneralInfo((prev) => ({ ...prev, ...(profileData.generalInfo as typeof prev) }));
          }
          if (profileData.apiConfig && typeof profileData.apiConfig === 'object') {
            setApiConfig((prev) => ({ ...prev, ...(profileData.apiConfig as typeof prev) }));
          }
          if (profileData.subscription && typeof profileData.subscription === 'object') {
            setSubscription((prev) => ({ ...prev, ...(profileData.subscription as typeof prev) }));
          }
          if (profileData.security && typeof profileData.security === 'object') {
            setSecurity((prev) => ({ ...prev, ...(profileData.security as typeof prev) }));
          }
        });
      })
      .catch(() => {
        setCurrentUserId(null);
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string, tone: ToastState['tone']) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ visible: true, message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  };

  const persistSection = async (
    key: 'generalInfo' | 'apiConfig' | 'subscription' | 'security',
    value: Record<string, unknown>
  ) => {
    const auth = await initFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) {
      throw new Error('Please sign in to save settings.');
    }
    const idToken = await user.getIdToken();
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        section: key,
        value,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (data?.error) throw new Error(data.error);
      const fallbackText = await res.text().catch(() => '');
      throw new Error(fallbackText || `Failed to save profile settings (${res.status}).`);
    }
  };

  const handleSaveGeneralInfo = async () => {
    try {
      await persistSection('generalInfo', generalInfo as Record<string, unknown>);
      setAvatarUploadMessage('General profile settings saved.');
      showToast('General profile settings saved.', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save profile settings.';
      setAvatarUploadMessage(msg);
      showToast(msg, 'error');
    }
  };

  const handleSaveApi = async () => {
    try {
      await persistSection('apiConfig', apiConfig as Record<string, unknown>);
      showToast('API settings saved.', 'success');
    } catch (error) {
      console.error('Save API settings failed:', error);
      showToast('Failed to save API settings.', 'error');
    }
  };

  const handleSaveSubscription = async () => {
    try {
      await persistSection('subscription', subscription as Record<string, unknown>);
      showToast('Subscription settings saved.', 'success');
    } catch (error) {
      console.error('Save subscription failed:', error);
      showToast('Failed to save subscription settings.', 'error');
    }
  };

  const handleSaveSecurity = async () => {
    try {
      await persistSection('security', security as Record<string, unknown>);
      showToast('Security preferences saved.', 'success');
    } catch (error) {
      console.error('Save security failed:', error);
      showToast('Failed to save security preferences.', 'error');
    }
  };

  const handlePickProfileImage = () => {
    profileImageInputRef.current?.click();
  };

  const handleProfileImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarUploadMessage('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadMessage('Image must be 5MB or smaller.');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarUploadMessage('');

    try {
      const auth = await initFirebaseAuth();
      if (!auth?.currentUser) {
        throw new Error('Please sign in to upload a profile picture.');
      }

      const storage = await initFirebaseStorage();
      if (!storage) {
        throw new Error('Firebase storage is not configured.');
      }

      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const objectPath = `profile-images/${auth.currentUser.uid}/${Date.now()}-${safeName}`;
      const storageRef = ref(storage, objectPath);

      await uploadBytes(storageRef, file, { contentType: file.type });
      const downloadUrl = await getDownloadURL(storageRef);

      setGeneralInfo((prev) => ({ ...prev, profilePictureUrl: downloadUrl }));
      await persistSection('generalInfo', { ...generalInfo, profilePictureUrl: downloadUrl });
      setAvatarUploadMessage('Profile picture updated.');
      showToast('Profile picture updated.', 'success');
    } catch (error) {
      console.error('Profile image upload failed:', error);
      const msg = error instanceof Error ? error.message : 'Failed to upload image.';
      setAvatarUploadMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = await initFirebaseAuth();
      if (!auth) return;
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      router.push('/login');
    }
  };

  const initials =
    `${generalInfo.firstName?.trim().charAt(0) ?? ''}${generalInfo.lastName?.trim().charAt(0) ?? ''}`.toUpperCase() || 'U';

  return (
    <div className="w-full max-w-none p-6 md:p-8 pb-24 premium-enter">
      {toast.visible ? (
        <div
          className={`fixed right-5 top-20 z-[90] rounded-lg border px-4 py-2.5 text-sm shadow-[0_12px_28px_rgba(0,0,0,0.35)] ${
            toast.tone === 'success'
              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
              : 'bg-red-500/15 text-red-200 border-red-400/30'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="space-y-6">
          {activeSection === 'general' && (
            <div className="premium-card rounded-2xl p-6 md:p-7 space-y-6">
              <h3 className="text-lg font-medium text-white">General Info</h3>
              <div className="flex items-center gap-4">
                <div
                  className="h-16 w-16 rounded-full bg-zinc-800 border border-[var(--border)] grid place-items-center text-zinc-300 bg-cover bg-center"
                  style={
                    generalInfo.profilePictureUrl
                      ? { backgroundImage: `url(${generalInfo.profilePictureUrl})` }
                      : undefined
                  }
                >
                  {!generalInfo.profilePictureUrl ? initials : null}
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={handlePickProfileImage}
                    disabled={isUploadingAvatar}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm btn-subtle disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Camera size={14} />
                    {isUploadingAvatar ? 'Uploading...' : 'Change picture'}
                  </button>
                  {avatarUploadMessage ? <p className="text-xs text-zinc-400">{avatarUploadMessage}</p> : null}
                </div>
                <input
                  ref={profileImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfileImageChange}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">First Name</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={generalInfo.firstName} onChange={(e) => setGeneralInfo((prev) => ({ ...prev, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Last Name</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={generalInfo.lastName} onChange={(e) => setGeneralInfo((prev) => ({ ...prev, lastName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Mobile</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={generalInfo.mobile} onChange={(e) => setGeneralInfo((prev) => ({ ...prev, mobile: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Location</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={generalInfo.location} onChange={(e) => setGeneralInfo((prev) => ({ ...prev, location: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Designation</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={generalInfo.designation} onChange={(e) => setGeneralInfo((prev) => ({ ...prev, designation: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Current Company</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={generalInfo.company} onChange={(e) => setGeneralInfo((prev) => ({ ...prev, company: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Timezone</label>
                  <TimezoneDropdown
                    value={generalInfo.timezone}
                    onChange={(next) => setGeneralInfo((prev) => ({ ...prev, timezone: next }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">LinkedIn</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" placeholder="https://linkedin.com/in/..." value={generalInfo.linkedin} onChange={(e) => setGeneralInfo((prev) => ({ ...prev, linkedin: e.target.value }))} />
                </div>
              </div>
              <button type="button" onClick={handleSaveGeneralInfo} className="px-4 py-2.5 rounded-md text-sm btn-violet">Save General Info</button>
            </div>
          )}

          {activeSection === 'api' && (
            <div className="premium-card rounded-2xl p-6 md:p-7 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-1">API Configurations</h3>
                <p className="text-sm text-zinc-400">Choose your AI provider and configure API keys.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Which AI to use</label>
                <select
                  className="w-full premium-input rounded-md px-4 py-2.5 text-sm"
                  value={apiConfig.provider}
                  onChange={(e) => setApiConfig((prev) => ({ ...prev, provider: e.target.value }))}
                >
                  <option>OpenAI</option>
                  <option>Anthropic</option>
                  <option>Google Gemini</option>
                  <option>Multi-provider fallback</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">RapidAPI Key</label>
                  <input type="password" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={apiConfig.rapidApiKey} onChange={(e) => setApiConfig((prev) => ({ ...prev, rapidApiKey: e.target.value }))} placeholder="Enter RapidAPI key" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">OpenAI Key</label>
                  <input type="password" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={apiConfig.openAiKey} onChange={(e) => setApiConfig((prev) => ({ ...prev, openAiKey: e.target.value }))} placeholder="sk-proj-..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Anthropic Key</label>
                  <input type="password" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={apiConfig.anthropicKey} onChange={(e) => setApiConfig((prev) => ({ ...prev, anthropicKey: e.target.value }))} placeholder="sk-ant-..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Google Key</label>
                  <input type="password" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={apiConfig.googleKey} onChange={(e) => setApiConfig((prev) => ({ ...prev, googleKey: e.target.value }))} placeholder="Enter Google AI key" />
                </div>
              </div>

              <button type="button" onClick={handleSaveApi} className="px-4 py-2.5 rounded-md text-sm btn-success">Save API Settings</button>
            </div>
          )}

          {activeSection === 'subscription' && (
            <div className="premium-card rounded-2xl p-6 md:p-7 space-y-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-lg font-medium text-white mb-1">Current Plan</h3>
                  <p className="text-sm text-zinc-400">Manage plan limits, billing cycle, and upgrades.</p>
                </div>
                <span className="px-3 py-1 bg-indigo-300/20 text-indigo-100 border border-indigo-200/30 rounded-full text-xs font-medium uppercase tracking-wider">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Plan</label>
                  <input className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={subscription.plan} onChange={(e) => setSubscription((prev) => ({ ...prev, plan: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Billing Cycle</label>
                  <select className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={subscription.billingCycle} onChange={(e) => setSubscription((prev) => ({ ...prev, billingCycle: e.target.value }))}>
                    <option>Monthly</option>
                    <option>Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Team Seats</label>
                  <input type="number" min={1} className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={subscription.seats} onChange={(e) => setSubscription((prev) => ({ ...prev, seats: Number(e.target.value || 1) }))} />
                </div>
              </div>

              <Toggle checked={subscription.autoRenew} onChange={(next) => setSubscription((prev) => ({ ...prev, autoRenew: next }))} label="Auto renew subscription" />

              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2.5 rounded-md text-sm btn-warning">Manage Billing</button>
                <button className="px-4 py-2.5 rounded-md text-sm btn-violet">Upgrade Plan</button>
                <button type="button" onClick={handleSaveSubscription} className="px-4 py-2.5 rounded-md text-sm btn-subtle">Save Subscription</button>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="premium-card rounded-2xl p-6 md:p-7 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-1">Security</h3>
                <p className="text-sm text-zinc-400">Update password and manage security notifications.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Email</label>
                  <input type="email" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={security.email} onChange={(e) => setSecurity((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Current Password</label>
                  <input type="password" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={security.currentPassword} onChange={(e) => setSecurity((prev) => ({ ...prev, currentPassword: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">New Password</label>
                  <input type="password" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={security.newPassword} onChange={(e) => setSecurity((prev) => ({ ...prev, newPassword: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Confirm Password</label>
                  <input type="password" className="w-full premium-input rounded-md px-4 py-2.5 text-sm" value={security.confirmPassword} onChange={(e) => setSecurity((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-xl p-4 space-y-1">
                <h4 className="text-sm font-semibold text-white mb-1">Notification Toggles</h4>
                <Toggle checked={security.emailAlerts} onChange={(next) => setSecurity((prev) => ({ ...prev, emailAlerts: next }))} label="Email alerts" />
                <Toggle checked={security.pushAlerts} onChange={(next) => setSecurity((prev) => ({ ...prev, pushAlerts: next }))} label="Push notifications" />
                <Toggle checked={security.weeklySummary} onChange={(next) => setSecurity((prev) => ({ ...prev, weeklySummary: next }))} label="Weekly security summary" />
                <Toggle checked={security.loginAlerts} onChange={(next) => setSecurity((prev) => ({ ...prev, loginAlerts: next }))} label="Suspicious login alerts" />
                <Toggle checked={security.twoFactor} onChange={(next) => setSecurity((prev) => ({ ...prev, twoFactor: next }))} label="Enable two-factor authentication" />
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2.5 rounded-md text-sm btn-danger">Change Password</button>
                <button type="button" onClick={handleSaveSecurity} className="px-4 py-2.5 rounded-md text-sm btn-violet">Save Security Preferences</button>
                <button onClick={handleSignOut} className="px-4 py-2.5 rounded-md text-sm btn-subtle">Sign Out</button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

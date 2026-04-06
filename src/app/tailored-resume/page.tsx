'use client';

import React from 'react';
import { Download, FileText } from 'lucide-react';
import { initFirebaseAuth } from '@/lib/firebase';

type TailoredResumeRow = {
  id: string;
  company: string | null;
  title: string | null;
  source: string | null;
  confidence: number | null;
  createdAt: string | null;
  storagePath: string | null;
  resumeText: string;
  downloadUrl: string | null;
};

type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  source: string | null;
  updatedAt: string | null;
};

type ResumeFilter = 'all' | 'ready_for_review' | 'submitted' | 'rejected';

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const norm = (value: string | null | undefined) => (value || '').trim().toLowerCase();
const makeJobKey = (company: string | null | undefined, role: string | null | undefined) => `${norm(company)}::${norm(role)}`;

export default function TailoredResumePage() {
  const [rows, setRows] = React.useState<TailoredResumeRow[]>([]);
  const [applications, setApplications] = React.useState<ApplicationRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busyAction, setBusyAction] = React.useState<'approve' | 'reject' | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<ResumeFilter>('all');

  React.useEffect(() => {
    let cancelled = false;

    const loadResumes = async () => {
      try {
        const auth = await initFirebaseAuth();
        const user = auth?.currentUser;
        if (!user) {
          if (!cancelled) setRows([]);
          return;
        }
        const idToken = await user.getIdToken();
        const res = await fetch('/api/tailored-resumes?limit=50', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Failed to fetch tailored resumes (${res.status}).`);
        }
        const payload = (await res.json()) as { resumes?: TailoredResumeRow[] };
        const list = Array.isArray(payload.resumes) ? payload.resumes : [];

        const appsRes = await fetch('/api/applications', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        const appsPayload = (await appsRes.json().catch(() => null)) as { applications?: ApplicationRow[] } | null;
        const appList = appsRes.ok && Array.isArray(appsPayload?.applications) ? appsPayload.applications : [];

        if (!cancelled) {
          setRows(list);
          setApplications(appList);
          setSelectedId((prev) => prev ?? list[0]?.id ?? null);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tailored resumes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadResumes();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusByKey = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const app of applications) {
      map.set(makeJobKey(app.company, app.role), app.status);
    }
    return map;
  }, [applications]);

  const filteredRows = React.useMemo(() => {
    if (activeFilter === 'all') return rows;
    return rows.filter((row) => {
      const status = statusByKey.get(makeJobKey(row.company, row.title)) ?? '';
      return status === activeFilter;
    });
  }, [activeFilter, rows, statusByKey]);

  const filterCounts = React.useMemo(() => {
    const counts: Record<ResumeFilter, number> = {
      all: rows.length,
      ready_for_review: 0,
      submitted: 0,
      rejected: 0,
    };

    for (const row of rows) {
      const status = statusByKey.get(makeJobKey(row.company, row.title));
      if (status === 'ready_for_review') counts.ready_for_review += 1;
      if (status === 'submitted') counts.submitted += 1;
      if (status === 'rejected') counts.rejected += 1;
    }

    return counts;
  }, [rows, statusByKey]);

  React.useEffect(() => {
    if (!filteredRows.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && filteredRows.some((row) => row.id === prev) ? prev : filteredRows[0].id));
  }, [filteredRows]);

  const selected = filteredRows.find((row) => row.id === selectedId) ?? null;
  const selectedApplication = React.useMemo(() => {
    if (!selected) return null;
    const key = makeJobKey(selected.company, selected.title);
    return applications.find((entry) => makeJobKey(entry.company, entry.role) === key) ?? null;
  }, [applications, selected]);

  const updateDecision = async (action: 'approve' | 'reject') => {
    if (!selectedApplication) return;
    try {
      setBusyAction(action);
      const auth = await initFirebaseAuth();
      const user = auth?.currentUser;
      if (!user) throw new Error('Please sign in again.');
      const idToken = await user.getIdToken();
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ applicationId: selectedApplication.id, action }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Failed to ${action} application.`);
      }

      setApplications((prev) =>
        prev.map((entry) =>
          entry.id === selectedApplication.id
            ? {
                ...entry,
                status: action === 'approve' ? 'submitted' : 'rejected',
                updatedAt: new Date().toISOString(),
              }
            : entry
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update application decision.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="w-full max-w-none p-6 md:p-8 pb-24 premium-enter">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Tailored Resume Vault</h1>
        <p className="mt-1 text-sm text-zinc-400">Review generated resumes before manually applying.</p>
      </div>

      {loading ? (
        <div className="premium-card rounded-2xl p-8 text-sm text-zinc-400">Loading tailored resumes...</div>
      ) : error ? (
        <div className="premium-card rounded-2xl p-8 text-sm text-red-300">{error}</div>
      ) : rows.length === 0 ? (
        <div className="premium-card rounded-2xl p-10 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/5">
            <FileText size={18} className="text-zinc-500" />
          </div>
          <p className="text-zinc-300">No tailored resumes yet.</p>
          <p className="mt-1 text-sm text-zinc-500">Run the engine to generate and store tailored assets.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <section className="premium-card rounded-2xl p-3 max-h-[70vh] overflow-y-auto">
            <div className="mb-2 px-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Saved resumes</div>
            <div className="mb-3 flex flex-wrap gap-2 px-1">
              {[
                { id: 'all' as const, label: 'All' },
                { id: 'ready_for_review' as const, label: 'Awaiting review' },
                { id: 'submitted' as const, label: 'Submitted' },
                { id: 'rejected' as const, label: 'Rejected' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveFilter(item.id)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                    activeFilter === item.id
                      ? 'border-indigo-300/40 bg-indigo-300/20 text-indigo-100'
                      : 'border-[var(--border)] bg-[var(--surface-elevated)] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {item.label} ({filterCounts[item.id]})
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredRows.map((row) => {
                const isActive = selectedId === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isActive
                        ? 'border-indigo-300/40 bg-indigo-300/10'
                        : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-white/[0.03]'
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-200">{row.title || 'Untitled role'}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{row.company || 'Unknown company'}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {row.source || 'Unknown source'} • {formatDate(row.createdAt)}
                    </p>
                  </button>
                );
              })}
              {filteredRows.length === 0 ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs text-zinc-500">
                  No resumes in this status.
                </div>
              ) : null}
            </div>
          </section>

          <section className="premium-card rounded-2xl p-5">
            {selected ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">{selected.title || 'Untitled role'}</h2>
                    <p className="text-sm text-zinc-400">
                      {selected.company || 'Unknown company'} • {selected.source || 'Unknown source'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Confidence: {selected.confidence ?? 0} • {formatDate(selected.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Review status: {selectedApplication ? selectedApplication.status.replace(/[-_]/g, ' ') : 'not linked'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedApplication && (selectedApplication.status === 'ready_for_review' || selectedApplication.status === 'searched') ? (
                      <>
                        <button
                          onClick={() => updateDecision('approve')}
                          disabled={busyAction !== null}
                          className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateDecision('reject')}
                          disabled={busyAction !== null}
                          className="rounded-md border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs text-rose-100 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {selected.downloadUrl ? (
                      <a
                        href={selected.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-zinc-200 hover:opacity-90"
                      >
                        <Download size={14} />
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>

                <pre className="max-h-[58vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[#090909] p-4 text-sm leading-relaxed text-zinc-200">
                  {selected.resumeText || 'No stored text found for this resume.'}
                </pre>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

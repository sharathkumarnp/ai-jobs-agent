'use client';

import React from 'react';
import { Search, ExternalLink, FileText } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { initFirebaseAuth } from '@/lib/firebase';

type LedgerRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  source: string | null;
  url: string | null;
  updatedAt: string | null;
};

type LedgerFilter = 'all' | 'ready_for_review' | 'submitted' | 'rejected' | 'searched';
const PAGE_SIZE = 10;

export default function LedgerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [rows, setRows] = React.useState<LedgerRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<LedgerFilter>('all');
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    const status = searchParams.get('status');
    const pageRaw = Number(searchParams.get('page') || '1');
    const allowed: LedgerFilter[] = ['all', 'ready_for_review', 'submitted', 'rejected', 'searched'];
    setActiveFilter(allowed.includes(status as LedgerFilter) ? (status as LedgerFilter) : 'all');
    setCurrentPage(Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1);
  }, [searchParams]);

  const updateQueryState = React.useCallback(
    (next: { filter?: LedgerFilter; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const filter = next.filter ?? activeFilter;
      const page = next.page ?? currentPage;

      if (filter === 'all') {
        params.delete('status');
      } else {
        params.set('status', filter);
      }
      if (page <= 1) {
        params.delete('page');
      } else {
        params.set('page', String(page));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [activeFilter, currentPage, pathname, router, searchParams]
  );

  const updateStatusFilter = React.useCallback(
    (filter: LedgerFilter) => {
      updateQueryState({ filter, page: 1 });
    },
    [updateQueryState]
  );

  React.useEffect(() => {
    let cancelled = false;

    const loadApplications = async () => {
      try {
        const auth = await initFirebaseAuth();
        const user = auth?.currentUser;
        if (!user) {
          if (!cancelled) setRows([]);
          return;
        }
        const idToken = await user.getIdToken();
        const res = await fetch('/api/applications', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Failed to fetch applications (${res.status}).`);
        }
        const payload = (await res.json()) as { applications?: LedgerRow[]; total?: number };
        if (!cancelled) {
          setRows(Array.isArray(payload.applications) ? payload.applications : []);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load applications.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadApplications();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = rows.filter((row) => {
    const q = searchTerm.trim().toLowerCase();
    const textMatch = !q || row.company.toLowerCase().includes(q) || row.role.toLowerCase().includes(q);
    const statusMatch = activeFilter === 'all' || row.status === activeFilter;
    return textMatch && statusMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const clampedPage = Math.min(currentPage, totalPages);
  const paginatedRows = React.useMemo(() => {
    const start = (clampedPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [clampedPage, filteredRows]);

  React.useEffect(() => {
    if (currentPage !== clampedPage) {
      updateQueryState({ page: clampedPage });
    }
  }, [clampedPage, currentPage, updateQueryState]);

  const filterCounts = React.useMemo(() => {
    const counts: Record<LedgerFilter, number> = {
      all: rows.length,
      ready_for_review: 0,
      submitted: 0,
      rejected: 0,
      searched: 0,
    };
    for (const row of rows) {
      if (row.status === 'ready_for_review') counts.ready_for_review += 1;
      if (row.status === 'submitted') counts.submitted += 1;
      if (row.status === 'rejected') counts.rejected += 1;
      if (row.status === 'searched') counts.searched += 1;
    }
    return counts;
  }, [rows]);

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const formatStatus = (value: string) => value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const updateDecision = async (row: LedgerRow, action: 'approve' | 'reject') => {
    try {
      setBusyId(row.id);
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
        body: JSON.stringify({ applicationId: row.id, action }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Failed to ${action} application.`);
      }

      setRows((prev) =>
        prev.map((entry) =>
          entry.id === row.id
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
      setBusyId(null);
    }
  };

  return (
    <div className="w-full max-w-none p-6 md:p-8 pb-24 min-h-0 flex flex-col premium-enter">
      <div className="flex justify-between items-end mb-5">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">Application Ledger</h1>
          <p className="text-zinc-400">Historical record of all AI-dispatched applications.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Loaded {rows.length} entries • Showing {filteredRows.length} after filters/search
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { id: 'all' as const, label: 'All' },
              { id: 'ready_for_review' as const, label: 'Awaiting review' },
              { id: 'submitted' as const, label: 'Submitted' },
              { id: 'rejected' as const, label: 'Rejected' },
              { id: 'searched' as const, label: 'Discovered only' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateStatusFilter(item.id)}
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
        </div>
        <div className="flex space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search companies..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-input rounded-md pl-10 pr-4 py-2 text-sm text-white"
            />
          </div>
        </div>
      </div>

      <div className="premium-card rounded-xl flex flex-col min-h-0 overflow-hidden premium-hover-lift">
        {loading ? (
          <div className="p-10 text-sm text-zinc-400">Loading your applications...</div>
        ) : error ? (
          <div className="p-10 text-sm text-red-300">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <FileText className="text-zinc-600" size={24} />
            </div>
            <h3 className="text-zinc-300 font-medium mb-1">Ledger Empty</h3>
            <p className="text-zinc-500 text-sm">No applications found for this account yet.</p>
          </div>
        ) : (
          <>
          <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-white/10 bg-[var(--surface)]/95 backdrop-blur">
              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company</th>
              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Role</th>
              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Source</th>
              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedRows.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4 font-medium text-zinc-200">{row.company}</td>
                <td className="p-4 text-zinc-400">{row.role}</td>
                <td className="p-4 text-zinc-500 text-sm">{row.source || '-'}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    row.status.toLowerCase().includes('dispatch') ? 'bg-indigo-300/20 text-indigo-100 border-indigo-200/30' : 
                    'bg-amber-200/15 text-amber-100 border-amber-200/30'
                  }`}>
                    {formatStatus(row.status)}
                  </span>
                </td>
                <td className="p-4 text-zinc-500 text-sm">{formatDate(row.updatedAt)}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer" className="inline-block text-zinc-500 hover:text-white transition-colors premium-hover-lift" title="Open job link">
                        <ExternalLink size={16} />
                      </a>
                    ) : (
                      <span className="text-zinc-700 inline-block">
                        <ExternalLink size={16} />
                      </span>
                    )}
                    {(row.status === 'ready_for_review' || row.status === 'searched') ? (
                      <>
                        <button
                          onClick={() => updateDecision(row, 'approve')}
                          disabled={busyId === row.id}
                          className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[11px] text-emerald-100 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateDecision(row, 'reject')}
                          disabled={busyId === row.id}
                          className="rounded-md border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-[11px] text-rose-100 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-white/10 bg-[var(--surface)] px-4 py-3 text-xs text-zinc-400">
          <span>
            Showing {(clampedPage - 1) * PAGE_SIZE + 1}-{Math.min(clampedPage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateQueryState({ page: clampedPage - 1 })}
              disabled={clampedPage <= 1}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-zinc-500">
              Page {clampedPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => updateQueryState({ page: clampedPage + 1 })}
              disabled={clampedPage >= totalPages}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

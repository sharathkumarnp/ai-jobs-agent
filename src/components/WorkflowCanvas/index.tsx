'use client';

import React, { useEffect } from 'react';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { DiscoveryNode, FilterNode, ResumeForgeNode, DispatcherNode, ConnectionLine } from './Nodes';
import { DashboardMetrics } from './DashboardMetrics';
import { Terminal, Workflow } from 'lucide-react';

export default function WorkflowCanvas() {
  const { pushLog, activityLogs } = useWorkflowStore();

  // The engine is currently in a standby state awaiting connection to the real backend data stream.
  useEffect(() => {
    if (activityLogs.length > 0) return;
    pushLog({ nodeId: 'discovery', message: 'System armed. Awaiting real backend hookup...' });
  }, [activityLogs.length, pushLog]);

  return (
    <div className="flex h-full w-full overflow-hidden relative rounded-3xl bg-[var(--background)] premium-enter">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 graphic-grid" />
        <div className="absolute top-24 right-20 h-16 w-16 graphic-glow premium-drift" />
      </div>
      <div className="flex-1 flex flex-col items-start p-4 md:p-6 overflow-y-auto no-scrollbar scroll-fade-y w-full">
        <div className="mb-6 w-full">
          <DashboardMetrics />
        </div>

        <div className="w-full premium-card premium-card-flat rounded-3xl p-6 md:p-8 relative overflow-visible">
          <div className="pointer-events-none absolute -bottom-10 left-12 h-24 w-24 graphic-glow premium-drift-alt" />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold text-[var(--foreground)] tracking-tight">Workflow Pipeline</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">Select a node to inspect detailed logs in real-time.</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-[var(--text-muted)] bg-[var(--surface-elevated)] rounded-full px-3 py-1.5">
              <Workflow size={15} />
              <span>Live orchestration</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[980px] flex items-center justify-center gap-2 py-3 px-2">
              <DiscoveryNode />
              <ConnectionLine active={true} />
              <FilterNode />
              <ConnectionLine />
              <ResumeForgeNode />
              <ConnectionLine active={true} />
              <DispatcherNode />
            </div>
          </div>

          <LiveActivityPanel />
        </div>
      </div>

    </div>
  );
}

const LiveActivityPanel = () => {
  const { activeNodeId, setActiveNode, activityLogs } = useWorkflowStore();

  const nodeNames: Record<string, string> = {
    discovery: 'Discovery Engine Logs',
    filter: 'Intelligent Filter Logs',
    forge: 'Resume Forge Logs',
    dispatcher: 'Dispatcher Core Logs'
  };

  return (
    <div className="mt-8 premium-card premium-card-flat rounded-2xl overflow-hidden">
      <div className="p-4 md:p-5 flex items-center justify-between bg-[var(--surface-elevated)]/55">
        <div className="flex items-center space-x-3">
          <Terminal size={18} className="text-[var(--foreground)]" />
          <h2 className="text-base font-medium text-[var(--foreground)]">
            {activeNodeId ? nodeNames[activeNodeId] : 'Node Details'}
          </h2>
        </div>
        {activeNodeId && (
          <button
            onClick={() => setActiveNode(null)}
            className="text-xs px-2.5 py-1 rounded-md btn-subtle premium-hover-lift"
          >
            Clear
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto no-scrollbar scroll-fade-y p-4 md:p-5 space-y-3 font-mono text-sm leading-relaxed">
        {activityLogs.filter(log => !activeNodeId || log.nodeId === activeNodeId).map((log) => (
          <div key={log.id} className="group relative pl-5 border-l-2 border-[var(--border)] pb-3 last:pb-0">
            <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[var(--surface)] border-[3px] border-[var(--border)] group-hover:border-[var(--brand)] transition-colors"></span>
            <div className="flex justify-between items-center mb-1">
              <span suppressHydrationWarning className="text-[var(--text-muted)] font-bold">[{log.timestamp.toLocaleTimeString()}]</span>
            </div>
            <p className="text-[var(--foreground)]/90 break-words">{log.message}</p>
          </div>
        ))}
        {activityLogs.filter(log => !activeNodeId || log.nodeId === activeNodeId).length === 0 && (
          <div className="text-[var(--text-muted)] text-center italic mt-8">
            Click a workflow node to inspect details.
          </div>
        )}
      </div>
    </div>
  );
};

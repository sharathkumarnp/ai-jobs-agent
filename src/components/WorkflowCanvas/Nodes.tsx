'use client';

import React from 'react';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { Globe, Filter, FileText, Send } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NodeProps {
  id: string;
  icon: React.ElementType;
  title: string;
  metricLabel: string;
  metricValue: number | string;
  isActive?: boolean;
  className?: string;
}

const GlassNode = ({ id, icon: Icon, title, metricLabel, metricValue, isActive, className }: NodeProps) => {
  const { activeNodeId, setActiveNode } = useWorkflowStore();
  const isSelected = activeNodeId === id;
  const accentMap: Record<string, string> = {
    discovery: 'text-sky-300 bg-sky-500/10',
    filter: 'text-amber-300 bg-amber-500/10',
    forge: 'text-violet-300 bg-violet-500/10',
    dispatcher: 'text-emerald-300 bg-emerald-500/10',
  };
  const accent = accentMap[id] ?? 'text-[var(--text-muted)] bg-[var(--surface-elevated)]';
  const glowClassMap: Record<string, string> = {
    discovery: 'workflow-node workflow-node-discovery',
    filter: 'workflow-node workflow-node-filter',
    forge: 'workflow-node workflow-node-forge',
    dispatcher: 'workflow-node workflow-node-dispatcher',
  };
  const glowClass = glowClassMap[id] ?? 'workflow-node';

  return (
    <div 
      onClick={() => setActiveNode(id)}
      className={cn(
        "relative w-full max-w-[18rem] p-5 rounded-2xl cursor-pointer transition-all duration-300 premium-enter",
        "premium-card premium-card-flat",
        glowClass,
        "hover:-translate-y-1 premium-hover-lift",
        isSelected && "ring-2 ring-[var(--brand)] shadow-[0_0_0_3px_rgba(127,140,163,0.2),0_18px_36px_rgba(5,8,14,0.35)]",
        isActive && !isSelected && "hover:shadow-[0_12px_36px_rgba(5,8,14,0.25)]",
        className
      )}
    >
      {/* Activity Indicator (pulsing dot) */}
      {isActive && (
        <span className="absolute top-4 right-4 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand)] opacity-60"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--brand)]"></span>
        </span>
      )}

      <div className="flex items-center space-x-4 mb-4">
        <div className={cn(
          "p-3 rounded-xl",
          isActive ? accent : "bg-[var(--surface-elevated)] text-[var(--text-muted)]"
        )}>
          <Icon size={24} />
        </div>
        <h3 className="text-lg font-medium text-[var(--foreground)] tracking-tight">{title}</h3>
      </div>

      <div className="mt-2">
        <p className="text-sm text-[var(--text-muted)]">{metricLabel}</p>
        <p className="text-2xl font-semibold text-[var(--foreground)]">
          {metricValue.toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export const DiscoveryNode = () => {
  const metrics = useWorkflowStore(s => s.metrics);
  return <GlassNode id="discovery" icon={Globe} title="Discovery Engine" metricLabel="Global Scans" metricValue={metrics.scanned} isActive={true} />;
};

export const FilterNode = () => {
  const metrics = useWorkflowStore(s => s.metrics);
  return <GlassNode id="filter" icon={Filter} title="Intelligent Filter" metricLabel="Discarded Roles" metricValue={metrics.discarded} isActive={false} />;
};

export const ResumeForgeNode = () => {
  const metrics = useWorkflowStore(s => s.metrics);
  return <GlassNode id="forge" icon={FileText} title="Resume Forge" metricLabel="Tailored Assets" metricValue={metrics.tailored} isActive={true} />;
};

export const DispatcherNode = () => {
  const metrics = useWorkflowStore(s => s.metrics);
  return <GlassNode id="dispatcher" icon={Send} title="Dispatcher Core" metricLabel="Auto-Submitted" metricValue={metrics.submitted} isActive={false} />;
};

export const ConnectionLine = ({ active = false }: { active?: boolean }) => {
  return (
    <div className="flex items-center justify-center w-16 h-14 -mx-1">
      <div className={cn('workflow-link', active && 'workflow-link-active')}>
        <span className="workflow-link-pulse" />
      </div>
    </div>
  );
};

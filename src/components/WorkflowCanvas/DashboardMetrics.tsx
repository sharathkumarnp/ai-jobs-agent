'use client';

import React from 'react';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { Globe, Filter, FileText, Send, TrendingUp } from 'lucide-react';

export function DashboardMetrics() {
  const metrics = useWorkflowStore(s => s.metrics);

  const statCards = [
    { label: 'Global Discoveries', value: metrics.scanned, icon: Globe, accent: 'text-sky-300 bg-sky-500/10' },
    { label: 'Total Discards', value: metrics.discarded, icon: Filter, accent: 'text-amber-300 bg-amber-500/10' },
    { label: 'Bespoke Resumes', value: metrics.tailored, icon: FileText, accent: 'text-violet-300 bg-violet-500/10' },
    { label: 'Successful Dispatches', value: metrics.submitted, icon: Send, accent: 'text-emerald-300 bg-emerald-500/10' },
  ];

  // Calculate some simple dynamic subtext
  const successRate = metrics.scanned > 0 ? ((metrics.submitted / metrics.scanned) * 100).toFixed(1) : '0.0';

  return (
    <div className="w-full mb-8 premium-enter relative">
      <div className="pointer-events-none absolute top-12 left-1/2 h-12 w-12 graphic-glow premium-drift-alt" />
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Real-time performance of your automated job pipeline.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-[var(--foreground)] bg-[var(--surface-elevated)] px-3 py-1.5 rounded-full premium-hover-lift">
          <TrendingUp size={16} className="text-emerald-300" />
          <span>{successRate}% Dispatch Rate</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div 
            key={idx}
            className="flex items-start justify-between p-5 rounded-2xl premium-card premium-card-flat transition-all premium-hover-lift"
          >
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">{stat.label}</p>
              <h3 className="text-4xl font-semibold text-[var(--foreground)] tracking-tight leading-none mt-2">
                {stat.value.toLocaleString()}
              </h3>
            </div>
            <div className={`p-2.5 rounded-xl ${stat.accent}`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { CheckCircle2, LifeBuoy } from 'lucide-react';

export default function InterventionHubPage() {
  return (
    <div className="w-full max-w-none p-6 md:p-8 pb-24 premium-enter">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">Intervention Hub</h1>
        <p className="text-zinc-400">Applications stalled by complex logic or CAPTCHAs that need your human input.</p>
      </div>

      <div className="premium-card rounded-xl p-8 premium-hover-lift flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <LifeBuoy className="text-zinc-500" size={22} />
        </div>
        <h3 className="text-zinc-200 font-semibold mb-1">No interventions pending</h3>
        <p className="text-zinc-500 text-sm max-w-xl">
          There are currently no blocked applications for this account. Any future human-required steps will appear here.
        </p>
      </div>

      <div className="mt-12 flex items-center justify-center p-8 bg-indigo-300/10 border border-indigo-200/25 rounded-xl premium-hover-lift">
        <div className="flex items-center text-indigo-100">
          <CheckCircle2 className="mr-3" />
          <span className="font-medium">All other pipelines are running smoothly autonomously.</span>
        </div>
      </div>
    </div>
  );
}

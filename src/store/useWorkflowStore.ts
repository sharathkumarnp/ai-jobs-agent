import { create } from 'zustand';

export interface Job {
  id: string;
  company: string;
  role: string;
  status: 'discovered' | 'filtered' | 'tailoring' | 'submitted' | 'intervention-needed';
  matchScore: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  nodeId: 'discovery' | 'filter' | 'forge' | 'dispatcher';
  message: string;
  metadata?: unknown;
}

export interface WorkflowState {
  currentUserId: string | null;
  activeJobs: Job[];
  activityLogs: LogEntry[];
  activeNodeId: string | null;
  masterResumeText: string | null;
  metrics: {
    scanned: number;
    discarded: number;
    tailored: number;
    submitted: number;
    failed: number;
  };
  blueprintConfig: {
    targetRole: string;
    location: string;
    workMode: string;
    blacklisted: string[];
    experience: number;
    compensation: number;
    currency: string;
  };

  setActiveNode: (nodeId: string | null) => void;
  resetForUser: (userId: string | null) => void;
  hydrateFromRemote: (
    userId: string,
    payload: Partial<Pick<WorkflowState, 'metrics' | 'activityLogs' | 'blueprintConfig'>>
  ) => void;
  setMasterResumeText: (text: string | null) => void;
  setBlueprintConfig: (config: Partial<WorkflowState['blueprintConfig']>) => void;
  pushLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  updateJobStatus: (id: string, status: Job['status']) => void;
  incrementMetric: (metric: keyof WorkflowState['metrics'], amount?: number) => void;
}

const createInitialState = () => ({
  activeJobs: [] as Job[],
  activityLogs: [] as LogEntry[],
  activeNodeId: null as string | null,
  masterResumeText: null as string | null,
  metrics: { scanned: 0, discarded: 0, tailored: 0, submitted: 0, failed: 0 },
  blueprintConfig: {
    targetRole: '',
    location: '',
    workMode: '',
    blacklisted: [],
    experience: 0,
    compensation: 0,
    currency: '',
  },
});

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  currentUserId: null,
  activeJobs: [],
  activityLogs: [],
  activeNodeId: null,
  masterResumeText: null,
  metrics: { scanned: 0, discarded: 0, tailored: 0, submitted: 0, failed: 0 },
  blueprintConfig: {
    targetRole: '',
    location: '',
    workMode: '',
    blacklisted: [],
    experience: 0,
    compensation: 0,
    currency: ''
  },

  setActiveNode: (nodeId) => set({ activeNodeId: nodeId }),
  resetForUser: (userId) => {
    const state = get();
    if (state.currentUserId === userId) return;
    set({
      currentUserId: userId,
      ...createInitialState(),
    });
  },
  hydrateFromRemote: (userId, payload) => {
    const state = get();
    if (state.currentUserId !== userId) {
      return;
    }

    set((prev) => ({
      metrics: payload.metrics ? { ...prev.metrics, ...payload.metrics } : prev.metrics,
      activityLogs: Array.isArray(payload.activityLogs)
        ? payload.activityLogs.map((entry) => ({
            ...entry,
            timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
          }))
        : prev.activityLogs,
      blueprintConfig: payload.blueprintConfig
        ? { ...prev.blueprintConfig, ...payload.blueprintConfig }
        : prev.blueprintConfig,
    }));
  },
  setMasterResumeText: (text) => set({ masterResumeText: text }),
  setBlueprintConfig: (config) => set((state) => ({ blueprintConfig: { ...state.blueprintConfig, ...config } })),
  
  pushLog: (log) => set((state) => ({ 
    activityLogs: [
      {
        ...log,
        id: Math.random().toString(36).substring(7),
        timestamp: new Date()
      },
      ...state.activityLogs
    ].slice(0, 100) 
  })),

  updateJobStatus: (id, status) => set((state) => ({
    activeJobs: state.activeJobs.map(job => job.id === id ? { ...job, status } : job)
  })),

  incrementMetric: (metric, amount = 1) => set((state) => ({
    metrics: { ...state.metrics, [metric]: state.metrics[metric] + amount }
  })),
}));

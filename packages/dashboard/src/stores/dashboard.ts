// ============================================================================
// Monnu Clow — Zustand Store
// Reactive state management with WebSocket integration
// ============================================================================

import { create } from 'zustand';

// Replicate core types for dashboard (avoids cross-package dep in browser)
export type AgentRole = 'supervisor' | 'planner' | 'coder' | 'tester' | 'debugger' | 'reviewer' | 'fullstack-1' | 'fullstack-2' | 'fullstack-3' | 'tester-1' | 'tester-2' | 'ba' | 'manager' | 'architect' | 'senior-dev' | 'functional-reviewer' | 'security';
export type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'waiting';
export type PipelinePhase = 'analyzing' | 'planning' | 'supervising' | 'coding' | 'testing' | 'debugging' | 'reviewing' | 'verifying' | 'completed' | 'idle';

export interface AgentState {
    role: AgentRole;
    status: AgentStatus;
    message: string;
    iterations: number;
    errors: number;
    enabled: boolean;
}

export interface PipelineState {
    phase: PipelinePhase;
    currentAgent: AgentRole | null;
    iteration: number;
    isStable: boolean;
}

export interface StabilityReport {
    pendingTasks: number;
    openBugs: number;
    runtimeErrors: number;
    failingTests: number;
    coveragePercent: number;
    coverageThreshold: number;
    isStable: boolean;
}

export interface TaskItem {
    id: string;
    title: string;
    status: string;
    assignedAgent: AgentRole | null;
    priority: number;
}

export interface BugItem {
    id: string;
    file: string;
    description: string;
    severity: string;
    status: string;
}

export interface ActivityItem {
    id: string;
    type: string;
    timestamp: number;
    source: string;
    message: string;
    level: 'info' | 'warn' | 'error' | 'success';
}

export interface WorkspaceItem {
    id: string;
    path: string;
    name: string;
}

export interface EditorTab {
    id: string; // usually workspaceId:path
    path: string;
    workspaceId: string;
    name: string;
    content: string;
    isDirty: boolean;
    originalContent?: string; // for diffing
}

export interface WorkflowItem {
    id: string;
    name: string;
    steps: { name: string; status: 'pending' | 'working' | 'completed' | 'failed' }[];
    progress: number;
    startTime: number;
    endTime?: number;
}

export interface HistoricalTask {
    id: string;
    title: string;
    completedAt: number;
    agent: AgentRole;
    outcome: 'success' | 'failure';
}

interface DashboardStore {
    // Connection
    connected: boolean;
    setConnected: (v: boolean) => void;

    // Pipeline
    pipeline: PipelineState;
    setPipeline: (p: PipelineState) => void;
    isRunning: boolean;
    setIsRunning: (v: boolean) => void;

    // Agents
    agents: Record<AgentRole, AgentState>;
    updateAgent: (role: AgentRole, status: AgentStatus, message: string) => void;

    // Stability
    stability: StabilityReport;
    setStability: (s: StabilityReport) => void;

    // Activity feed
    activities: ActivityItem[];
    addActivity: (a: ActivityItem) => void;
    clearActivities: () => void;

    // Tasks
    tasks: TaskItem[];
    addTask: (t: TaskItem) => void;
    updateTask: (id: string, updates: Partial<TaskItem>) => void;

    // Bugs
    bugs: BugItem[];
    addBug: (b: BugItem) => void;
    updateBug: (id: string, updates: Partial<BugItem>) => void;

    // Workspace & Editor
    workspaces: WorkspaceItem[];
    setWorkspaces: (w: WorkspaceItem[]) => void;
    activeWorkspaceId: string | null;
    setActiveWorkspaceId: (id: string | null) => void;

    tabs: EditorTab[];
    activeTabId: string | null;
    setActiveTabId: (id: string | null) => void;
    addTab: (tab: EditorTab) => void;
    removeTab: (id: string) => void;
    updateTab: (id: string, updates: Partial<EditorTab>) => void;

    // Advanced Data
    workflows: WorkflowItem[];
    setWorkflows: (w: WorkflowItem[]) => void;
    historicalTasks: HistoricalTask[];
    addHistoricalTask: (t: HistoricalTask) => void;
    calendarDate: string; // YYYY-MM-DD
    setCalendarDate: (d: string) => void;

    // Multi-Agent Orchestration & Metrics
    totalIterations: number;
    dailyIterations: number;
    totalEarnings: number;
    earningsPerIteration: number;
    toggleAgent: (role: AgentRole) => void;
    incrementIteration: (role: AgentRole) => void;
    updateEarnings: () => void;

    // AI Mode / Autopilot
    autoPilotEnabled: boolean;
    setAutoPilotEnabled: (v: boolean) => void;

    // Current Agent Task Info
    currentTask: { title: string; detail: string; status: 'planning' | 'coding' | 'testing' | 'reviewing' } | null;
    setCurrentTask: (t: { title: string; detail: string; status: 'planning' | 'coding' | 'testing' | 'reviewing' } | null) => void;

    // Communication
    sendMessage: (action: string, data?: any) => void;
    setSendMessage: (fn: (action: string, data?: any) => void) => void;
}

const defaultAgents: Record<AgentRole, AgentState> = {
    planner: { role: 'planner', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    coder: { role: 'coder', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    tester: { role: 'tester', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    debugger: { role: 'debugger', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    reviewer: { role: 'reviewer', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    supervisor: { role: 'supervisor', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    'fullstack-1': { role: 'fullstack-1', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    'fullstack-2': { role: 'fullstack-2', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    'fullstack-3': { role: 'fullstack-3', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    'tester-1': { role: 'tester-1', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    'tester-2': { role: 'tester-2', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    ba: { role: 'ba', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    manager: { role: 'manager', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    architect: { role: 'architect', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    'senior-dev': { role: 'senior-dev', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    'functional-reviewer': { role: 'functional-reviewer', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true },
    security: { role: 'security', status: 'idle', message: 'Ready', iterations: 0, errors: 0, enabled: true }
};

export const useDashboardStore = create<DashboardStore>((set) => ({
    // Connection
    connected: false,
    setConnected: (v) => set({ connected: v }),

    // Pipeline
    pipeline: {
        phase: 'idle',
        currentAgent: null,
        iteration: 0,
        isStable: false,
    },
    setPipeline: (p) => set({ pipeline: p }),
    isRunning: false,
    setIsRunning: (v) => set({ isRunning: v }),

    // Agents
    agents: { ...defaultAgents },
    updateAgent: (role, status, message) =>
        set((state) => ({
            agents: {
                ...state.agents,
                [role]: { ...state.agents[role], status, message },
            },
        })),

    // Stability
    stability: {
        pendingTasks: 0,
        openBugs: 0,
        runtimeErrors: 0,
        failingTests: 0,
        coveragePercent: 0,
        coverageThreshold: 80,
        isStable: false,
    },
    setStability: (s) => set({ stability: s }),

    // Activity feed
    activities: [],
    addActivity: (a) =>
        set((state) => ({
            activities: [a, ...state.activities].slice(0, 200),
        })),
    clearActivities: () => set({ activities: [] }),

    // Tasks
    tasks: [],
    addTask: (t) =>
        set((state) => ({
            tasks: [...state.tasks.filter((x) => x.id !== t.id), t],
        })),
    updateTask: (id, updates) =>
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.id === id ? { ...t, ...updates } : t
            ),
        })),

    // Bugs
    bugs: [],
    addBug: (b) =>
        set((state) => ({
            bugs: [...state.bugs.filter((x) => x.id !== b.id), b],
        })),
    updateBug: (id, updates) =>
        set((state) => ({
            bugs: state.bugs.map((b) =>
                b.id === id ? { ...b, ...updates } : b
            ),
        })),

    // Workspace & Editor
    workspaces: [],
    setWorkspaces: (w) => set({ workspaces: w }),
    activeWorkspaceId: null,
    setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

    tabs: [],
    activeTabId: null,
    setActiveTabId: (id) => set({ activeTabId: id }),
    addTab: (tab) =>
        set((state) => {
            const exists = state.tabs.find((t) => t.id === tab.id);
            if (exists) return { activeTabId: tab.id };
            return {
                tabs: [...state.tabs, tab],
                activeTabId: tab.id,
            };
        }),
    removeTab: (id) =>
        set((state) => {
            const newTabs = state.tabs.filter((t) => t.id !== id);
            let nextActiveId = state.activeTabId;
            if (state.activeTabId === id) {
                nextActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
            }
            return { tabs: newTabs, activeTabId: nextActiveId };
        }),
    updateTab: (id, updates) =>
        set((state) => ({
            tabs: state.tabs.map((t) =>
                t.id === id ? { ...t, ...updates } : t
            ),
        })),

    // Advanced Data
    workflows: [],
    setWorkflows: (w) => set({ workflows: w }),
    historicalTasks: [],
    addHistoricalTask: (t) =>
        set((state) => ({
            historicalTasks: [t, ...state.historicalTasks],
        })),
    calendarDate: new Date().toISOString().split('T')[0],
    setCalendarDate: (d) => set({ calendarDate: d }),

    // Multi-Agent Orchestration & Metrics
    totalIterations: 0,
    dailyIterations: 0,
    totalEarnings: 0,
    earningsPerIteration: 0.05, // $0.05 per iteration

    toggleAgent: (role) => set((state) => ({
        agents: {
            ...state.agents,
            [role]: { ...state.agents[role], enabled: !state.agents[role].enabled }
        }
    })),

    incrementIteration: (role) => set((state) => {
        const newTotal = state.totalIterations + 1;
        const newDaily = state.dailyIterations + 1;
        const newEarnings = newTotal * state.earningsPerIteration;
        return {
            totalIterations: newTotal,
            dailyIterations: newDaily,
            totalEarnings: newEarnings,
            agents: {
                ...state.agents,
                [role]: { ...state.agents[role], iterations: state.agents[role].iterations + 1 }
            }
        };
    }),

    updateEarnings: () => set((state) => ({
        totalEarnings: state.totalIterations * state.earningsPerIteration
    })),

    // AI Mode / Autopilot
    autoPilotEnabled: false,
    setAutoPilotEnabled: (v) => set({ autoPilotEnabled: v }),

    // Current Agent Task Info
    currentTask: null,
    setCurrentTask: (t) => set({ currentTask: t }),

    // Communication
    sendMessage: () => { },
    setSendMessage: (fn) => set({ sendMessage: fn }),
}));

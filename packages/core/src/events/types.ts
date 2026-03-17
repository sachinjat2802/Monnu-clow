// ============================================================================
// Monnu Clow — Event System Types
// Real-time event types for agent communication and dashboard streaming
// ============================================================================

export type AgentRole = 'planner' | 'coder' | 'tester' | 'debugger' | 'reviewer' | 'supervisor';

export type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'waiting';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked';

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export type BugStatus = 'open' | 'investigating' | 'fixing' | 'fixed' | 'verified';

export type PipelinePhase =
    | 'analyzing'
    | 'planning'
    | 'supervising'
    | 'coding'
    | 'testing'
    | 'debugging'
    | 'reviewing'
    | 'verifying'
    | 'completed'
    | 'idle';

// --- Core Data Structures ---

export interface Agent {
    id: string;
    name: string;
    role: AgentRole | string;
    status: AgentStatus;
    message: string;
    iterations: number;
    errors: number;
    enabled: boolean;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignedAgent: AgentRole | null;
    priority: number; // 1 = highest
    createdAt: number;
    updatedAt: number;
    completedAt: number | null;
    parentTaskId: string | null;
    subtasks: string[];
    tags: string[];
    estimatedComplexity: number; // 1-10
}

export interface Bug {
    id: string;
    file: string;
    line: number | null;
    description: string;
    rootCause: string | null;
    severity: BugSeverity;
    status: BugStatus;
    resolution: string | null;
    detectedAt: number;
    resolvedAt: number | null;
    detectedBy: AgentRole;
    fixedBy: AgentRole | null;
    relatedTests: string[];
    recurrenceCount: number;
}

export interface RuntimeError {
    id: string;
    file: string;
    error: string;
    stackTrace: string;
    fixApplied: string | null;
    status: 'open' | 'fixed';
    occurredAt: number;
    fixedAt: number | null;
}

export interface AgentAction {
    id: string;
    agentRole: AgentRole;
    action: string;
    detail: string;
    timestamp: number;
    duration: number | null;
    result: 'success' | 'failure' | 'pending';
    metadata: Record<string, unknown>;
}

export interface PipelineState {
    phase: PipelinePhase;
    currentAgent: AgentRole | null;
    iteration: number;
    startedAt: number;
    lastActivityAt: number;
    isStable: boolean;
    stability: StabilityReport;
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

export interface MemoryEntry {
    id: string;
    type: 'recurring-bug' | 'unstable-module' | 'failing-test' | 'fragile-code';
    target: string; // file or module path
    occurrences: number;
    firstSeen: number;
    lastSeen: number;
    priority: number;
    notes: string[];
}

export interface FileAnalysis {
    path: string;
    language: string;
    lines: number;
    complexity: number;
    hasTests: boolean;
    testFile: string | null;
    issues: string[];
    dependencies: string[];
}

export interface RepositoryHealth {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    testCoverage: number;
    fileAnalyses: FileAnalysis[];
    healthScore: number; // 0-100
}

// --- Event Types ---

export interface AgentEvent {
    type: string;
    timestamp: number;
    agentRole: AgentRole | null;
    data: unknown;
}

export interface AgentStatusEvent extends AgentEvent {
    type: 'agent:status';
    data: {
        role: AgentRole;
        status: AgentStatus;
        message: string;
    };
}

export interface AgentActionEvent extends AgentEvent {
    type: 'agent:action';
    data: AgentAction;
}

export interface PipelineEvent extends AgentEvent {
    type: 'pipeline:phase-change' | 'pipeline:iteration' | 'pipeline:complete';
    data: PipelineState;
}

export interface TaskEvent extends AgentEvent {
    type: 'task:created' | 'task:updated' | 'task:completed' | 'task:failed';
    data: Task;
}

export interface BugEvent extends AgentEvent {
    type: 'bug:detected' | 'bug:investigating' | 'bug:fixed' | 'bug:verified';
    data: Bug;
}

export interface ErrorEvent extends AgentEvent {
    type: 'error:detected' | 'error:fixed';
    data: RuntimeError;
}

export interface StabilityEvent extends AgentEvent {
    type: 'stability:report';
    data: StabilityReport;
}

export interface LogEvent extends AgentEvent {
    type: 'log:info' | 'log:warn' | 'log:error' | 'log:success';
    data: {
        message: string;
        source: string;
        details?: string;
    };
}

export type SystemEvent =
    | AgentStatusEvent
    | AgentActionEvent
    | PipelineEvent
    | TaskEvent
    | BugEvent
    | ErrorEvent
    | StabilityEvent
    | LogEvent;

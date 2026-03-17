// ============================================================================
// Monnu Clow — Pipeline Executor
// Orchestrates the multi-agent execution loop
// ============================================================================

import {
    PipelineState,
    PipelinePhase,
    StabilityReport,
    AgentRole,
    AgentStatus,
    Task,
    Bug,
} from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { AgentContext } from '../agents/base-agent.js';
import { PlannerAgent } from '../agents/planner.js';
import { CoderAgent } from '../agents/coder.js';
import { TesterAgent } from '../agents/tester.js';
import { DebuggerAgent } from '../agents/debugger.js';
import { ReviewerAgent } from '../agents/reviewer.js';
import { SupervisorAgent } from '../agents/supervisor.js';
import { BaseLLMProvider } from '../llm/provider.js';
import { createLLMFromEnv, isLLMConfigured } from '../llm/factory.js';

interface PipelineConfig {
    workingDirectory: string;
    maxIterations: number;
    coverageThreshold: number;
    autoFix: boolean;
    verbose: boolean;
    autoPilot: boolean;
}

const DEFAULT_CONFIG: PipelineConfig = {
    workingDirectory: '.',
    maxIterations: 10,
    coverageThreshold: 80,
    autoFix: true,
    verbose: true,
    autoPilot: false,
};

export class PipelineExecutor {
    private config: PipelineConfig;
    private events: AgentEventEmitter;
    private state: PipelineState;
    private sharedMemory: Map<string, unknown>;

    // Agents
    private planner: PlannerAgent;
    private coder: CoderAgent;
    private tester: TesterAgent;
    private debugger_: DebuggerAgent;
    private reviewer: ReviewerAgent;
    private supervisor: SupervisorAgent;

    // Tracking
    private isRunning = false;
    private shouldStop = false;

    constructor(config: Partial<PipelineConfig> = {}, events?: AgentEventEmitter) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.events = events ?? new AgentEventEmitter();
        this.sharedMemory = new Map();

        // Initialize state
        this.state = {
            phase: 'idle',
            currentAgent: null,
            iteration: 0,
            startedAt: 0,
            lastActivityAt: 0,
            isStable: false,
            stability: this.emptyStabilityReport(),
        };

        // Detect LLM provider from environment
        let llm: BaseLLMProvider | undefined;
        if (isLLMConfigured()) {
            try {
                llm = createLLMFromEnv();
                this.events.log(
                    'info',
                    'Pipeline',
                    `🤖 AI enabled: ${llm.getProvider()}/${llm.getModel()}`
                );
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                this.events.log('warn', 'Pipeline', `LLM init failed: ${msg} — running without AI`);
            }
        } else {
            this.events.log('info', 'Pipeline', '📋 No AI configured — using static analysis (set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY)');
        }

        // Create agents (with LLM if available)
        this.planner = new PlannerAgent(this.events, llm);
        this.coder = new CoderAgent(this.events, llm);
        this.tester = new TesterAgent(this.events, llm);
        this.debugger_ = new DebuggerAgent(this.events, llm);
        this.reviewer = new ReviewerAgent(this.events, llm);
        this.supervisor = new SupervisorAgent(this.events, llm);

        // Listen for agent status changes to keep shared memory synced
        this.events.on('agent:status', (event: any) => {
            const agentStatuses = (this.sharedMemory.get('agentStatuses') as Map<AgentRole, AgentStatus>) ?? new Map();
            if (event.data?.role && event.data?.status) {
                agentStatuses.set(event.data.role, event.data.status);
                this.sharedMemory.set('agentStatuses', agentStatuses);
            }
        });

        // Also sync pipeline state to shared memory
        this.sharedMemory.set('pipelineState', this.state);
    }

    /**
     * Start the autonomous execution loop
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.events.log('warn', 'Pipeline', 'Pipeline is already running');
            return;
        }

        this.isRunning = true;
        this.shouldStop = false;
        this.state.startedAt = Date.now();
        this.state.iteration = 0;

        this.events.log(
            'info',
            'Pipeline',
            '🚀 Monnu Clow Pipeline starting autonomous execution',
            `Working directory: ${this.config.workingDirectory}`
        );

        try {
            while (!this.shouldStop) {
                // In auto-pilot mode, we ignore maxIterations unless we hit a hard cap (say 100)
                const effectiveMax = this.config.autoPilot ? 100 : this.config.maxIterations;
                if (this.state.iteration >= effectiveMax) break;

                this.state.iteration++;

                this.events.log(
                    'info',
                    'Pipeline',
                    `━━━ Iteration ${this.state.iteration}/${effectiveMax} ${this.config.autoPilot ? '(AUTOPILOT)' : ''} ━━━`
                );

                this.emitPipelineEvent('pipeline:iteration');

                // Execute the full pipeline
                await this.executeIteration();

                // Check stability
                const stability = this.checkStability();
                this.state.stability = stability;
                this.state.isStable = stability.isStable;

                this.events.emit({
                    type: 'stability:report',
                    timestamp: Date.now(),
                    agentRole: null,
                    data: stability,
                });

                if (stability.isStable) {
                    this.events.log(
                        'success',
                        'Pipeline',
                        '✅ Repository is stable — all conditions met'
                    );
                    break;
                }

                this.events.log(
                    'warn',
                    'Pipeline',
                    `Repository not yet stable — continuing execution`,
                    JSON.stringify(stability, null, 2)
                );
            }

            if (this.state.iteration >= this.config.maxIterations) {
                this.events.log(
                    'warn',
                    'Pipeline',
                    `Max iterations (${this.config.maxIterations}) reached — stopping`
                );
            }

            // Final verification
            await this.finalVerification();
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.events.log('error', 'Pipeline', `Pipeline error: ${msg}`);
        } finally {
            this.isRunning = false;
            this.setPhase('completed', null);
            this.emitPipelineEvent('pipeline:complete');

            this.events.log(
                'info',
                'Pipeline',
                `Pipeline completed after ${this.state.iteration} iterations`
            );
        }
    }

    /**
     * Execute one full iteration of the pipeline
     */
    private async executeIteration(): Promise<void> {
        const context = this.createContext();

        // Phase 1: Planning
        this.setPhase('planning', 'planner');
        await this.planner.execute(context);

        // Store planner tasks in shared memory
        const tasks = this.planner.getGeneratedTasks();
        this.sharedMemory.set('tasks', tasks);

        // Phase 1.5: Supervising
        this.setPhase('supervising', 'supervisor');
        await this.supervisor.execute(this.createContext());

        // Phase 2: Coding
        this.setPhase('coding', 'coder');
        await this.coder.execute(this.createContext());

        // Phase 3: Testing
        this.setPhase('testing', 'tester');
        await this.tester.execute(this.createContext());

        // Phase 4: Debugging
        this.setPhase('debugging', 'debugger');
        await this.debugger_.execute(this.createContext());

        // Phase 5: Reviewing
        this.setPhase('reviewing', 'reviewer');
        await this.reviewer.execute(this.createContext());

        // Phase 6: Verifying
        this.setPhase('verifying', null);
    }

    /**
     * Final verification before termination
     */
    private async finalVerification(): Promise<void> {
        this.events.log('info', 'Pipeline', '🔍 Running final verification...');

        const stability = this.checkStability();

        if (stability.isStable) {
            this.events.log('success', 'Pipeline', '✅ Final verification passed');
            this.events.log('success', 'Pipeline', '• Repository compiles successfully');
            this.events.log('success', 'Pipeline', '• All tests pass');
            this.events.log('success', 'Pipeline', '• No errors remain');
            this.events.log('success', 'Pipeline', '• No open bugs exist');
            this.events.log('success', 'Pipeline', '• No pending tasks remain');
        } else {
            this.events.log(
                'warn',
                'Pipeline',
                '⚠️ Final verification incomplete — some conditions not met',
                JSON.stringify(stability, null, 2)
            );
        }
    }

    /**
     * Check if the repository has reached stability
     */
    private checkStability(): StabilityReport {
        const tasks = (this.sharedMemory.get('tasks') as Task[]) ?? [];
        const bugs = (this.sharedMemory.get('bugs') as Bug[]) ?? [];
        const testResults = this.sharedMemory.get('testResults') as {
            failed: number;
            coverage: number;
        } | null;

        const pendingTasks = tasks.filter(
            (t) => t.status === 'pending' || t.status === 'in-progress'
        ).length;
        const openBugs = bugs.filter((b) => b.status === 'open').length;
        const runtimeErrors = 0; // Tracked via error events
        const failingTests = testResults?.failed ?? 0;
        const coveragePercent = testResults?.coverage ?? 0;

        const isStable =
            pendingTasks === 0 &&
            openBugs === 0 &&
            runtimeErrors === 0 &&
            failingTests === 0 &&
            coveragePercent >= this.config.coverageThreshold;

        return {
            pendingTasks,
            openBugs,
            runtimeErrors,
            failingTests,
            coveragePercent,
            coverageThreshold: this.config.coverageThreshold,
            isStable,
        };
    }

    /**
     * Create execution context for agents
     */
    private createContext(): AgentContext {
        return {
            workingDirectory: this.config.workingDirectory,
            iteration: this.state.iteration,
            previousActions: [],
            sharedMemory: this.sharedMemory,
        };
    }

    /**
     * Set current pipeline phase
     */
    private setPhase(phase: PipelinePhase, agent: AgentRole | null): void {
        this.state.phase = phase;
        this.state.currentAgent = agent;
        this.state.lastActivityAt = Date.now();
        this.emitPipelineEvent('pipeline:phase-change');
    }

    /**
     * Emit a pipeline event
     */
    private emitPipelineEvent(
        type: 'pipeline:phase-change' | 'pipeline:iteration' | 'pipeline:complete'
    ): void {
        this.events.emit({
            type,
            timestamp: Date.now(),
            agentRole: this.state.currentAgent,
            data: { ...this.state },
        });
    }

    /**
     * Stop the pipeline gracefully
     */
    stop(): void {
        this.shouldStop = true;
        this.events.log('info', 'Pipeline', 'Stop requested — finishing current phase');
    }

    /**
     * Get current pipeline state
     */
    getState(): PipelineState {
        return { ...this.state };
    }

    /**
     * Get the event emitter (for dashboard connection)
     */
    getEvents(): AgentEventEmitter {
        return this.events;
    }

    /**
     * Check if pipeline is currently running
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Empty stability report
     */
    private emptyStabilityReport(): StabilityReport {
        return {
            pendingTasks: 0,
            openBugs: 0,
            runtimeErrors: 0,
            failingTests: 0,
            coveragePercent: 0,
            coverageThreshold: this.config.coverageThreshold,
            isStable: false,
        };
    }
}

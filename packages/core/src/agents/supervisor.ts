// ============================================================================
// Monnu Clow — Supervisor Agent
// Oversees and orchestrates other agents in the system
// ============================================================================

import { BaseAgent, AgentContext } from './base-agent.js';
import { AgentAction, Task, AgentRole, AgentStatus, PipelinePhase } from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { BaseLLMProvider } from '../llm/provider.js';
import { AGENT_SYSTEM_PROMPTS, buildSupervisorPrompt } from '../llm/prompts.js';

interface LLMSupervisorResult {
    assessment: {
        status: 'healthy' | 'degraded' | 'critical';
        overallProgress: number;
        stabilityScore: number;
        summary: string;
    };
    decisions: Array<{
        action: 'assign' | 'reassign' | 'block' | 'unblock' | 'retry';
        targetTaskId: string;
        assignedAgent: AgentRole;
        reason: string;
    }>;
    nextPhase: PipelinePhase;
    alerts: string[];
}

export class SupervisorAgent extends BaseAgent {
    constructor(events: AgentEventEmitter, llm?: BaseLLMProvider) {
        super(
            {
                role: 'supervisor',
                name: 'Supervisor Agent',
                description: 'Oversees and orchestrates specialized agents',
                maxRetries: 3,
                timeoutMs: 90000,
            },
            events,
            llm
        );
    }

    protected async performWork(context: AgentContext): Promise<AgentAction[]> {
        const actions: AgentAction[] = [];

        // Step 1: Gather current system state
        const gatherAction = this.createAction(
            'gather-state',
            'Gathering system state, tasks, and agent statuses',
            'pending'
        );
        actions.push(gatherAction);

        const tasks = (context.sharedMemory.get('tasks') as Task[]) ?? [];
        const agentStatuses = context.sharedMemory.get('agentStatuses') as Map<AgentRole, AgentStatus>;
        const pipelineState = context.sharedMemory.get('pipelineState');
        const eventHistory = this.events.getHistory().slice(-20);

        this.completeAction(gatherAction, 'success');

        // Step 2: Analyze and Orchestrate (LLM-powered)
        if (this.hasLLM()) {
            const orchestrateAction = this.createAction(
                'ai-orchestration',
                `Using AI to analyze work stream and make orchestration decisions`,
                'pending'
            );
            actions.push(orchestrateAction);

            this.log('🤖 Supervisor analyzing system health and task stream...');

            try {
                const prompt = buildSupervisorPrompt(
                    JSON.stringify(pipelineState ?? { phase: 'unknown' }, null, 2),
                    JSON.stringify(tasks, null, 2).slice(0, 10000), // Limit task context
                    JSON.stringify(agentStatuses instanceof Map ? Object.fromEntries(agentStatuses) : agentStatuses ?? {}, null, 2),
                    JSON.stringify(eventHistory, null, 2).slice(0, 5000)
                );

                const response = await this.llmChat(AGENT_SYSTEM_PROMPTS.supervisor, prompt);
                const result = this.parseLLMJson<LLMSupervisorResult>(response);

                if (result) {
                    await this.executeDecisions(result, tasks, context);
                    this.logSuccess(
                        `Supervisor Assessment: ${result.assessment.status.toUpperCase()} (${result.assessment.overallProgress}% progress)`
                    );
                    this.completeAction(orchestrateAction, 'success');
                } else {
                    this.logWarn('Supervisor received unparseable response, falling back to passive monitoring');
                    this.completeAction(orchestrateAction, 'failure');
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                this.logWarn(`Supervisor orchestration failed: ${msg}`);
                this.completeAction(orchestrateAction, 'failure');
            }
        } else {
            this.log('Supervisor running in passive mode (no AI configured)');
        }

        return actions;
    }

    private async executeDecisions(
        result: LLMSupervisorResult,
        tasks: Task[],
        context: AgentContext
    ): Promise<void> {
        for (const decision of result.decisions) {
            const task = tasks.find((t) => t.id === decision.targetTaskId);

            if (!task) {
                this.logWarn(`Supervisor tried to act on non-existent task: ${decision.targetTaskId}`);
                continue;
            }

            this.log(`Supervisor Decision: ${decision.action} task ${task.id} to ${decision.assignedAgent} — ${decision.reason}`);

            switch (decision.action) {
                case 'assign':
                case 'reassign':
                    task.assignedAgent = decision.assignedAgent;
                    task.status = 'pending';
                    break;
                case 'block':
                    task.status = 'blocked';
                    break;
                case 'unblock':
                    task.status = 'pending';
                    break;
                case 'retry':
                    task.status = 'pending';
                    // Could increment a retry counter here
                    break;
            }

            task.updatedAt = Date.now();

            // Emit task update event
            this.events.emit({
                type: 'task:updated',
                timestamp: Date.now(),
                agentRole: 'supervisor',
                data: task,
            });
        }

        // Handle alerts
        if (result.alerts.length > 0) {
            for (const alert of result.alerts) {
                this.logWarn(`Supervisor Alert: ${alert}`);
            }
        }
    }
}

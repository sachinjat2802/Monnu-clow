// ============================================================================
// Monnu Clow — Base Agent
// Abstract foundation for all specialized agents
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import {
    AgentRole,
    AgentStatus,
    AgentAction,
    AgentActionEvent,
} from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { BaseLLMProvider, LLMMessage, LLMResponse } from '../llm/provider.js';

export interface AgentConfig {
    role: AgentRole;
    name: string;
    description: string;
    maxRetries: number;
    timeoutMs: number;
}

export interface AgentContext {
    workingDirectory: string;
    iteration: number;
    previousActions: AgentAction[];
    sharedMemory: Map<string, unknown>;
}

export abstract class BaseAgent {
    readonly role: AgentRole;
    readonly name: string;
    readonly description: string;

    protected status: AgentStatus = 'idle';
    protected events: AgentEventEmitter;
    protected config: AgentConfig;
    protected actionLog: AgentAction[] = [];
    protected llm: BaseLLMProvider | null = null;

    constructor(config: AgentConfig, events: AgentEventEmitter, llm?: BaseLLMProvider) {
        this.role = config.role;
        this.name = config.name;
        this.description = config.description;
        this.config = config;
        this.events = events;
        this.llm = llm ?? null;
    }

    /**
     * Set or update the LLM provider
     */
    setLLM(llm: BaseLLMProvider): void {
        this.llm = llm;
    }

    /**
     * Check if LLM is available
     */
    hasLLM(): boolean {
        return this.llm !== null;
    }

    /**
     * Convenience: run an LLM chat completion
     */
    protected async llmChat(
        systemPrompt: string,
        userPrompt: string
    ): Promise<LLMResponse> {
        if (!this.llm) {
            throw new Error(`${this.name}: No LLM provider configured`);
        }

        const messages: LLMMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];

        return this.llm.chat(messages);
    }

    /**
     * Convenience: parse JSON from LLM response (with error handling)
     */
    protected parseLLMJson<T>(response: LLMResponse): T | null {
        try {
            // Extract JSON from response (handles markdown code blocks)
            let content = response.content.trim();
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                content = jsonMatch[1].trim();
            }
            return JSON.parse(content) as T;
        } catch {
            this.logWarn(`Failed to parse LLM JSON response`);
            return null;
        }
    }

    /**
     * Get current agent status
     */
    getStatus(): AgentStatus {
        return this.status;
    }

    /**
     * Get action history for this agent
     */
    getActionLog(): AgentAction[] {
        return [...this.actionLog];
    }

    /**
     * Execute the agent's main work cycle
     */
    async execute(context: AgentContext): Promise<AgentAction[]> {
        const actions: AgentAction[] = [];

        try {
            this.setStatus('working', `${this.name} starting work...`);

            // Run the agent's specialized logic
            const result = await this.performWork(context);
            actions.push(...result);

            this.setStatus('completed', `${this.name} completed successfully`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.setStatus('failed', `${this.name} failed: ${errorMsg}`);

            // Log the failure
            this.events.log('error', this.name, `Agent failed: ${errorMsg}`, undefined, this.role);

            // Attempt recovery
            const retryActions = await this.handleFailure(error, context);
            actions.push(...retryActions);
        }

        // Store actions in our log
        this.actionLog.push(...actions);

        return actions;
    }

    /**
     * Create and emit an action event
     */
    protected createAction(
        action: string,
        detail: string,
        result: 'success' | 'failure' | 'pending' = 'pending',
        metadata: Record<string, unknown> = {}
    ): AgentAction {
        const agentAction: AgentAction = {
            id: uuidv4(),
            agentRole: this.role,
            action,
            detail,
            timestamp: Date.now(),
            duration: null,
            result,
            metadata,
        };

        // Emit the action event
        const event: AgentActionEvent = {
            type: 'agent:action',
            timestamp: Date.now(),
            agentRole: this.role,
            data: agentAction,
        };
        this.events.emit(event);

        return agentAction;
    }

    /**
     * Update action with completion info
     */
    protected completeAction(
        action: AgentAction,
        result: 'success' | 'failure',
        duration?: number
    ): void {
        action.result = result;
        action.duration = duration ?? Date.now() - action.timestamp;
    }

    /**
     * Set agent status and emit event
     */
    protected setStatus(status: AgentStatus, message: string): void {
        this.status = status;
        this.events.agentStatus(this.role, status, message);
    }

    /**
     * Log an informational message
     */
    protected log(message: string, details?: string): void {
        this.events.log('info', this.name, message, details, this.role);
    }

    /**
     * Log a success message
     */
    protected logSuccess(message: string, details?: string): void {
        this.events.log('success', this.name, message, details, this.role);
    }

    /**
     * Log a warning message
     */
    protected logWarn(message: string, details?: string): void {
        this.events.log('warn', this.name, message, details, this.role);
    }

    // --- Abstract Methods (implemented by each specialized agent) ---

    /**
     * Core work logic — must be implemented by each agent
     */
    protected abstract performWork(context: AgentContext): Promise<AgentAction[]>;

    /**
     * Handle failures — agents can implement custom recovery logic
     */
    protected async handleFailure(
        _error: unknown,
        _context: AgentContext
    ): Promise<AgentAction[]> {
        // Default: no recovery, subclasses can override
        return [];
    }

    /**
     * Reset agent to idle state
     */
    reset(): void {
        this.status = 'idle';
        this.setStatus('idle', `${this.name} reset to idle`);
    }
}

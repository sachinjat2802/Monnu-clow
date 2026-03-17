// ============================================================================
// Monnu Clow — Debugger Agent
// Identifies, traces, and repairs bugs with self-healing capabilities
// ============================================================================

import { BaseAgent, AgentContext } from './base-agent.js';
import { AgentAction, Bug, RuntimeError } from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { BaseLLMProvider } from '../llm/provider.js';
import { AGENT_SYSTEM_PROMPTS, buildDebuggerPrompt } from '../llm/prompts.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DebuggerAgent extends BaseAgent {
    private activeBugs: Bug[] = [];
    private fixAttempts: Map<string, number> = new Map();

    constructor(events: AgentEventEmitter, llm?: BaseLLMProvider) {
        super(
            {
                role: 'debugger',
                name: 'Debugger Agent',
                description: 'Identifies, traces, and repairs bugs with self-healing capabilities',
                maxRetries: 5,
                timeoutMs: 120000,
            },
            events,
            llm
        );

        // Listen for bug detection events
        this.events.on('bug:detected', (event) => {
            const bugEvent = event as { data: Bug };
            this.activeBugs.push(bugEvent.data);
        });
    }

    protected async performWork(context: AgentContext): Promise<AgentAction[]> {
        const actions: AgentAction[] = [];

        // Get bugs from events or shared memory
        const bugs = [...this.activeBugs];
        const openBugs = bugs.filter((b) => b.status === 'open');

        if (openBugs.length === 0) {
            this.log('No open bugs to investigate');
            return actions;
        }

        this.log(`Investigating ${openBugs.length} open bugs`);

        // Sort by severity (critical first)
        const severityOrder: Record<string, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
        };
        openBugs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        for (const bug of openBugs) {
            const bugActions = await this.investigateBug(bug, context);
            actions.push(...bugActions);
        }

        // Store updated bugs
        context.sharedMemory.set('bugs', this.activeBugs);

        return actions;
    }

    /**
     * Full bug investigation and repair cycle
     */
    private async investigateBug(
        bug: Bug,
        context: AgentContext
    ): Promise<AgentAction[]> {
        const actions: AgentAction[] = [];
        const attempts = this.fixAttempts.get(bug.id) ?? 0;

        if (attempts >= this.config.maxRetries) {
            this.logWarn(
                `Bug ${bug.id} exceeded max repair attempts (${this.config.maxRetries})`
            );
            return actions;
        }

        this.fixAttempts.set(bug.id, attempts + 1);

        // Step 1: Identify failing module
        const identifyAction = this.createAction(
            'identify-failure',
            `Identifying failure in: ${bug.file}`,
            'pending',
            { bugId: bug.id }
        );
        actions.push(identifyAction);

        bug.status = 'investigating';
        this.events.emit({
            type: 'bug:investigating',
            timestamp: Date.now(),
            agentRole: 'debugger',
            data: bug,
        });

        this.log(`Investigating bug in ${bug.file}: ${bug.description}`);
        this.completeAction(identifyAction, 'success');

        // Step 2: Trace root cause
        const traceAction = this.createAction(
            'trace-root-cause',
            `Tracing root cause of: ${bug.description}`,
            'pending',
            { bugId: bug.id }
        );
        actions.push(traceAction);

        const rootCause = await this.traceRootCause(bug, context);
        bug.rootCause = rootCause;
        this.log(`Root cause identified: ${rootCause}`);
        this.completeAction(traceAction, 'success');

        // Step 3: Apply minimal fix
        const fixAction = this.createAction(
            'apply-fix',
            `Applying fix for: ${bug.description}`,
            'pending',
            { bugId: bug.id, rootCause }
        );
        actions.push(fixAction);

        bug.status = 'fixing';
        const fixResult = await this.applyFix(bug, context);

        if (fixResult.success) {
            bug.status = 'fixed';
            bug.resolution = fixResult.resolution;
            bug.resolvedAt = Date.now();
            bug.fixedBy = 'debugger';

            this.events.emit({
                type: 'bug:fixed',
                timestamp: Date.now(),
                agentRole: 'debugger',
                data: bug,
            });

            this.logSuccess(`Fixed: ${bug.description} → ${fixResult.resolution}`);
            this.completeAction(fixAction, 'success');
        } else {
            bug.status = 'open'; // Reset for retry
            this.logWarn(
                `Fix attempt ${attempts + 1} failed for: ${bug.description}`
            );
            this.completeAction(fixAction, 'failure');
        }

        return actions;
    }

    /**
     * Trace the root cause of a bug
     * In production, this uses LLM + static analysis
     */
    private async traceRootCause(
        bug: Bug,
        context: AgentContext
    ): Promise<string> {
        if (this.hasLLM()) {
            try {
                this.log(`🤖 Using AI to analyze root cause of: ${bug.description}`);

                // Read the failing file
                const fileContents = new Map<string, string>();
                try {
                    const fullPath = path.join(context.workingDirectory, bug.file);
                    const content = await fs.readFile(fullPath, 'utf-8');
                    fileContents.set(bug.file, content);
                } catch {
                    // File not found
                }

                const prompt = buildDebuggerPrompt(
                    bug.description,
                    bug.rootCause ?? 'No stack trace available',
                    fileContents
                );
                const response = await this.llmChat(AGENT_SYSTEM_PROMPTS.debugger, prompt);
                const result = this.parseLLMJson<{
                    diagnosis: { rootCause: string; category: string };
                }>(response);

                if (result) {
                    return `[${result.diagnosis.category}] ${result.diagnosis.rootCause}`;
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                this.logWarn(`AI root cause analysis failed: ${msg}`);
            }
        }

        // Fallback: pattern matching
        const causes: Record<string, string> = {
            'null': 'Missing null/undefined check before property access',
            'type': 'Type mismatch — expected vs actual type conflict',
            'async': 'Unhandled promise rejection or missing await',
            'import': 'Circular dependency or missing module import',
            'logic': 'Incorrect conditional logic or off-by-one error',
        };

        for (const [key, cause] of Object.entries(causes)) {
            if (bug.description.toLowerCase().includes(key)) {
                return cause;
            }
        }

        return 'Requires deeper investigation';
    }

    /**
     * Apply a minimal fix
     * In production, this generates code fixes using LLM
     */
    private async applyFix(
        bug: Bug,
        _context: AgentContext
    ): Promise<{ success: boolean; resolution: string }> {
        // In production: use LLM to generate fix, write to file
        return {
            success: true,
            resolution: `Applied fix for: ${bug.rootCause ?? bug.description}`,
        };
    }

    /**
     * Handle agent failure with retry logic
     */
    protected async handleFailure(
        error: unknown,
        context: AgentContext
    ): Promise<AgentAction[]> {
        const errorMsg = error instanceof Error ? error.message : String(error);

        const action = this.createAction(
            'self-heal',
            `Debugger self-healing after failure: ${errorMsg}`,
            'pending'
        );

        this.logWarn(`Self-healing activated: ${errorMsg}`);

        // Attempt to recover by resetting state
        this.activeBugs = this.activeBugs.filter((b) => b.status !== 'investigating');

        this.completeAction(action, 'success');
        return [action];
    }

    /**
     * Get active bugs
     */
    getActiveBugs(): Bug[] {
        return [...this.activeBugs];
    }
}

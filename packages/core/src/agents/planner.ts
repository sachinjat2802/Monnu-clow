// ============================================================================
// Monnu Clow — Planner Agent (LLM-Enhanced)
// Analyzes repository and generates execution plans
// Uses AI when available, falls back to static analysis
// ============================================================================

import { BaseAgent, AgentContext } from './base-agent.js';
import { AgentAction, Task, TaskEvent } from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { BaseLLMProvider } from '../llm/provider.js';
import { AGENT_SYSTEM_PROMPTS, buildPlannerPrompt } from '../llm/prompts.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PlannerAnalysis {
    totalFiles: number;
    missingTests: string[];
    codeSmells: string[];
    suggestedImprovements: string[];
}

interface LLMPlanResult {
    analysis: {
        summary: string;
        totalFiles: number;
        languages: string[];
        codeHealth: number;
    };
    tasks: Array<{
        title: string;
        description: string;
        type: string;
        priority: number;
        assignedAgent: string;
        estimatedComplexity: number;
        targetFiles: string[];
    }>;
    risks: string[];
}

export class PlannerAgent extends BaseAgent {
    private generatedTasks: Task[] = [];

    constructor(events: AgentEventEmitter, llm?: BaseLLMProvider) {
        super(
            {
                role: 'planner',
                name: 'Planner Agent',
                description: 'Analyzes repository structure and generates execution plans',
                maxRetries: 3,
                timeoutMs: 60000,
            },
            events,
            llm
        );
    }

    protected async performWork(context: AgentContext): Promise<AgentAction[]> {
        const actions: AgentAction[] = [];

        // Step 1: Scan repository structure
        const scanAction = this.createAction(
            'scan-repository',
            `Scanning repository at ${context.workingDirectory}`,
            'pending'
        );
        actions.push(scanAction);

        this.log('Scanning repository structure...');
        const { structure, fileContents, analysis } = await this.scanRepository(
            context.workingDirectory
        );
        this.completeAction(scanAction, 'success');

        this.log(
            `Found ${analysis.totalFiles} source files, ${analysis.missingTests.length} without tests`
        );

        // Step 2: Generate plan (LLM-powered or static)
        let tasks: Task[];

        if (this.hasLLM()) {
            // AI-powered planning
            const llmAction = this.createAction(
                'ai-analysis',
                `Using ${this.llm!.getProvider()}/${this.llm!.getModel()} for intelligent analysis`,
                'pending'
            );
            actions.push(llmAction);

            this.log(`🤖 Engaging AI (${this.llm!.getModel()}) for deep analysis...`);

            try {
                const prompt = buildPlannerPrompt(structure, fileContents);
                const response = await this.llmChat(AGENT_SYSTEM_PROMPTS.planner, prompt);
                const parsed = this.parseLLMJson<LLMPlanResult>(response);

                if (parsed) {
                    tasks = this.convertLLMTasks(parsed);
                    this.logSuccess(
                        `AI analysis complete: health score ${parsed.analysis.codeHealth}/10, ${tasks.length} tasks generated`
                    );

                    if (parsed.risks.length > 0) {
                        this.logWarn(`Risks identified: ${parsed.risks.join(', ')}`);
                    }
                } else {
                    this.logWarn('AI response was unparseable, falling back to static analysis');
                    tasks = this.generateStaticTasks(analysis);
                }

                this.completeAction(llmAction, 'success');
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                this.logWarn(`AI analysis failed: ${msg} — falling back to static analysis`);
                tasks = this.generateStaticTasks(analysis);
                this.completeAction(llmAction, 'failure');
            }
        } else {
            // Static analysis (no AI)
            const staticAction = this.createAction(
                'static-analysis',
                'Generating plan from static analysis (no AI configured)',
                'pending'
            );
            actions.push(staticAction);

            tasks = this.generateStaticTasks(analysis);
            this.completeAction(staticAction, 'success');
        }

        this.generatedTasks = tasks;

        // Step 3: Emit task events
        const emitAction = this.createAction(
            'emit-tasks',
            `Publishing ${tasks.length} tasks to the pipeline`,
            'pending'
        );
        actions.push(emitAction);

        for (const task of tasks) {
            const taskEvent: TaskEvent = {
                type: 'task:created',
                timestamp: Date.now(),
                agentRole: 'planner',
                data: task,
            };
            this.events.emit(taskEvent);
        }

        this.logSuccess(`Generated ${tasks.length} tasks for execution`);
        this.completeAction(emitAction, 'success');

        return actions;
    }

    /**
     * Scan repository: get structure, read key files, run basic analysis
     */
    private async scanRepository(
        workingDir: string
    ): Promise<{
        structure: string;
        fileContents: Map<string, string>;
        analysis: PlannerAnalysis;
    }> {
        const analysis: PlannerAnalysis = {
            totalFiles: 0,
            missingTests: [],
            codeSmells: [],
            suggestedImprovements: [],
        };

        let structure = '';
        const fileContents = new Map<string, string>();

        try {
            const { glob } = await import('glob');

            // Get all source files
            const sourceFiles = await glob('**/*.{ts,tsx,js,jsx,py,java,go,rs}', {
                cwd: workingDir,
                ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'],
            });

            analysis.totalFiles = sourceFiles.length;
            structure = sourceFiles.map((f) => `  ${f}`).join('\n');

            // Get test files
            const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
                cwd: workingDir,
                ignore: ['**/node_modules/**', '**/dist/**'],
            });

            const testedBases = new Set(
                testFiles.map((f) => f.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, ''))
            );

            for (const src of sourceFiles) {
                const base = src.replace(/\.(ts|tsx|js|jsx|py|java|go|rs)$/, '');
                if (!testedBases.has(base)) {
                    analysis.missingTests.push(src);
                }
            }

            // Read key files (up to 10, first 3000 chars each) for LLM context
            for (const file of sourceFiles.slice(0, 10)) {
                try {
                    const fullPath = path.join(workingDir, file);
                    const content = await fs.readFile(fullPath, 'utf-8');
                    fileContents.set(file, content.slice(0, 3000));
                } catch {
                    // Skip unreadable files
                }
            }
        } catch {
            this.logWarn('Repository scan encountered issues, using limited analysis');
        }

        return { structure, fileContents, analysis };
    }

    /**
     * Convert LLM-generated tasks to our Task format
     */
    private convertLLMTasks(result: LLMPlanResult): Task[] {
        const now = Date.now();

        return result.tasks.map((t) => ({
            id: uuidv4(),
            title: t.title,
            description: t.description,
            status: 'pending' as const,
            assignedAgent: (t.assignedAgent === 'coder' ||
                t.assignedAgent === 'tester' ||
                t.assignedAgent === 'debugger' ||
                t.assignedAgent === 'reviewer'
                ? t.assignedAgent
                : 'coder') as Task['assignedAgent'],
            priority: t.priority ?? 3,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            parentTaskId: null,
            subtasks: [],
            tags: [t.type],
            estimatedComplexity: t.estimatedComplexity ?? 5,
        }));
    }

    /**
     * Generate tasks from static analysis (fallback when no LLM)
     */
    private generateStaticTasks(analysis: PlannerAnalysis): Task[] {
        const tasks: Task[] = [];
        const now = Date.now();

        // Tasks for missing tests
        for (const file of analysis.missingTests.slice(0, 10)) {
            tasks.push({
                id: uuidv4(),
                title: `Generate tests for ${file}`,
                description: `Create unit tests for ${file} to improve code coverage`,
                status: 'pending',
                assignedAgent: 'tester',
                priority: 2,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
                parentTaskId: null,
                subtasks: [],
                tags: ['testing', 'coverage'],
                estimatedComplexity: 4,
            });
        }

        // Quality review task
        tasks.push({
            id: uuidv4(),
            title: 'Full code quality review',
            description: 'Review entire codebase for quality, architecture, and best practices',
            status: 'pending',
            assignedAgent: 'reviewer',
            priority: 4,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            parentTaskId: null,
            subtasks: [],
            tags: ['review', 'quality'],
            estimatedComplexity: 6,
        });

        return tasks;
    }

    /**
     * Get tasks generated by this planner
     */
    getGeneratedTasks(): Task[] {
        return [...this.generatedTasks];
    }
}

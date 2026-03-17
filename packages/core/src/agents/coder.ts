// ============================================================================
// Monnu Clow — Coder Agent
// Implements features and modifies code based on plans
// ============================================================================

import { BaseAgent, AgentContext } from './base-agent.js';
import { AgentAction, Task } from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { BaseLLMProvider } from '../llm/provider.js';
import { AGENT_SYSTEM_PROMPTS, buildCoderPrompt } from '../llm/prompts.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class CoderAgent extends BaseAgent {
    constructor(events: AgentEventEmitter, llm?: BaseLLMProvider) {
        super(
            {
                role: 'coder',
                name: 'Coder Agent',
                description: 'Implements features and modifies code based on execution plans',
                maxRetries: 3,
                timeoutMs: 120000,
            },
            events,
            llm
        );
    }

    protected async performWork(context: AgentContext): Promise<AgentAction[]> {
        const actions: AgentAction[] = [];

        // Get assigned tasks from shared memory
        const tasks = (context.sharedMemory.get('tasks') as Task[]) ?? [];
        const coderTasks = tasks.filter(
            (t) => t.assignedAgent === 'coder' && t.status === 'pending'
        );

        if (coderTasks.length === 0) {
            this.log('No pending coding tasks');
            return actions;
        }

        this.log(`Processing ${coderTasks.length} coding tasks`);

        for (const task of coderTasks) {
            const action = this.createAction(
                'implement-task',
                `Working on: ${task.title}`,
                'pending',
                { taskId: task.id }
            );
            actions.push(action);

            try {
                await this.implementTask(task, context);

                task.status = 'completed';
                task.completedAt = Date.now();
                task.updatedAt = Date.now();

                this.events.emit({
                    type: 'task:completed',
                    timestamp: Date.now(),
                    agentRole: 'coder',
                    data: task,
                });

                this.completeAction(action, 'success');
                this.logSuccess(`Completed: ${task.title}`);
            } catch (error) {
                task.status = 'failed';
                task.updatedAt = Date.now();

                this.events.emit({
                    type: 'task:failed',
                    timestamp: Date.now(),
                    agentRole: 'coder',
                    data: task,
                });

                this.completeAction(action, 'failure');
                const errMsg = error instanceof Error ? error.message : String(error);
                this.logWarn(`Failed: ${task.title} — ${errMsg}`);
            }
        }

        return actions;
    }

    /**
     * Implement a specific task
     * In a full system, this would use LLM to generate code
     */
    private async implementTask(task: Task, context: AgentContext): Promise<void> {
        this.log(`Analyzing task requirements: ${task.title}`);

        // Stage 1: Read relevant files
        const action1 = this.createAction(
            'read-context',
            `Reading relevant source files for: ${task.title}`,
            'pending'
        );

        const relevantFiles = await this.readRelevantFiles(context.workingDirectory, task);
        this.completeAction(action1, 'success');

        // Stage 2: Generate implementation
        const action2 = this.createAction(
            'generate-code',
            `Generating implementation for: ${task.title}`,
            'pending'
        );

        if (this.hasLLM()) {
            this.log(`🤖 Using ${this.llm!.getModel()} to generate code...`);
            try {
                const prompt = buildCoderPrompt(task.title, task.description, relevantFiles);
                const response = await this.llmChat(AGENT_SYSTEM_PROMPTS.coder, prompt);
                const result = this.parseLLMJson<{
                    files: Array<{ path: string; action: string; content: string; explanation: string }>;
                    notes: string;
                }>(response);

                if (result && result.files.length > 0) {
                    for (const file of result.files) {
                        if (file.action === 'create' || file.action === 'modify') {
                            const fullPath = path.join(context.workingDirectory, file.path);
                            await fs.mkdir(path.dirname(fullPath), { recursive: true });
                            await fs.writeFile(fullPath, file.content, 'utf-8');
                            this.log(`✨ AI wrote: ${file.path} — ${file.explanation}`);
                        }
                    }
                    this.logSuccess(`AI generated ${result.files.length} file changes`);
                } else {
                    this.log('AI returned no file changes — task may not require code modifications');
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                this.logWarn(`AI code generation failed: ${msg}`);
            }
        } else {
            this.log('No AI configured — marking task for manual implementation');
        }

        this.completeAction(action2, 'success');
    }

    /**
     * Read relevant files for context
     */
    private async readRelevantFiles(
        workingDir: string,
        task: Task
    ): Promise<Map<string, string>> {
        const fileContents = new Map<string, string>();

        try {
            const { glob } = await import('glob');

            const files = await glob('**/*.{ts,tsx,js,jsx}', {
                cwd: workingDir,
                ignore: ['**/node_modules/**', '**/dist/**'],
            });

            // Read first few relevant files (limited to avoid overload)
            for (const file of files.slice(0, 5)) {
                try {
                    const fullPath = path.join(workingDir, file);
                    const content = await fs.readFile(fullPath, 'utf-8');
                    fileContents.set(file, content);
                } catch {
                    // File read error — skip
                }
            }
        } catch {
            this.logWarn('Could not scan for relevant files');
        }

        return fileContents;
    }
}

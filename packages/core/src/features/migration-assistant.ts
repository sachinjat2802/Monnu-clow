// ============================================================================
// Monnu Clow — Migration Assistant Feature
// AI-powered code migration using Qwen Coder via NVIDIA
// ============================================================================

import { BaseLLMProvider, LLMMessage } from '../llm/provider.js';
import { AgentEventEmitter } from '../events/emitter.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface MigrationTask {
    file: string;
    fromFramework: string;
    toFramework: string;
    originalContent: string;
    migratedContent: string;
    changes: string[];
    confidence: number;
}

export interface MigrationReport {
    totalFiles: number;
    migratedFiles: number;
    tasks: MigrationTask[];
    summary: string;
}

const MIGRATION_SYSTEM_PROMPT = `You are an expert at migrating codebases between frameworks and languages.

When given source code and a migration target, you MUST:
1. Preserve all business logic exactly
2. Use idiomatic patterns for the target framework
3. Handle breaking API differences
4. Add compatibility shims where needed
5. Update imports and dependencies
6. Preserve type safety

Respond in JSON:
{
  "migratedCode": "... the full migrated file content ...",
  "changes": [
    "Replaced Express Router with Fastify route handlers",
    "Converted middleware to Fastify hooks"
  ],
  "confidence": 0.9,
  "warnings": ["Manual review needed for custom middleware"]
}`;

export class MigrationAssistant {
    private llm: BaseLLMProvider;
    private events: AgentEventEmitter;

    constructor(llm: BaseLLMProvider, events: AgentEventEmitter) {
        this.llm = llm;
        this.events = events;
    }

    /**
     * Migrate files from one framework to another
     */
    async migrate(
        workingDir: string,
        fromFramework: string,
        toFramework: string,
        filePatterns?: string[]
    ): Promise<MigrationReport> {
        this.events.log(
            'info',
            'MigrationAssistant',
            `🔄 Starting migration: ${fromFramework} → ${toFramework}`
        );

        const report: MigrationReport = {
            totalFiles: 0,
            migratedFiles: 0,
            tasks: [],
            summary: '',
        };

        try {
            const { glob } = await import('glob');

            const patterns = filePatterns ?? ['**/*.{ts,tsx,js,jsx}'];
            let files: string[] = [];

            for (const pattern of patterns) {
                const found = await glob(pattern, {
                    cwd: workingDir,
                    ignore: ['**/node_modules/**', '**/dist/**'],
                });
                files.push(...found);
            }

            // Deduplicate
            files = [...new Set(files)];
            report.totalFiles = files.length;

            this.events.log(
                'info',
                'MigrationAssistant',
                `Found ${files.length} files to analyze for migration`
            );

            for (const file of files.slice(0, 20)) {
                try {
                    const fullPath = path.join(workingDir, file);
                    const content = await fs.readFile(fullPath, 'utf-8');

                    if (content.length < 50) continue;

                    // Check if file is relevant to migration
                    if (!this.isRelevantForMigration(content, fromFramework)) continue;

                    this.events.log('info', 'MigrationAssistant', `🔄 Migrating: ${file}`);

                    const messages: LLMMessage[] = [
                        { role: 'system', content: MIGRATION_SYSTEM_PROMPT },
                        {
                            role: 'user',
                            content: `Migrate this file from ${fromFramework} to ${toFramework}.\n\nFile: ${file}\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``,
                        },
                    ];

                    const response = await this.llm.chat(messages);
                    const parsed = this.parseJson(response.content);

                    if (parsed) {
                        const task: MigrationTask = {
                            file,
                            fromFramework,
                            toFramework,
                            originalContent: content,
                            migratedContent: String((parsed as { migratedCode?: string }).migratedCode ?? content),
                            changes: ((parsed as { changes?: string[] }).changes ?? []).map(String),
                            confidence: Number((parsed as { confidence?: number }).confidence ?? 0.5),
                        };

                        report.tasks.push(task);
                        report.migratedFiles++;

                        // Write migrated file with .migrated suffix (safe, non-destructive)
                        const migratedPath = `${fullPath}.migrated`;
                        await fs.writeFile(migratedPath, task.migratedContent, 'utf-8');

                        this.events.log(
                            'success',
                            'MigrationAssistant',
                            `✨ Migrated: ${file} (${task.changes.length} changes, ${Math.round(task.confidence * 100)}% confidence)`
                        );
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    this.events.log('warn', 'MigrationAssistant', `Migration failed for ${file}: ${msg}`);
                }
            }

            report.summary = `Migration ${fromFramework} → ${toFramework}: ${report.migratedFiles}/${report.totalFiles} files migrated.`;

            this.events.log(
                'success',
                'MigrationAssistant',
                `🔄 ${report.summary}`
            );
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.events.log('error', 'MigrationAssistant', `Migration failed: ${msg}`);
        }

        return report;
    }

    /**
     * Check if file content is relevant to the source framework
     */
    private isRelevantForMigration(content: string, fromFramework: string): boolean {
        const frameworkIndicators: Record<string, string[]> = {
            express: ['express()', 'app.get(', 'app.post(', 'app.use(', 'req, res', 'Router()'],
            react: ['React.', 'useState', 'useEffect', 'jsx', 'tsx', 'className'],
            vue: ['defineComponent', 'ref(', 'computed(', '<template>', 'v-if', 'v-for'],
            angular: ['@Component', '@NgModule', '@Injectable', 'ngOnInit'],
            jquery: ['$(', 'jQuery', '.ajax(', '.on(', '.click('],
            javascript: ['var ', 'function ', 'require(', 'module.exports'],
            python: ['def ', 'class ', 'import ', 'from ', 'self.'],
        };

        const indicators = frameworkIndicators[fromFramework.toLowerCase()] ?? [];
        return indicators.some((ind) => content.includes(ind));
    }

    private parseJson(content: string): Record<string, unknown> | null {
        try {
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }
}

// ============================================================================
// Monnu Clow — Reviewer Agent
// Validates code quality, enforces standards, and suggests improvements
// ============================================================================

import { BaseAgent, AgentContext } from './base-agent.js';
import { AgentAction, Bug } from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { BaseLLMProvider } from '../llm/provider.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ReviewFinding {
    file: string;
    line: number;
    rule: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
}

interface ReviewReport {
    findings: ReviewFinding[];
    score: number; // 0-100
    summary: string;
    passesQuality: boolean;
}

export class ReviewerAgent extends BaseAgent {
    private lastReport: ReviewReport | null = null;

    constructor(events: AgentEventEmitter, llm?: BaseLLMProvider) {
        super(
            {
                role: 'reviewer',
                name: 'Reviewer Agent',
                description: 'Validates code quality, enforces standards, and suggests improvements',
                maxRetries: 2,
                timeoutMs: 90000,
            },
            events,
            llm
        );
    }

    protected async performWork(context: AgentContext): Promise<AgentAction[]> {
        const actions: AgentAction[] = [];

        // Step 1: Scan all source files
        const scanAction = this.createAction(
            'scan-quality',
            'Scanning codebase for quality issues',
            'pending'
        );
        actions.push(scanAction);

        const files = await this.getSourceFiles(context.workingDirectory);
        this.log(`Reviewing ${files.length} source files`);
        this.completeAction(scanAction, 'success');

        // Step 2: Run quality checks
        const reviewAction = this.createAction(
            'run-review',
            'Analyzing code quality, architecture, and standards',
            'pending'
        );
        actions.push(reviewAction);

        const findings: ReviewFinding[] = [];

        for (const file of files) {
            const fileFindings = await this.reviewFile(file, context.workingDirectory);
            findings.push(...fileFindings);
        }

        this.completeAction(reviewAction, 'success');

        // Step 3: Generate report
        const reportAction = this.createAction(
            'generate-report',
            `Found ${findings.length} quality issues across ${files.length} files`,
            'pending'
        );
        actions.push(reportAction);

        const report = this.generateReport(findings);
        this.lastReport = report;

        // Store report in shared memory
        context.sharedMemory.set('reviewReport', report);

        // Report critical findings as bugs
        const criticalFindings = findings.filter((f) => f.severity === 'error');
        for (const finding of criticalFindings) {
            const bug: Bug = {
                id: uuidv4(),
                file: finding.file,
                line: finding.line,
                description: `Code quality: ${finding.message}`,
                rootCause: finding.rule,
                severity: 'medium',
                status: 'open',
                resolution: finding.suggestion ?? null,
                detectedAt: Date.now(),
                resolvedAt: null,
                detectedBy: 'reviewer',
                fixedBy: null,
                relatedTests: [],
                recurrenceCount: 0,
            };

            this.events.emit({
                type: 'bug:detected',
                timestamp: Date.now(),
                agentRole: 'reviewer',
                data: bug,
            });
        }

        this.log(
            `Review complete — Score: ${report.score}/100, ${findings.length} issues found`
        );

        if (report.passesQuality) {
            this.logSuccess('Code quality standards met ✓');
        } else {
            this.logWarn('Code quality below standards — improvements needed');
        }

        this.completeAction(reportAction, report.passesQuality ? 'success' : 'failure');

        return actions;
    }

    /**
     * Get all source files to review
     */
    private async getSourceFiles(workingDir: string): Promise<string[]> {
        try {
            const { glob } = await import('glob');

            return await glob('**/*.{ts,tsx,js,jsx}', {
                cwd: workingDir,
                ignore: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/*.test.*',
                    '**/*.spec.*',
                ],
            });
        } catch {
            return [];
        }
    }

    /**
     * Review a single file for quality issues
     */
    private async reviewFile(
        filePath: string,
        workingDir: string
    ): Promise<ReviewFinding[]> {
        const findings: ReviewFinding[] = [];

        try {
            const fullPath = path.join(workingDir, filePath);
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            // Rule 1: No dead code (commented-out blocks)
            lines.forEach((line, i) => {
                if (line.trim().startsWith('//') && line.includes('TODO')) {
                    findings.push({
                        file: filePath,
                        line: i + 1,
                        rule: 'no-todo-comments',
                        severity: 'info',
                        message: 'TODO comment found — should be tracked as a task',
                        suggestion: 'Convert to a tracked task in the system',
                    });
                }
            });

            // Rule 2: No unused imports (basic check)
            const importLines = lines.filter((l) => l.trim().startsWith('import'));
            for (const importLine of importLines) {
                const match = importLine.match(/import\s+\{([^}]+)\}/);
                if (match) {
                    const imports = match[1].split(',').map((s) => s.trim());
                    for (const imp of imports) {
                        const cleanName = imp.split(' as ').pop()?.trim() ?? imp.trim();
                        // Check if the imported name appears anywhere else in the file
                        const restOfFile = lines
                            .filter((l) => !l.trim().startsWith('import'))
                            .join('\n');
                        if (!restOfFile.includes(cleanName)) {
                            findings.push({
                                file: filePath,
                                line: lines.indexOf(importLine) + 1,
                                rule: 'no-unused-imports',
                                severity: 'warning',
                                message: `Potentially unused import: ${cleanName}`,
                                suggestion: `Remove unused import '${cleanName}'`,
                            });
                        }
                    }
                }
            }

            // Rule 3: No duplicate logic (basic check for repeated blocks)
            const functionBodies: string[] = [];
            let currentFunction = '';
            let inFunction = false;
            let braceDepth = 0;

            for (const line of lines) {
                if (line.includes('function') || line.includes('=>')) {
                    inFunction = true;
                    currentFunction = '';
                    braceDepth = 0;
                }
                if (inFunction) {
                    currentFunction += line + '\n';
                    braceDepth += (line.match(/\{/g) || []).length;
                    braceDepth -= (line.match(/\}/g) || []).length;
                    if (braceDepth <= 0 && currentFunction.length > 50) {
                        if (functionBodies.includes(currentFunction)) {
                            findings.push({
                                file: filePath,
                                line: lines.indexOf(line) + 1,
                                rule: 'no-duplicated-logic',
                                severity: 'warning',
                                message: 'Duplicated function body detected',
                                suggestion: 'Extract shared logic into a reusable function',
                            });
                        }
                        functionBodies.push(currentFunction);
                        inFunction = false;
                    }
                }
            }

            // Rule 4: File length check
            if (lines.length > 300) {
                findings.push({
                    file: filePath,
                    line: 1,
                    rule: 'max-file-length',
                    severity: 'warning',
                    message: `File has ${lines.length} lines — consider splitting`,
                    suggestion: 'Split into smaller, focused modules',
                });
            }

            // Rule 5: Consistent naming (check for snake_case in TS/JS)
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(
                    /(?:const|let|var|function)\s+([a-z]+_[a-z_]+)/
                );
                if (match) {
                    findings.push({
                        file: filePath,
                        line: i + 1,
                        rule: 'consistent-naming',
                        severity: 'info',
                        message: `snake_case naming '${match[1]}' — prefer camelCase in TypeScript`,
                        suggestion: `Rename '${match[1]}' to camelCase`,
                    });
                }
            }
        } catch {
            // File read error — skip
        }

        return findings;
    }

    /**
     * Generate a quality report from findings
     */
    private generateReport(findings: ReviewFinding[]): ReviewReport {
        const errors = findings.filter((f) => f.severity === 'error').length;
        const warnings = findings.filter((f) => f.severity === 'warning').length;
        const infos = findings.filter((f) => f.severity === 'info').length;

        // Score calculation
        let score = 100;
        score -= errors * 10;
        score -= warnings * 3;
        score -= infos * 1;
        score = Math.max(0, Math.min(100, score));

        const summary = `Quality Review: ${score}/100 — ${errors} errors, ${warnings} warnings, ${infos} info`;

        return {
            findings,
            score,
            summary,
            passesQuality: score >= 70,
        };
    }

    /**
     * Get the last review report
     */
    getLastReport(): ReviewReport | null {
        return this.lastReport;
    }
}

// ============================================================================
// Monnu Clow — Performance Profiler Feature
// AI-powered performance analysis using DeepSeek V3.2 via NVIDIA
// ============================================================================

import { BaseLLMProvider, LLMMessage } from '../llm/provider.js';
import { AgentEventEmitter } from '../events/emitter.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export type OptimizationImpact = 'critical' | 'significant' | 'moderate' | 'minor';

export interface PerformanceIssue {
    file: string;
    line: number | null;
    category: string;
    impact: OptimizationImpact;
    title: string;
    description: string;
    suggestion: string;
    estimatedSpeedup: string;
}

export interface PerformanceReport {
    filesAnalyzed: number;
    issues: PerformanceIssue[];
    totalIssues: number;
    performanceScore: number; // 0-100
    topOptimizations: string[];
    summary: string;
}

const PERF_SYSTEM_PROMPT = `You are an expert performance engineer. Analyze source code for performance bottlenecks and optimization opportunities.

Look for:
1. **Algorithm inefficiency** — O(n²) when O(n) is possible, unnecessary nested loops
2. **Memory issues** — Memory leaks, large allocations, missing cleanup
3. **I/O bottlenecks** — Synchronous I/O, unbatched requests, N+1 queries
4. **Caching opportunities** — Repeated expensive computations, missing memoization
5. **Async optimization** — Sequential awaits that could be parallel, missing concurrency
6. **Bundle/load time** — Large imports, missing code splitting, lazy loading opportunities
7. **Rendering issues** — Unnecessary re-renders, missing virtualization, DOM thrashing

Respond in JSON:
{
  "issues": [
    {
      "line": 15,
      "category": "algorithm",
      "impact": "significant",
      "title": "Quadratic string concatenation in loop",
      "description": "Using += for string building in a loop creates O(n²) time complexity",
      "suggestion": "Use Array.push() and .join() for O(n) string building",
      "estimatedSpeedup": "10-50x for large inputs"
    }
  ],
  "topOptimizations": ["Parallelize API calls", "Add memoization to computeHash"],
  "performanceScore": 65,
  "summary": "Found 4 performance issues. Parallelizing API calls could improve throughput by 3x."
}`;

export class PerformanceProfiler {
    private llm: BaseLLMProvider;
    private events: AgentEventEmitter;

    constructor(llm: BaseLLMProvider, events: AgentEventEmitter) {
        this.llm = llm;
        this.events = events;
    }

    /**
     * Analyze a codebase for performance bottlenecks
     */
    async profile(workingDir: string): Promise<PerformanceReport> {
        this.events.log('info', 'PerfProfiler', '🚀 Starting performance analysis...');

        const report: PerformanceReport = {
            filesAnalyzed: 0,
            issues: [],
            totalIssues: 0,
            performanceScore: 100,
            topOptimizations: [],
            summary: '',
        };

        try {
            const { glob } = await import('glob');

            const files = await glob('**/*.{ts,tsx,js,jsx}', {
                cwd: workingDir,
                ignore: [
                    '**/node_modules/**', '**/dist/**',
                    '**/*.test.*', '**/*.spec.*', '**/*.d.ts',
                ],
            });

            this.events.log('info', 'PerfProfiler', `Analyzing ${files.length} files for performance...`);

            // Analyze files in batches
            for (let i = 0; i < Math.min(files.length, 20); i++) {
                const file = files[i];
                try {
                    const content = await fs.readFile(path.join(workingDir, file), 'utf-8');
                    if (content.length < 100) continue;

                    report.filesAnalyzed++;

                    const messages: LLMMessage[] = [
                        { role: 'system', content: PERF_SYSTEM_PROMPT },
                        {
                            role: 'user',
                            content: `Analyze this file for performance issues:\n\nFile: ${file}\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``,
                        },
                    ];

                    const response = await this.llm.chat(messages);
                    const parsed = this.parseJson(response.content);

                    if (parsed) {
                        const issues = (parsed as { issues?: Array<Record<string, unknown>> }).issues;
                        if (Array.isArray(issues)) {
                            for (const issue of issues) {
                                report.issues.push({
                                    file,
                                    line: (issue.line as number) ?? null,
                                    category: String(issue.category ?? 'general'),
                                    impact: String(issue.impact ?? 'moderate') as OptimizationImpact,
                                    title: String(issue.title ?? 'Performance issue'),
                                    description: String(issue.description ?? ''),
                                    suggestion: String(issue.suggestion ?? ''),
                                    estimatedSpeedup: String(issue.estimatedSpeedup ?? 'Unknown'),
                                });
                            }
                        }

                        const topOpts = (parsed as { topOptimizations?: string[] }).topOptimizations;
                        if (Array.isArray(topOpts)) {
                            report.topOptimizations.push(...topOpts.map(String));
                        }
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    this.events.log('warn', 'PerfProfiler', `Analysis failed for ${file}: ${msg}`);
                }
            }

            report.totalIssues = report.issues.length;
            const criticalCount = report.issues.filter((i) => i.impact === 'critical').length;
            const significantCount = report.issues.filter((i) => i.impact === 'significant').length;

            report.performanceScore = Math.max(
                0,
                100 - (criticalCount * 20) - (significantCount * 10) - (report.totalIssues * 2)
            );

            report.summary = `Analyzed ${report.filesAnalyzed} files. Found ${report.totalIssues} performance issues (${criticalCount} critical, ${significantCount} significant).`;

            this.events.log(
                'success',
                'PerfProfiler',
                `🚀 Performance Score: ${report.performanceScore}/100 — ${report.summary}`
            );
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.events.log('error', 'PerfProfiler', `Performance profiling failed: ${msg}`);
        }

        return report;
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

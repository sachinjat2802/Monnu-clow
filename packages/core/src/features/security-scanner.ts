// ============================================================================
// Monnu Clow — Security Scanner Feature
// AI-powered vulnerability detection using NVIDIA models
// ============================================================================

import { BaseLLMProvider, LLMMessage } from '../llm/provider.js';
import { AgentEventEmitter } from '../events/emitter.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Vulnerability {
    id: string;
    file: string;
    line: number | null;
    category: string;
    severity: VulnerabilitySeverity;
    title: string;
    description: string;
    cweId: string | null;
    fix: string | null;
    confidence: number; // 0-1
}

export interface SecurityReport {
    scannedFiles: number;
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    vulnerabilities: Vulnerability[];
    score: number; // 0-100 (higher = more secure)
    summary: string;
}

const SECURITY_SYSTEM_PROMPT = `You are an expert application security scanner. Analyze source code for vulnerabilities.

For each file, identify:
1. **Injection vulnerabilities** — SQL injection, XSS, command injection, path traversal
2. **Authentication issues** — Hardcoded credentials, weak auth, missing auth checks
3. **Cryptography problems** — Weak algorithms, hardcoded keys, improper random
4. **Data exposure** — Sensitive data leaks, improper logging, PII exposure
5. **Configuration issues** — Debug mode in production, insecure defaults, CORS
6. **Dependency risks** — Known vulnerable patterns

Respond in JSON format:
{
  "vulnerabilities": [
    {
      "line": 42,
      "category": "injection",
      "severity": "high",
      "title": "SQL Injection via string concatenation",
      "description": "User input is directly concatenated into SQL query without parameterization",
      "cweId": "CWE-89",
      "fix": "Use parameterized queries: db.query('SELECT * FROM users WHERE id = ?', [userId])",
      "confidence": 0.95
    }
  ],
  "overallRisk": "medium",
  "summary": "Found 3 vulnerabilities. 1 high-severity SQL injection needs immediate attention."
}`;

export class SecurityScanner {
    private llm: BaseLLMProvider;
    private events: AgentEventEmitter;

    constructor(llm: BaseLLMProvider, events: AgentEventEmitter) {
        this.llm = llm;
        this.events = events;
    }

    /**
     * Scan a directory for security vulnerabilities
     */
    async scan(workingDir: string): Promise<SecurityReport> {
        this.events.log('info', 'SecurityScanner', '🛡️ Starting security scan...');

        const report: SecurityReport = {
            scannedFiles: 0,
            totalVulnerabilities: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
            vulnerabilities: [],
            score: 100,
            summary: '',
        };

        try {
            const { glob } = await import('glob');

            const files = await glob('**/*.{ts,tsx,js,jsx,py,java,go,rs}', {
                cwd: workingDir,
                ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'],
            });

            report.scannedFiles = files.length;
            this.events.log('info', 'SecurityScanner', `Scanning ${files.length} source files...`);

            // Scan files in batches of 3
            for (let i = 0; i < files.length; i += 3) {
                const batch = files.slice(i, i + 3);
                const batchContents: string[] = [];

                for (const file of batch) {
                    try {
                        const content = await fs.readFile(path.join(workingDir, file), 'utf-8');
                        batchContents.push(`=== FILE: ${file} ===\n${content.slice(0, 5000)}\n`);
                    } catch {
                        // Skip unreadable
                    }
                }

                if (batchContents.length === 0) continue;

                try {
                    const messages: LLMMessage[] = [
                        { role: 'system', content: SECURITY_SYSTEM_PROMPT },
                        { role: 'user', content: `Analyze these files for security vulnerabilities:\n\n${batchContents.join('\n')}` },
                    ];

                    const response = await this.llm.chat(messages);
                    const parsed = this.parseJson(response.content);

                    if (parsed?.vulnerabilities) {
                        const vulns = parsed.vulnerabilities as Array<Record<string, unknown>>;
                        for (const vuln of vulns) {
                            const severity = String(vuln.severity ?? 'medium') as VulnerabilitySeverity;
                            const vulnerability: Vulnerability = {
                                id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                file: batch[0], // Approximate file
                                line: (vuln.line as number) ?? null,
                                category: String(vuln.category ?? 'unknown'),
                                severity,
                                title: String(vuln.title ?? 'Security issue'),
                                description: String(vuln.description ?? ''),
                                cweId: vuln.cweId ? String(vuln.cweId) : null,
                                fix: vuln.fix ? String(vuln.fix) : null,
                                confidence: Number(vuln.confidence ?? 0.5),
                            };

                            report.vulnerabilities.push(vulnerability);
                            report[vulnerability.severity]++;
                            report.totalVulnerabilities++;
                        }
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    this.events.log('warn', 'SecurityScanner', `Scan batch failed: ${msg}`);
                }
            }

            // Calculate security score
            report.score = Math.max(0, 100 - (report.critical * 25) - (report.high * 15) - (report.medium * 5) - (report.low * 1));
            report.summary = `Scanned ${report.scannedFiles} files. Found ${report.totalVulnerabilities} vulnerabilities: ${report.critical} critical, ${report.high} high, ${report.medium} medium, ${report.low} low.`;

            this.events.log(
                report.critical > 0 ? 'error' : report.high > 0 ? 'warn' : 'success',
                'SecurityScanner',
                `🛡️ Security Score: ${report.score}/100 — ${report.summary}`
            );
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.events.log('error', 'SecurityScanner', `Security scan failed: ${msg}`);
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

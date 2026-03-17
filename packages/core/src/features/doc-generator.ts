// ============================================================================
// Monnu Clow — Documentation Generator Feature
// AI-powered documentation generation using Gemini / NVIDIA
// ============================================================================

import { BaseLLMProvider, LLMMessage } from '../llm/provider.js';
import { AgentEventEmitter } from '../events/emitter.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DocResult {
    file: string;
    docType: 'jsdoc' | 'readme' | 'api' | 'guide';
    content: string;
    outputPath: string;
}

export interface DocReport {
    filesProcessed: number;
    docsGenerated: number;
    results: DocResult[];
}

const DOC_SYSTEM_PROMPT = `You are an expert technical writer. Generate comprehensive, well-structured documentation.

Rules:
1. Use JSDoc/TSDoc format for code documentation
2. Include parameter descriptions, return types, examples, and throws
3. Keep descriptions clear and actionable
4. Add usage examples for complex functions
5. Note edge cases and gotchas

For README generation, include:
- Purpose and overview
- Installation and setup
- API reference
- Usage examples
- Configuration options

Respond in JSON format:
{
  "docs": [
    {
      "type": "jsdoc",
      "content": "/** documented code */"
    }
  ],
  "readme": "# Module Name\\n\\n...",
  "summary": "Generated docs for 5 exports"
}`;

export class DocumentationGenerator {
    private llm: BaseLLMProvider;
    private events: AgentEventEmitter;

    constructor(llm: BaseLLMProvider, events: AgentEventEmitter) {
        this.llm = llm;
        this.events = events;
    }

    /**
     * Generate documentation for a directory
     */
    async generateDocs(workingDir: string): Promise<DocReport> {
        this.events.log('info', 'DocGenerator', '📝 Generating documentation...');

        const report: DocReport = {
            filesProcessed: 0,
            docsGenerated: 0,
            results: [],
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

            this.events.log('info', 'DocGenerator', `Found ${files.length} files to document`);

            for (const file of files.slice(0, 15)) {
                try {
                    const fullPath = path.join(workingDir, file);
                    const content = await fs.readFile(fullPath, 'utf-8');

                    // Skip tiny files
                    if (content.length < 100) continue;

                    report.filesProcessed++;

                    const messages: LLMMessage[] = [
                        { role: 'system', content: DOC_SYSTEM_PROMPT },
                        {
                            role: 'user',
                            content: `Generate comprehensive JSDoc documentation for this file. Also generate a brief module README.\n\nFile: ${file}\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``,
                        },
                    ];

                    const response = await this.llm.chat(messages);
                    const parsed = this.parseJson(response.content);

                    if (parsed) {
                        // Store generated README
                        if ((parsed as { readme?: string }).readme) {
                            const readmePath = path.join(
                                path.dirname(file),
                                `${path.parse(file).name}.docs.md`
                            );

                            report.results.push({
                                file,
                                docType: 'readme',
                                content: String((parsed as { readme?: string }).readme),
                                outputPath: readmePath,
                            });

                            // Write the doc file
                            const outputFullPath = path.join(workingDir, readmePath);
                            await fs.mkdir(path.dirname(outputFullPath), { recursive: true });
                            await fs.writeFile(outputFullPath, String((parsed as { readme?: string }).readme), 'utf-8');

                            report.docsGenerated++;
                            this.events.log('info', 'DocGenerator', `📄 Generated: ${readmePath}`);
                        }
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    this.events.log('warn', 'DocGenerator', `Doc gen failed for ${file}: ${msg}`);
                }
            }

            this.events.log(
                'success',
                'DocGenerator',
                `📝 Documentation complete: ${report.docsGenerated} docs generated for ${report.filesProcessed} files`
            );
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.events.log('error', 'DocGenerator', `Documentation generation failed: ${msg}`);
        }

        return report;
    }

    /**
     * Generate a project-level README
     */
    async generateProjectReadme(workingDir: string): Promise<string> {
        this.events.log('info', 'DocGenerator', '📖 Generating project README...');

        try {
            const { glob } = await import('glob');

            const files = await glob('**/*.{ts,tsx,js,jsx}', {
                cwd: workingDir,
                ignore: ['**/node_modules/**', '**/dist/**'],
            });

            const structure = files.map((f) => `  ${f}`).join('\n');

            // Read package.json if exists
            let packageInfo = '';
            try {
                const pkg = await fs.readFile(path.join(workingDir, 'package.json'), 'utf-8');
                packageInfo = `\npackage.json:\n\`\`\`json\n${pkg}\n\`\`\`\n`;
            } catch {
                // No package.json
            }

            const messages: LLMMessage[] = [
                { role: 'system', content: 'You are a technical writer. Generate a comprehensive, professional README.md for this project. Include shields/badges, installation steps, architecture overview, API reference, and contributing guidelines. Output only the markdown content.' },
                {
                    role: 'user',
                    content: `Generate a professional README.md for this project.\n\nFile structure:\n${structure}\n${packageInfo}`,
                },
            ];

            const response = await this.llm.chat(messages);
            this.events.log('success', 'DocGenerator', '📖 Project README generated');
            return response.content;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.events.log('error', 'DocGenerator', `README generation failed: ${msg}`);
            return '';
        }
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

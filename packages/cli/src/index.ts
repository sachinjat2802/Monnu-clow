#!/usr/bin/env node
// ============================================================================
// Monnu Clow — CLI Interface
// Beautiful terminal interface for the autonomous agent system
// ============================================================================

import 'dotenv/config';
import {
    PipelineExecutor, AgentEventEmitter, isLLMConfigured, createLLMFromEnv,
    SecurityScanner, DocumentationGenerator, PerformanceProfiler, MigrationAssistant,
} from '@monnu-clow/core';
import type { SystemEvent } from '@monnu-clow/core';

// ─── ANSI Color Helpers ──────────────────────────────────────────────────────

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    gray: '\x1b[90m',
};

const AGENT_COLORS: Record<string, string> = {
    planner: c.magenta,
    coder: c.yellow,
    tester: c.green,
    debugger: c.red,
    reviewer: c.cyan,
};

const AGENT_ICONS: Record<string, string> = {
    planner: '🧠',
    coder: '⚡',
    tester: '🧪',
    debugger: '🔧',
    reviewer: '👁️',
};

const STATUS_ICONS: Record<string, string> = {
    idle: '⬜',
    working: '🔄',
    completed: '✅',
    failed: '❌',
    waiting: '⏳',
};

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] ?? 'run';

    switch (command) {
        case 'run':
            await runPipeline(args.slice(1));
            break;
        case 'scan':
            await runSecurityScan(args.slice(1));
            break;
        case 'docs':
            await runDocGenerator(args.slice(1));
            break;
        case 'perf':
            await runPerfProfiler(args.slice(1));
            break;
        case 'migrate':
            await runMigration(args.slice(1));
            break;
        case 'status':
            showStatus();
            break;
        case 'help':
        case '--help':
        case '-h':
            showHelp();
            break;
        case 'version':
        case '--version':
        case '-v':
            console.log('monnu-clow v0.2.0');
            break;
        default:
            console.error(`${c.red}Unknown command: ${command}${c.reset}`);
            showHelp();
            process.exit(1);
    }
}

// ─── Pipeline Runner ─────────────────────────────────────────────────────────

async function runPipeline(args: string[]) {
    const targetDir = args[0] ?? process.cwd();

    printBanner();

    console.log(`${c.dim}Target:${c.reset} ${targetDir}`);
    console.log(
        `${c.dim}AI:${c.reset}     ${isLLMConfigured()
            ? `${c.green}Configured${c.reset} (${process.env.MONNU_LLM_PROVIDER ?? 'auto-detect'})`
            : `${c.yellow}Not configured${c.reset} — set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY`
        }`
    );
    console.log(`${c.dim}Mode:${c.reset}   Autonomous loop (max 10 iterations)`);
    console.log();

    const events = new AgentEventEmitter();
    const pipeline = new PipelineExecutor(
        {
            workingDirectory: targetDir,
            maxIterations: 10,
            coverageThreshold: 80,
            autoFix: true,
            verbose: true,
        },
        events
    );

    // Subscribe to events for terminal output
    events.onAll((event: SystemEvent) => {
        formatEvent(event);
    });

    console.log(`${c.blue}${c.bold}━━━ Starting Pipeline ━━━${c.reset}`);
    console.log();

    const startTime = Date.now();

    try {
        await pipeline.start();
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`\n${c.red}${c.bold}Pipeline Error:${c.reset} ${msg}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log(`${c.blue}${c.bold}━━━ Pipeline Complete ━━━${c.reset}`);
    console.log(`${c.dim}Duration:${c.reset} ${duration}s`);

    const state = pipeline.getState();
    if (state.isStable) {
        console.log(`${c.green}${c.bold}✅ Repository is STABLE${c.reset}`);
    } else {
        console.log(`${c.yellow}${c.bold}⚠️  Repository is NOT STABLE${c.reset}`);
        console.log(`${c.dim}   Stability report:${c.reset}`);
        const s = state.stability;
        console.log(`   • Pending tasks: ${s.pendingTasks === 0 ? c.green + '0 ✓' : c.red + s.pendingTasks}${c.reset}`);
        console.log(`   • Open bugs:     ${s.openBugs === 0 ? c.green + '0 ✓' : c.red + s.openBugs}${c.reset}`);
        console.log(`   • Failing tests: ${s.failingTests === 0 ? c.green + '0 ✓' : c.red + s.failingTests}${c.reset}`);
        console.log(`   • Coverage:      ${s.coveragePercent >= s.coverageThreshold ? c.green : c.red}${s.coveragePercent}%${c.reset} (threshold: ${s.coverageThreshold}%)`);
    }

    console.log();
}

// ─── Feature Runners ─────────────────────────────────────────────────────────

function requireAI(): void {
    if (!isLLMConfigured()) {
        console.error(`${c.red}${c.bold}Error:${c.reset} This feature requires an AI provider.`);
        console.error(`Set ${c.bold}NVIDIA_API_KEY${c.reset}, ${c.bold}GOOGLE_API_KEY${c.reset}, or another provider key.`);
        process.exit(1);
    }
}

async function runSecurityScan(args: string[]) {
    printBanner();
    requireAI();

    const targetDir = args[0] ?? process.cwd();
    console.log(`${c.bold}🛡️  Security Scanner${c.reset}`);
    console.log(`${c.dim}Target:${c.reset} ${targetDir}`);
    console.log();

    const events = new AgentEventEmitter();
    events.onAll((event: SystemEvent) => formatEvent(event));

    const llm = createLLMFromEnv();
    const scanner = new SecurityScanner(llm, events);
    const report = await scanner.scan(targetDir);

    console.log();
    console.log(`${c.bold}━━━ Security Report ━━━${c.reset}`);
    console.log(`  Score:    ${report.score >= 80 ? c.green : report.score >= 50 ? c.yellow : c.red}${report.score}/100${c.reset}`);
    console.log(`  Files:    ${report.scannedFiles}`);
    console.log(`  Issues:   ${report.totalVulnerabilities} (${c.red}${report.critical}C${c.reset} ${c.yellow}${report.high}H${c.reset} ${c.blue}${report.medium}M${c.reset} ${c.dim}${report.low}L${c.reset})`);
    console.log();
}

async function runDocGenerator(args: string[]) {
    printBanner();
    requireAI();

    const targetDir = args[0] ?? process.cwd();
    console.log(`${c.bold}📝 Documentation Generator${c.reset}`);
    console.log(`${c.dim}Target:${c.reset} ${targetDir}`);
    console.log();

    const events = new AgentEventEmitter();
    events.onAll((event: SystemEvent) => formatEvent(event));

    const llm = createLLMFromEnv();
    const docGen = new DocumentationGenerator(llm, events);
    const report = await docGen.generateDocs(targetDir);

    console.log();
    console.log(`${c.bold}━━━ Documentation Report ━━━${c.reset}`);
    console.log(`  Files processed:  ${report.filesProcessed}`);
    console.log(`  Docs generated:   ${c.green}${report.docsGenerated}${c.reset}`);
    console.log();
}

async function runPerfProfiler(args: string[]) {
    printBanner();
    requireAI();

    const targetDir = args[0] ?? process.cwd();
    console.log(`${c.bold}🚀 Performance Profiler${c.reset}`);
    console.log(`${c.dim}Target:${c.reset} ${targetDir}`);
    console.log();

    const events = new AgentEventEmitter();
    events.onAll((event: SystemEvent) => formatEvent(event));

    const llm = createLLMFromEnv();
    const profiler = new PerformanceProfiler(llm, events);
    const report = await profiler.profile(targetDir);

    console.log();
    console.log(`${c.bold}━━━ Performance Report ━━━${c.reset}`);
    console.log(`  Score:         ${report.performanceScore >= 80 ? c.green : report.performanceScore >= 50 ? c.yellow : c.red}${report.performanceScore}/100${c.reset}`);
    console.log(`  Files:         ${report.filesAnalyzed}`);
    console.log(`  Issues found:  ${report.totalIssues}`);
    if (report.topOptimizations.length > 0) {
        console.log(`  ${c.bold}Top optimizations:${c.reset}`);
        for (const opt of report.topOptimizations.slice(0, 5)) {
            console.log(`    ${c.cyan}→${c.reset} ${opt}`);
        }
    }
    console.log();
}

async function runMigration(args: string[]) {
    printBanner();
    requireAI();

    if (args.length < 2) {
        console.error(`${c.red}Usage: monnu-clow migrate <from-framework> <to-framework> [dir]${c.reset}`);
        console.error(`${c.dim}Example: monnu-clow migrate express fastify ./src${c.reset}`);
        process.exit(1);
    }

    const fromFramework = args[0];
    const toFramework = args[1];
    const targetDir = args[2] ?? process.cwd();

    console.log(`${c.bold}🔄 Migration Assistant${c.reset}`);
    console.log(`${c.dim}From:${c.reset}   ${fromFramework}`);
    console.log(`${c.dim}To:${c.reset}     ${toFramework}`);
    console.log(`${c.dim}Target:${c.reset} ${targetDir}`);
    console.log();

    const events = new AgentEventEmitter();
    events.onAll((event: SystemEvent) => formatEvent(event));

    const llm = createLLMFromEnv();
    const assistant = new MigrationAssistant(llm, events);
    const report = await assistant.migrate(targetDir, fromFramework, toFramework);

    console.log();
    console.log(`${c.bold}━━━ Migration Report ━━━${c.reset}`);
    console.log(`  Total files:    ${report.totalFiles}`);
    console.log(`  Migrated:       ${c.green}${report.migratedFiles}${c.reset}`);
    if (report.tasks.length > 0) {
        console.log(`  ${c.bold}Changes:${c.reset}`);
        for (const task of report.tasks.slice(0, 10)) {
            console.log(`    ${c.cyan}${task.file}${c.reset} (${Math.round(task.confidence * 100)}% confidence)`);
            for (const change of task.changes.slice(0, 3)) {
                console.log(`      ${c.dim}→ ${change}${c.reset}`);
            }
        }
    }
    console.log();
}

// ─── Event Formatter ─────────────────────────────────────────────────────────

function formatEvent(event: SystemEvent) {
    const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const agentColor = event.agentRole ? AGENT_COLORS[event.agentRole] ?? c.white : c.gray;
    const agentIcon = event.agentRole ? AGENT_ICONS[event.agentRole] ?? '●' : '◆';
    const agentLabel = event.agentRole
        ? `${agentColor}${event.agentRole.toUpperCase().padEnd(8)}${c.reset}`
        : `${c.gray}SYSTEM  ${c.reset}`;

    // Handle log events (log:info, log:warn, log:error, log:success)
    if (event.type.startsWith('log:')) {
        const logData = event.data as { message: string; source: string; details?: string };
        const level = event.type.split(':')[1];
        const levelColor =
            level === 'error'
                ? c.red
                : level === 'warn'
                    ? c.yellow
                    : level === 'success'
                        ? c.green
                        : c.white;

        const levelIcon =
            level === 'error'
                ? '✗'
                : level === 'warn'
                    ? '⚠'
                    : level === 'success'
                        ? '✓'
                        : '•';

        console.log(
            `  ${c.dim}${time}${c.reset}  ${agentIcon} ${agentLabel}  ${levelColor}${levelIcon} ${logData.message}${c.reset}`
        );
        return;
    }

    switch (event.type) {
        case 'agent:status': {
            const statusData = event.data as { role: string; status: string; message: string };
            const icon = STATUS_ICONS[statusData.status] ?? '●';
            console.log(
                `  ${c.dim}${time}${c.reset}  ${agentIcon} ${agentLabel}  ${icon} ${c.bold}${statusData.status.toUpperCase()}${c.reset} ${c.dim}${statusData.message}${c.reset}`
            );
            break;
        }

        case 'pipeline:phase-change': {
            const data = event.data as { phase: string };
            console.log(
                `  ${c.dim}${time}${c.reset}  ${c.blue}${c.bold}▸ Phase: ${data.phase.toUpperCase()}${c.reset}`
            );
            break;
        }

        case 'pipeline:iteration': {
            const data = event.data as { iteration: number };
            console.log();
            console.log(
                `  ${c.cyan}${c.bold}═══ Iteration ${data.iteration} ═══${c.reset}`
            );
            break;
        }

        case 'stability:report': {
            const data = event.data as { isStable: boolean; pendingTasks: number; openBugs: number; coveragePercent: number };
            const statusColor = data.isStable ? c.green : c.yellow;
            console.log(
                `  ${c.dim}${time}${c.reset}  ◆ ${c.gray}STABILITY${c.reset} ${statusColor}${data.isStable ? '✅ STABLE' : '⏳ NOT STABLE'
                }${c.reset} ${c.dim}(tasks:${data.pendingTasks} bugs:${data.openBugs} coverage:${data.coveragePercent}%)${c.reset}`
            );
            break;
        }

        case 'task:created': {
            const data = event.data as { title: string };
            console.log(
                `  ${c.dim}${time}${c.reset}  ${agentIcon} ${agentLabel}  ${c.cyan}+ Task:${c.reset} ${data.title}`
            );
            break;
        }

        case 'bug:detected': {
            const data = event.data as { description: string; severity: string };
            console.log(
                `  ${c.dim}${time}${c.reset}  ${agentIcon} ${agentLabel}  ${c.red}🐛 Bug [${data.severity}]:${c.reset} ${data.description}`
            );
            break;
        }

        case 'bug:fixed': {
            const data = event.data as { description: string };
            console.log(
                `  ${c.dim}${time}${c.reset}  ${agentIcon} ${agentLabel}  ${c.green}✓ Fixed:${c.reset} ${data.description}`
            );
            break;
        }

        default:
            // Skip other events to keep output clean
            break;
    }
}

// ─── Banner & Help ───────────────────────────────────────────────────────────

function printBanner() {
    console.log();
    console.log(
        `${c.bold}${c.magenta}  ┌─────────────────────────────────────────┐${c.reset}`
    );
    console.log(
        `${c.bold}${c.magenta}  │                                         │${c.reset}`
    );
    console.log(
        `${c.bold}${c.magenta}  │   ${c.white}🧠 MONNU CLOW${c.magenta}                        │${c.reset}`
    );
    console.log(
        `${c.bold}${c.magenta}  │   ${c.dim}Autonomous AI Agent System${c.magenta}            │${c.reset}`
    );
    console.log(
        `${c.bold}${c.magenta}  │   ${c.dim}v0.1.0${c.magenta}                                │${c.reset}`
    );
    console.log(
        `${c.bold}${c.magenta}  │                                         │${c.reset}`
    );
    console.log(
        `${c.bold}${c.magenta}  └─────────────────────────────────────────┘${c.reset}`
    );
    console.log();
}

function showHelp() {
    printBanner();
    console.log(`${c.bold}Usage:${c.reset} monnu-clow <command> [options]`);
    console.log();
    console.log(`${c.bold}Core Commands:${c.reset}`);
    console.log(`  run [dir]                  Run the autonomous pipeline`);
    console.log(`  status                     Show system status`);
    console.log();
    console.log(`${c.bold}Feature Commands:${c.reset}   ${c.dim}(Require NVIDIA_API_KEY or GOOGLE_API_KEY)${c.reset}`);
    console.log(`  scan [dir]                 🛡️  Security vulnerability scanner`);
    console.log(`  docs [dir]                 📝 Auto-generate documentation`);
    console.log(`  perf [dir]                 🚀 AI performance profiler`);
    console.log(`  migrate <from> <to> [dir]  🔄 Framework migration assistant`);
    console.log();
    console.log(`${c.bold}Environment Variables:${c.reset}`);
    console.log(`  NVIDIA_API_KEY        ${c.green}[Recommended]${c.reset} Enable NVIDIA NIM (8 specialized models)`);
    console.log(`  GOOGLE_API_KEY        Enable Google AI (Gemini 2.0 Flash)`);
    console.log(`  OPENAI_API_KEY        Enable OpenAI (GPT-4o)`);
    console.log(`  ANTHROPIC_API_KEY     Enable Anthropic (Claude)`);
    console.log(`  MONNU_LLM_PROVIDER    Force a specific provider`);
    console.log();
    console.log(`${c.bold}Examples:${c.reset}`);
    console.log(`  monnu-clow run                     # Full pipeline`);
    console.log(`  monnu-clow scan ./my-project       # Security scan`);
    console.log(`  monnu-clow docs .                  # Generate docs`);
    console.log(`  monnu-clow perf ./src              # Performance analysis`);
    console.log(`  monnu-clow migrate express fastify  # Migrate frameworks`);
    console.log();
    console.log(`${c.bold}NVIDIA Models Used:${c.reset}`);
    console.log(`  🧠 Planner:   nemotron-3-super-120b   (complex reasoning)`);
    console.log(`  ⚡ Coder:     qwen3.5-122b             (code generation)`);
    console.log(`  🔧 Debugger:  deepseek-v3.2            (root cause analysis)`);
    console.log(`  👁️ Reviewer:  qwen3.5-397b             (deep quality review)`);
    console.log(`  🔍 Search:    nemotron-embed-1b        (semantic embeddings)`);
    console.log();
}

function showStatus() {
    printBanner();
    console.log(`${c.bold}System Status${c.reset}`);
    console.log();

    const providers = [
        { name: 'NVIDIA NIM', key: 'NVIDIA_API_KEY', icon: '🟢' },
        { name: 'Google Gemini', key: 'GOOGLE_API_KEY', icon: '🔵' },
        { name: 'OpenAI', key: 'OPENAI_API_KEY', icon: '⚪' },
        { name: 'Anthropic', key: 'ANTHROPIC_API_KEY', icon: '🟠' },
    ];

    for (const p of providers) {
        const configured = !!process.env[p.key];
        console.log(
            `  ${p.icon} ${p.name.padEnd(15)} ${configured ? `${c.green}✓ Configured${c.reset}` : `${c.dim}Not set${c.reset}`}`
        );
    }

    console.log();
    console.log(`  Node.js:      ${process.version}`);
    console.log(`  Platform:     ${process.platform} (${process.arch})`);
    console.log(`  Working Dir:  ${process.cwd()}`);
    console.log();

    console.log(`${c.bold}Available Features:${c.reset}`);
    const hasAI = isLLMConfigured();
    console.log(`  🧠 Pipeline (run)       ${hasAI ? c.green + '✓ Ready' : c.yellow + '⚠ Static only'}${c.reset}`);
    console.log(`  🛡️ Security (scan)       ${hasAI ? c.green + '✓ Ready' : c.red + '✗ Requires AI'}${c.reset}`);
    console.log(`  📝 Docs (docs)           ${hasAI ? c.green + '✓ Ready' : c.red + '✗ Requires AI'}${c.reset}`);
    console.log(`  🚀 Performance (perf)    ${hasAI ? c.green + '✓ Ready' : c.red + '✗ Requires AI'}${c.reset}`);
    console.log(`  🔄 Migration (migrate)   ${hasAI ? c.green + '✓ Ready' : c.red + '✗ Requires AI'}${c.reset}`);
    console.log();
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
    console.error(`${c.red}Fatal error:${c.reset}`, err);
    process.exit(1);
});

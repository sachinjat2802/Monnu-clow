// ============================================================================
// Monnu Clow — Core Package Entry Point
// Exports all agents, events, pipeline, memory, LLM, and feature modules
// ============================================================================

// Event System
export { AgentEventEmitter } from './events/emitter.js';
export type {
    Agent,
    AgentRole,
    AgentStatus,
    AgentAction,
    Task,
    Bug,
    RuntimeError,
    PipelinePhase,
    PipelineState,
    StabilityReport,
    MemoryEntry,
    SystemEvent,
    LogEvent,
    AgentStatusEvent,
    AgentActionEvent,
    TaskEvent,
    BugEvent,
    StabilityEvent,
    PipelineEvent,
} from './events/types.js';

// Agents
export { BaseAgent } from './agents/base-agent.js';
export type { AgentConfig, AgentContext } from './agents/base-agent.js';
export { PlannerAgent } from './agents/planner.js';
export { CoderAgent } from './agents/coder.js';
export { TesterAgent } from './agents/tester.js';
export { DebuggerAgent } from './agents/debugger.js';
export { ReviewerAgent } from './agents/reviewer.js';
export { MCPAgent } from './agents/mcp.js';

// Pipeline
export { PipelineExecutor } from './pipeline/executor.js';

// Memory
export { MemoryStore } from './memory/store.js';

// LLM Integration
export { BaseLLMProvider } from './llm/provider.js';
export type { LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk } from './llm/provider.js';
export { DEFAULT_LLM_CONFIGS } from './llm/provider.js';
export { OpenAIProvider } from './llm/openai.js';
export { AnthropicProvider } from './llm/anthropic.js';
export { GoogleProvider } from './llm/google.js';
export { OllamaProvider } from './llm/ollama.js';
export { NvidiaProvider, NVIDIA_MODEL_MAP, NVIDIA_EMBED_MODEL, NVIDIA_RERANK_MODEL } from './llm/nvidia.js';
export type { NvidiaUseCase, EmbeddingResult, RerankResult } from './llm/nvidia.js';
export { generateNvidiaEmbeddings, rerankWithNvidia } from './llm/nvidia.js';
export { createLLMProvider, createLLMFromEnv, isLLMConfigured } from './llm/factory.js';
export { AGENT_SYSTEM_PROMPTS } from './llm/prompts.js';

// Features (NVIDIA-powered)
export { SecurityScanner } from './features/security-scanner.js';
export type { Vulnerability, SecurityReport, VulnerabilitySeverity } from './features/security-scanner.js';
export { DocumentationGenerator } from './features/doc-generator.js';
export type { DocResult, DocReport } from './features/doc-generator.js';
export { CodeSearchEngine } from './features/code-search.js';
export type { CodeChunk, SearchResult, CodeIndex } from './features/code-search.js';
export { PerformanceProfiler } from './features/perf-profiler.js';
export type { PerformanceIssue, PerformanceReport } from './features/perf-profiler.js';
export { MigrationAssistant } from './features/migration-assistant.js';
export type { MigrationTask, MigrationReport } from './features/migration-assistant.js';

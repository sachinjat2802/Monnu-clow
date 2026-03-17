// ============================================================================
// Monnu Clow — NVIDIA NIM Provider
// OpenAI-compatible API with intelligent model routing
// Uses different NVIDIA models for different use cases
// API: https://integrate.api.nvidia.com/v1
// ============================================================================

import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk } from './provider.js';

// ─── NVIDIA Model Catalog ────────────────────────────────────────────────────

export type NvidiaUseCase =
    | 'planning'       // Complex reasoning & task planning
    | 'coding'         // Code generation & refactoring
    | 'debugging'      // Root cause analysis
    | 'testing'        // Test generation
    | 'reviewing'      // Code quality analysis
    | 'security'       // Vulnerability detection
    | 'documentation'  // Doc generation
    | 'general';       // Default / fallback

/**
 * Best model for each use case based on NVIDIA catalog
 */
export const NVIDIA_MODEL_MAP: Record<NvidiaUseCase, string> = {
    planning: 'nvidia/nemotron-3-super-120b-a12b',       // 120B MoE — best for multi-step reasoning
    coding: 'qwen/qwen3.5-122b-a10b',                  // Qwen 3.5 — excellent at code generation
    debugging: 'deepseek-ai/deepseek-v3_2',                // DeepSeek V3.2 — top reasoning + code
    testing: 'qwen/qwen3.5-122b-a10b',                  // Fast MoE, great at test generation
    reviewing: 'qwen/qwen3.5-397b-a17b',                  // Largest Qwen — deep quality analysis
    security: 'nvidia/nemotron-3-super-120b-a12b',        // Safety reasoning
    documentation: 'nvidia/nemotron-3-super-120b-a12b',        // Comprehensive doc generation
    general: 'nvidia/nemotron-3-super-120b-a12b',        // General purpose fallback
};

/**
 * Embedding model for semantic code search
 */
export const NVIDIA_EMBED_MODEL = 'nvidia/llama-nemotron-embed-1b-v2';

/**
 * Reranker model for improving search results
 */
export const NVIDIA_RERANK_MODEL = 'nvidia/llama-nemotron-rerank-1b-v2';

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// ─── Provider Implementation ─────────────────────────────────────────────────

export class NvidiaProvider extends BaseLLMProvider {
    private apiKey: string;
    private currentUseCase: NvidiaUseCase = 'general';

    constructor(config: LLMConfig) {
        super(config);
        this.apiKey = config.apiKey;
    }

    getProvider(): string {
        return 'nvidia';
    }

    getModel(): string {
        return this.config.model;
    }

    /**
     * Set the current use case to route to the optimal model
     * This allows a single provider to use different models per task
     */
    setUseCase(useCase: NvidiaUseCase): void {
        this.currentUseCase = useCase;
    }

    /**
     * Get the model for the current use case (or override)
     */
    private getActiveModel(): string {
        // If user explicitly set a model, always use that
        if (this.config.model !== NVIDIA_MODEL_MAP.general) {
            return this.config.model;
        }
        // Otherwise route to the best model for this use case
        return NVIDIA_MODEL_MAP[this.currentUseCase];
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const activeModel = this.getActiveModel();
        const baseUrl = this.config.baseUrl || NVIDIA_BASE_URL;

        const body: Record<string, unknown> = {
            model: activeModel,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
        };

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`NVIDIA API error (${response.status}): ${error}`);
        }

        const data = (await response.json()) as {
            choices: Array<{ message: { content: string }; finish_reason: string }>;
            usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
            model: string;
        };

        return {
            content: data.choices[0]?.message?.content ?? '',
            finishReason: data.choices[0]?.finish_reason ?? 'stop',
            tokensUsed: {
                prompt: data.usage?.prompt_tokens ?? 0,
                completion: data.usage?.completion_tokens ?? 0,
                total: data.usage?.total_tokens ?? 0,
            },
            model: data.model ?? activeModel,
        };
    }

    async chatStream(
        messages: LLMMessage[],
        onChunk: (chunk: LLMStreamChunk) => void
    ): Promise<LLMResponse> {
        const activeModel = this.getActiveModel();
        const baseUrl = this.config.baseUrl || NVIDIA_BASE_URL;

        const body: Record<string, unknown> = {
            model: activeModel,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            stream: true,
        };

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`NVIDIA stream error (${response.status}): ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.slice(6)) as {
                            choices: Array<{ delta: { content?: string }; finish_reason?: string }>;
                        };
                        const delta = data.choices[0]?.delta?.content;
                        if (delta) {
                            fullContent += delta;
                            onChunk({ content: delta, done: false });
                        }
                        if (data.choices[0]?.finish_reason) {
                            onChunk({ content: '', done: true });
                        }
                    } catch {
                        // Skip malformed chunks
                    }
                }
            }
        }

        return {
            content: fullContent,
            model: activeModel,
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            finishReason: 'stop',
        };
    }
}

// ─── Embedding Support ───────────────────────────────────────────────────────

export interface EmbeddingResult {
    embedding: number[];
    index: number;
}

/**
 * Generate embeddings using NVIDIA's embedding model
 * Used for semantic code search and similarity detection
 */
export async function generateNvidiaEmbeddings(
    texts: string[],
    apiKey: string,
    model?: string
): Promise<EmbeddingResult[]> {
    const baseUrl = NVIDIA_BASE_URL;
    const embedModel = model ?? NVIDIA_EMBED_MODEL;

    const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: embedModel,
            input: texts,
            input_type: 'query',
            encoding_format: 'float',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`NVIDIA Embedding error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
    };

    return data.data.map((d) => ({
        embedding: d.embedding,
        index: d.index,
    }));
}

// ─── Reranking Support ───────────────────────────────────────────────────────

export interface RerankResult {
    index: number;
    relevanceScore: number;
}

/**
 * Rerank search results using NVIDIA's reranker model
 * Improves semantic search precision
 */
export async function rerankWithNvidia(
    query: string,
    documents: string[],
    apiKey: string,
    topN?: number
): Promise<RerankResult[]> {
    const baseUrl = NVIDIA_BASE_URL;

    const response = await fetch(`${baseUrl}/ranking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: NVIDIA_RERANK_MODEL,
            query: { text: query },
            passages: documents.map((text) => ({ text })),
            top_n: topN ?? documents.length,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`NVIDIA Rerank error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
        rankings: Array<{ index: number; logit: number }>;
    };

    return data.rankings.map((r) => ({
        index: r.index,
        relevanceScore: r.logit,
    }));
}

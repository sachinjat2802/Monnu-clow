// ============================================================================
// Monnu Clow — LLM Provider Interface
// Unified interface for multi-provider AI integration
// ============================================================================

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    model: string;
    tokensUsed: {
        prompt: number;
        completion: number;
        total: number;
    };
    finishReason: string;
}

export interface LLMStreamChunk {
    content: string;
    done: boolean;
}

export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google' | 'nvidia' | 'ollama';
    apiKey: string;
    model: string;
    baseUrl?: string;
    maxTokens: number;
    temperature: number;
}

export const DEFAULT_LLM_CONFIGS: Record<string, Partial<LLMConfig>> = {
    openai: {
        provider: 'openai',
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 4096,
        temperature: 0.2,
    },
    anthropic: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        baseUrl: 'https://api.anthropic.com/v1',
        maxTokens: 4096,
        temperature: 0.2,
    },
    google: {
        provider: 'google',
        model: 'gemini-2.0-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 4096,
        temperature: 0.2,
    },
    ollama: {
        provider: 'ollama',
        model: 'codellama:13b',
        baseUrl: 'http://localhost:11434/api',
        maxTokens: 4096,
        temperature: 0.2,
        apiKey: 'not-needed',
    },
    nvidia: {
        provider: 'nvidia',
        model: 'nvidia/nemotron-3-super-120b-a12b',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        maxTokens: 4096,
        temperature: 0.2,
    },
};

/**
 * Abstract LLM Provider — all providers implement this interface
 */
export abstract class BaseLLMProvider {
    protected config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    abstract chat(messages: LLMMessage[]): Promise<LLMResponse>;
    abstract chatStream(
        messages: LLMMessage[],
        onChunk: (chunk: LLMStreamChunk) => void
    ): Promise<LLMResponse>;

    getModel(): string {
        return this.config.model;
    }

    getProvider(): string {
        return this.config.provider;
    }
}

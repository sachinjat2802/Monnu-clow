// ============================================================================
// Monnu Clow — LLM Factory
// Creates the right provider based on configuration
// Supports: OpenAI, Anthropic, Google, NVIDIA, Ollama
// ============================================================================

import { BaseLLMProvider, LLMConfig, DEFAULT_LLM_CONFIGS } from './provider.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { OllamaProvider } from './ollama.js';
import { NvidiaProvider, NVIDIA_MODEL_MAP } from './nvidia.js';

/**
 * Default API keys (public trial keys) - REMOVED for security
 */

/**
 * Create an LLM provider from config
 */
export function createLLMProvider(config: LLMConfig): BaseLLMProvider {
    switch (config.provider) {
        case 'openai':
            return new OpenAIProvider(config);
        case 'anthropic':
            return new AnthropicProvider(config);
        case 'google':
            return new GoogleProvider(config);
        case 'nvidia':
            return new NvidiaProvider(config);
        case 'ollama':
            return new OllamaProvider(config);
        default:
            throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
}

/**
 * Create an LLM provider from environment variables
 *
 * Checks for API keys in this order:
 * 1. MONNU_LLM_PROVIDER (explicit provider choice)
 * 2. NVIDIA_API_KEY
 * 3. OPENAI_API_KEY
 * 4. ANTHROPIC_API_KEY
 * 5. GOOGLE_API_KEY
 * 6. Falls back to Ollama (no key needed)
 */
export function createLLMFromEnv(): BaseLLMProvider {
    const explicitProvider = process.env.MONNU_LLM_PROVIDER;
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const googleKey = process.env.GOOGLE_API_KEY;

    let provider: string;
    let apiKey: string;

    if (explicitProvider) {
        provider = explicitProvider;
        switch (provider) {
            case 'nvidia':
                apiKey = nvidiaKey ?? '';
                break;
            case 'openai':
                apiKey = openaiKey ?? '';
                break;
            case 'anthropic':
                apiKey = anthropicKey ?? '';
                break;
            case 'google':
                apiKey = googleKey ?? '';
                break;
            case 'ollama':
                apiKey = 'not-needed';
                break;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    } else if (nvidiaKey) {
        provider = 'nvidia';
        apiKey = nvidiaKey;
    } else if (openaiKey) {
        provider = 'openai';
        apiKey = openaiKey;
    } else if (anthropicKey) {
        provider = 'anthropic';
        apiKey = anthropicKey;
    } else if (googleKey) {
        provider = 'google';
        apiKey = googleKey;
    } else {
        // Fallback to Ollama (local, no key needed)
        provider = 'ollama';
        apiKey = 'not-needed';
    }

    const defaultConfig = DEFAULT_LLM_CONFIGS[provider] ?? {};

    // For NVIDIA, use the general model from our map as default
    const nvidiaDefault = provider === 'nvidia' ? NVIDIA_MODEL_MAP.general : undefined;
    const model = process.env.MONNU_LLM_MODEL ?? nvidiaDefault ?? defaultConfig.model ?? 'gpt-4o';
    const baseUrl =
        process.env.MONNU_LLM_BASE_URL ??
        (provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : defaultConfig.baseUrl);

    const config: LLMConfig = {
        provider: provider as LLMConfig['provider'],
        apiKey,
        model,
        baseUrl,
        maxTokens: parseInt(process.env.MONNU_LLM_MAX_TOKENS ?? String(defaultConfig.maxTokens ?? 4096)),
        temperature: parseFloat(process.env.MONNU_LLM_TEMPERATURE ?? String(defaultConfig.temperature ?? 0.2)),
    };

    return createLLMProvider(config);
}

/**
 * Check if any LLM provider is configured
 */
export function isLLMConfigured(): boolean {
    // Now that we have default trial keys, it's technically always configured
    // but we can still check if the user has provided any key explicitly or wants Ollama
    return !!(
        process.env.NVIDIA_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.MONNU_LLM_PROVIDER === 'ollama'
    );
}

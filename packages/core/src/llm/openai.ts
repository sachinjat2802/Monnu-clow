// ============================================================================
// Monnu Clow — OpenAI Provider
// Supports GPT-4o, GPT-4-turbo, GPT-3.5-turbo and compatible APIs
// ============================================================================

import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk } from './provider.js';

export class OpenAIProvider extends BaseLLMProvider {
    constructor(config: LLMConfig) {
        super(config);
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                messages,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${error}`);
        }

        const data = await response.json() as any;
        const choice = data.choices?.[0];

        return {
            content: choice?.message?.content ?? '',
            model: data.model ?? this.config.model,
            tokensUsed: {
                prompt: data.usage?.prompt_tokens ?? 0,
                completion: data.usage?.completion_tokens ?? 0,
                total: data.usage?.total_tokens ?? 0,
            },
            finishReason: choice?.finish_reason ?? 'unknown',
        };
    }

    async chatStream(
        messages: LLMMessage[],
        onChunk: (chunk: LLMStreamChunk) => void
    ): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                messages,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                stream: true,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${error}`);
        }

        let fullContent = '';
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
            let done = false;
            while (!done) {
                const { value, done: streamDone } = await reader.read();
                done = streamDone;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

                    for (const line of lines) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') {
                            onChunk({ content: '', done: true });
                            break;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content ?? '';
                            if (content) {
                                fullContent += content;
                                onChunk({ content, done: false });
                            }
                        } catch {
                            // Skip malformed chunks
                        }
                    }
                }
            }
        }

        return {
            content: fullContent,
            model: this.config.model,
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            finishReason: 'stop',
        };
    }
}

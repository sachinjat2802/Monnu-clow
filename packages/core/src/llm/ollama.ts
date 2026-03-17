// ============================================================================
// Monnu Clow — Ollama Provider (Local LLM)
// Supports any model running via Ollama — completely free & private
// ============================================================================

import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk } from './provider.js';

export class OllamaProvider extends BaseLLMProvider {
    constructor(config: LLMConfig) {
        super(config);
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/chat`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
                stream: false,
                options: {
                    temperature: this.config.temperature,
                    num_predict: this.config.maxTokens,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${error}`);
        }

        const data = await response.json() as any;

        return {
            content: data.message?.content ?? '',
            model: data.model ?? this.config.model,
            tokensUsed: {
                prompt: data.prompt_eval_count ?? 0,
                completion: data.eval_count ?? 0,
                total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            },
            finishReason: data.done ? 'stop' : 'unknown',
        };
    }

    async chatStream(
        messages: LLMMessage[],
        onChunk: (chunk: LLMStreamChunk) => void
    ): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/chat`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
                stream: true,
                options: {
                    temperature: this.config.temperature,
                    num_predict: this.config.maxTokens,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${error}`);
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
                    const text = decoder.decode(value, { stream: true });
                    const lines = text.split('\n').filter(Boolean);

                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            const content = parsed.message?.content ?? '';

                            if (content) {
                                fullContent += content;
                                onChunk({ content, done: false });
                            }

                            if (parsed.done) {
                                onChunk({ content: '', done: true });
                            }
                        } catch {
                            // Skip malformed lines
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

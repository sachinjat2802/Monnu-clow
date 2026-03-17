// ============================================================================
// Monnu Clow — Anthropic Provider
// Supports Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
// ============================================================================

import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk } from './provider.js';

export class AnthropicProvider extends BaseLLMProvider {
    constructor(config: LLMConfig) {
        super(config);
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/messages`;

        // Anthropic uses a separate 'system' parameter
        const systemMessage = messages.find((m) => m.role === 'system');
        const nonSystemMessages = messages.filter((m) => m.role !== 'system');

        const body: Record<string, unknown> = {
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            messages: nonSystemMessages.map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            })),
        };

        if (systemMessage) {
            body.system = systemMessage.content;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${error}`);
        }

        const data = await response.json() as any;
        const content =
            data.content?.map((c: { text: string }) => c.text).join('') ?? '';

        return {
            content,
            model: data.model ?? this.config.model,
            tokensUsed: {
                prompt: data.usage?.input_tokens ?? 0,
                completion: data.usage?.output_tokens ?? 0,
                total: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
            },
            finishReason: data.stop_reason ?? 'unknown',
        };
    }

    async chatStream(
        messages: LLMMessage[],
        onChunk: (chunk: LLMStreamChunk) => void
    ): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/messages`;

        const systemMessage = messages.find((m) => m.role === 'system');
        const nonSystemMessages = messages.filter((m) => m.role !== 'system');

        const body: Record<string, unknown> = {
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            stream: true,
            messages: nonSystemMessages.map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            })),
        };

        if (systemMessage) {
            body.system = systemMessage.content;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${error}`);
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
                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.type === 'content_block_delta') {
                                const text = parsed.delta?.text ?? '';
                                if (text) {
                                    fullContent += text;
                                    onChunk({ content: text, done: false });
                                }
                            }

                            if (parsed.type === 'message_stop') {
                                onChunk({ content: '', done: true });
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

// ============================================================================
// Monnu Clow — Google Gemini Provider
// Supports Gemini 2.0 Flash, Gemini Pro, and other models
// ============================================================================

import { BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk } from './provider.js';

export class GoogleProvider extends BaseLLMProvider {
    constructor(config: LLMConfig) {
        super(config);
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

        // Convert messages to Gemini format
        const systemInstruction = messages.find((m) => m.role === 'system');
        const nonSystemMessages = messages.filter((m) => m.role !== 'system');

        const body: Record<string, unknown> = {
            contents: nonSystemMessages.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            })),
            generationConfig: {
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.temperature,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: systemInstruction.content }],
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google AI API error (${response.status}): ${error}`);
        }

        const data = await response.json() as any;
        const content =
            data.candidates?.[0]?.content?.parts
                ?.map((p: { text: string }) => p.text)
                .join('') ?? '';

        return {
            content,
            model: this.config.model,
            tokensUsed: {
                prompt: data.usageMetadata?.promptTokenCount ?? 0,
                completion: data.usageMetadata?.candidatesTokenCount ?? 0,
                total: data.usageMetadata?.totalTokenCount ?? 0,
            },
            finishReason: data.candidates?.[0]?.finishReason ?? 'unknown',
        };
    }

    async chatStream(
        messages: LLMMessage[],
        onChunk: (chunk: LLMStreamChunk) => void
    ): Promise<LLMResponse> {
        const url = `${this.config.baseUrl}/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;

        const systemInstruction = messages.find((m) => m.role === 'system');
        const nonSystemMessages = messages.filter((m) => m.role !== 'system');

        const body: Record<string, unknown> = {
            contents: nonSystemMessages.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            })),
            generationConfig: {
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.temperature,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: systemInstruction.content }],
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google AI API error (${response.status}): ${error}`);
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
                            const text =
                                parsed.candidates?.[0]?.content?.parts
                                    ?.map((p: { text: string }) => p.text)
                                    .join('') ?? '';

                            if (text) {
                                fullContent += text;
                                onChunk({ content: text, done: false });
                            }
                        } catch {
                            // Skip malformed chunks
                        }
                    }
                }
            }
        }

        onChunk({ content: '', done: true });

        return {
            content: fullContent,
            model: this.config.model,
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            finishReason: 'stop',
        };
    }
}

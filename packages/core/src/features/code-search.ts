// ============================================================================
// Monnu Clow — Code Search Feature (Semantic)
// Embedding-based code similarity search using NVIDIA models
// ============================================================================

import { generateNvidiaEmbeddings, rerankWithNvidia, EmbeddingResult } from '../llm/nvidia.js';
import { AgentEventEmitter } from '../events/emitter.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CodeChunk {
    file: string;
    startLine: number;
    endLine: number;
    content: string;
    language: string;
    embedding?: number[];
}

export interface SearchResult {
    chunk: CodeChunk;
    score: number;
    rank: number;
}

export interface CodeIndex {
    chunks: CodeChunk[];
    indexedAt: number;
    totalFiles: number;
    totalChunks: number;
}

/**
 * Semantic code search engine powered by NVIDIA embeddings
 * Enables finding similar code, detecting duplicates, and
 * providing rich context to other agents
 */
export class CodeSearchEngine {
    private apiKey: string;
    private events: AgentEventEmitter;
    private index: CodeIndex | null = null;

    constructor(apiKey: string, events: AgentEventEmitter) {
        this.apiKey = apiKey;
        this.events = events;
    }

    /**
     * Index a codebase for semantic search
     */
    async indexCodebase(workingDir: string): Promise<CodeIndex> {
        this.events.log('info', 'CodeSearch', '🔍 Indexing codebase for semantic search...');

        const chunks: CodeChunk[] = [];

        try {
            const { glob } = await import('glob');

            const files = await glob('**/*.{ts,tsx,js,jsx,py,java,go,rs}', {
                cwd: workingDir,
                ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
            });

            this.events.log('info', 'CodeSearch', `Found ${files.length} files to index`);

            // Split files into chunks
            for (const file of files) {
                try {
                    const content = await fs.readFile(path.join(workingDir, file), 'utf-8');
                    const ext = path.extname(file).slice(1);
                    const fileChunks = this.splitIntoChunks(file, content, ext);
                    chunks.push(...fileChunks);
                } catch {
                    // Skip unreadable
                }
            }

            this.events.log('info', 'CodeSearch', `Created ${chunks.length} code chunks, generating embeddings...`);

            // Generate embeddings in batches of 10
            for (let i = 0; i < chunks.length; i += 10) {
                const batch = chunks.slice(i, i + 10);
                const texts = batch.map((c) => c.content);

                try {
                    const embeddings = await generateNvidiaEmbeddings(texts, this.apiKey);
                    for (const emb of embeddings) {
                        if (batch[emb.index]) {
                            batch[emb.index].embedding = emb.embedding;
                        }
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    this.events.log('warn', 'CodeSearch', `Embedding batch failed: ${msg}`);
                }
            }

            const indexedChunks = chunks.filter((c) => c.embedding);

            this.index = {
                chunks: indexedChunks,
                indexedAt: Date.now(),
                totalFiles: files.length,
                totalChunks: indexedChunks.length,
            };

            this.events.log(
                'success',
                'CodeSearch',
                `🔍 Indexed ${indexedChunks.length} chunks from ${files.length} files`
            );

            return this.index;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.events.log('error', 'CodeSearch', `Indexing failed: ${msg}`);
            throw error;
        }
    }

    /**
     * Search the indexed codebase semantically
     */
    async search(query: string, topK: number = 10): Promise<SearchResult[]> {
        if (!this.index || this.index.chunks.length === 0) {
            this.events.log('warn', 'CodeSearch', 'No index available — run indexCodebase first');
            return [];
        }

        // Embed the query
        const [queryEmbedding] = await generateNvidiaEmbeddings([query], this.apiKey);

        if (!queryEmbedding) {
            return [];
        }

        // Cosine similarity search
        const results: SearchResult[] = this.index.chunks
            .filter((c) => c.embedding)
            .map((chunk) => ({
                chunk,
                score: this.cosineSimilarity(queryEmbedding.embedding, chunk.embedding!),
                rank: 0,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK * 2); // Get extra for reranking

        // Rerank with NVIDIA reranker for better precision
        try {
            const documents = results.map((r) => r.chunk.content);
            const reranked = await rerankWithNvidia(query, documents, this.apiKey, topK);

            return reranked.map((r, idx) => ({
                chunk: results[r.index].chunk,
                score: r.relevanceScore,
                rank: idx + 1,
            }));
        } catch {
            // Fallback to pure embedding similarity
            return results.slice(0, topK).map((r, idx) => ({
                ...r,
                rank: idx + 1,
            }));
        }
    }

    /**
     * Find duplicate/similar code blocks
     */
    async findDuplicates(threshold: number = 0.92): Promise<Array<{ a: CodeChunk; b: CodeChunk; similarity: number }>> {
        if (!this.index) return [];

        const duplicates: Array<{ a: CodeChunk; b: CodeChunk; similarity: number }> = [];
        const chunks = this.index.chunks.filter((c) => c.embedding);

        for (let i = 0; i < chunks.length; i++) {
            for (let j = i + 1; j < chunks.length; j++) {
                if (chunks[i].file === chunks[j].file) continue; // Skip same file

                const similarity = this.cosineSimilarity(chunks[i].embedding!, chunks[j].embedding!);
                if (similarity >= threshold) {
                    duplicates.push({
                        a: chunks[i],
                        b: chunks[j],
                        similarity,
                    });
                }
            }
        }

        return duplicates.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Split a file into meaningful code chunks
     */
    private splitIntoChunks(file: string, content: string, language: string): CodeChunk[] {
        const chunks: CodeChunk[] = [];
        const lines = content.split('\n');
        const chunkSize = 40; // lines per chunk
        const overlap = 10;

        for (let i = 0; i < lines.length; i += chunkSize - overlap) {
            const endLine = Math.min(i + chunkSize, lines.length);
            const chunkContent = lines.slice(i, endLine).join('\n');

            // Skip very small chunks
            if (chunkContent.trim().length < 50) continue;

            chunks.push({
                file,
                startLine: i + 1,
                endLine,
                content: chunkContent,
                language,
            });
        }

        return chunks;
    }

    /**
     * Cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    getIndex(): CodeIndex | null {
        return this.index;
    }
}

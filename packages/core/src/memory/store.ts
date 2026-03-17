// ============================================================================
// Monnu Clow — Memory Store
// Tracks recurring patterns, fragile code, and learning from past issues
// ============================================================================

import { MemoryEntry, Bug, AgentRole } from '../events/types.js';
import { AgentEventEmitter } from '../events/emitter.js';
import { v4 as uuidv4 } from 'uuid';

export class MemoryStore {
    private entries: Map<string, MemoryEntry> = new Map();
    private events: AgentEventEmitter;

    constructor(events: AgentEventEmitter) {
        this.events = events;
        this.setupListeners();
    }

    /**
     * Listen for events that should be tracked in memory
     */
    private setupListeners(): void {
        // Track recurring bugs
        this.events.on('bug:detected', (event) => {
            const bug = (event as { data: Bug }).data;
            this.recordPattern('recurring-bug', bug.file, `Bug: ${bug.description}`);
        });

        // Track failing tests
        this.events.on('bug:detected', (event) => {
            const bug = (event as { data: Bug }).data;
            if (bug.relatedTests.length > 0) {
                for (const test of bug.relatedTests) {
                    this.recordPattern('failing-test', test, `Test failure in ${bug.file}`);
                }
            }
        });
    }

    /**
     * Record or update a pattern in memory
     */
    recordPattern(
        type: MemoryEntry['type'],
        target: string,
        note: string
    ): void {
        const key = `${type}:${target}`;

        if (this.entries.has(key)) {
            const entry = this.entries.get(key)!;
            entry.occurrences++;
            entry.lastSeen = Date.now();
            entry.priority = Math.min(10, entry.priority + 1);
            entry.notes.push(note);

            // Keep only last 20 notes
            if (entry.notes.length > 20) {
                entry.notes = entry.notes.slice(-20);
            }

            this.events.log(
                'warn',
                'Memory',
                `Recurring pattern detected: ${target} (${entry.occurrences} occurrences)`,
                note
            );
        } else {
            const entry: MemoryEntry = {
                id: uuidv4(),
                type,
                target,
                occurrences: 1,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                priority: 1,
                notes: [note],
            };
            this.entries.set(key, entry);
        }
    }

    /**
     * Get all memory entries sorted by priority
     */
    getEntries(): MemoryEntry[] {
        return Array.from(this.entries.values()).sort(
            (a, b) => b.priority - a.priority
        );
    }

    /**
     * Get entries by type
     */
    getByType(type: MemoryEntry['type']): MemoryEntry[] {
        return this.getEntries().filter((e) => e.type === type);
    }

    /**
     * Get high-priority entries (priority >= 5)
     */
    getHighPriority(): MemoryEntry[] {
        return this.getEntries().filter((e) => e.priority >= 5);
    }

    /**
     * Get the most fragile modules
     */
    getFragileModules(limit = 10): MemoryEntry[] {
        return this.getEntries()
            .filter((e) => e.type === 'unstable-module' || e.type === 'fragile-code')
            .slice(0, limit);
    }

    /**
     * Check if a file/module is known to be fragile
     */
    isFragile(target: string): boolean {
        for (const entry of this.entries.values()) {
            if (entry.target === target && entry.occurrences >= 3) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get memory statistics
     */
    getStats(): {
        totalEntries: number;
        recurringBugs: number;
        unstableModules: number;
        failingTests: number;
        fragileCode: number;
        highPriorityCount: number;
    } {
        const entries = this.getEntries();
        return {
            totalEntries: entries.length,
            recurringBugs: entries.filter((e) => e.type === 'recurring-bug').length,
            unstableModules: entries.filter((e) => e.type === 'unstable-module').length,
            failingTests: entries.filter((e) => e.type === 'failing-test').length,
            fragileCode: entries.filter((e) => e.type === 'fragile-code').length,
            highPriorityCount: entries.filter((e) => e.priority >= 5).length,
        };
    }

    /**
     * Clear all memory
     */
    clear(): void {
        this.entries.clear();
    }

    /**
     * Export memory as JSON (for persistence)
     */
    export(): string {
        return JSON.stringify(Array.from(this.entries.values()), null, 2);
    }

    /**
     * Import memory from JSON
     */
    import(json: string): void {
        try {
            const entries: MemoryEntry[] = JSON.parse(json);
            for (const entry of entries) {
                const key = `${entry.type}:${entry.target}`;
                this.entries.set(key, entry);
            }
        } catch {
            this.events.log('error', 'Memory', 'Failed to import memory data');
        }
    }
}

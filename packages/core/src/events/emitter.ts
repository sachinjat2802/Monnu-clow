// ============================================================================
// Monnu Clow — Event Emitter
// Central nervous system for real-time inter-agent communication
// ============================================================================

import EventEmitter from 'eventemitter3';
import { SystemEvent, AgentRole, AgentStatus, LogEvent } from './types.js';

export class AgentEventEmitter {
    private emitter: EventEmitter;
    private eventHistory: SystemEvent[] = [];
    private maxHistory = 1000;

    constructor() {
        this.emitter = new EventEmitter();
    }

    /**
     * Emit a system event and store in history
     */
    emit(event: SystemEvent): void {
        this.eventHistory.push(event);

        // Trim history if it exceeds max
        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistory);
        }

        this.emitter.emit(event.type, event);
        this.emitter.emit('*', event); // Wildcard — dashboard listens to all
    }

    /**
     * Listen to a specific event type
     */
    on(eventType: string, handler: (event: SystemEvent) => void): void {
        this.emitter.on(eventType, handler);
    }

    /**
     * Listen to all events (for dashboard streaming)
     */
    onAll(handler: (event: SystemEvent) => void): void {
        this.emitter.on('*', handler);
    }

    /**
     * Remove a listener
     */
    off(eventType: string, handler: (event: SystemEvent) => void): void {
        this.emitter.off(eventType, handler);
    }

    /**
     * Get recent event history
     */
    getHistory(count: number = 50): SystemEvent[] {
        return this.eventHistory.slice(-count);
    }

    /**
     * Get events for a specific agent
     */
    getAgentHistory(role: AgentRole, count: number = 50): SystemEvent[] {
        return this.eventHistory
            .filter((e) => e.agentRole === role)
            .slice(-count);
    }

    /**
     * Convenience: emit a log event
     */
    log(
        level: 'info' | 'warn' | 'error' | 'success',
        source: string,
        message: string,
        details?: string,
        agentRole?: AgentRole
    ): void {
        const event: LogEvent = {
            type: `log:${level}`,
            timestamp: Date.now(),
            agentRole: agentRole ?? null,
            data: { message, source, details },
        };
        this.emit(event);
    }

    /**
     * Convenience: emit agent status change
     */
    agentStatus(role: AgentRole, status: AgentStatus, message: string): void {
        this.emit({
            type: 'agent:status',
            timestamp: Date.now(),
            agentRole: role,
            data: { role, status, message },
        });
    }

    /**
     * Clear all event history
     */
    clear(): void {
        this.eventHistory = [];
    }

    /**
     * Destroy the emitter
     */
    destroy(): void {
        this.emitter.removeAllListeners();
        this.eventHistory = [];
    }
}

// Singleton instance for the system
export const systemEvents = new AgentEventEmitter();

// ============================================================================
// Monnu Clow — Supervisor Agent Test Case
// ============================================================================

import { describe, it, expect } from '@jest/globals';
import { SupervisorAgent } from './supervisor.js';
import { AgentEventEmitter } from '../events/emitter.js';

describe('SupervisorAgent', () => {
    it('should be defined and have correct initial role and name', () => {
        const emitter = new AgentEventEmitter();
        const agent = new SupervisorAgent(emitter);
        expect(agent).toBeDefined();
        expect(agent.role).toBe('supervisor');
        expect(agent.name).toBe('Supervisor Agent');
    });

    it('should gather system state and execute without AI without crashing', async () => {
        const emitter = new AgentEventEmitter();
        const agent = new SupervisorAgent(emitter);

        const context = {
            workingDirectory: '.',
            iteration: 1,
            previousActions: [],
            sharedMemory: new Map(),
        };

        // Mock basic state in shared memory
        context.sharedMemory.set('tasks', []);
        context.sharedMemory.set('agentStatuses', new Map());
        context.sharedMemory.set('pipelineState', { phase: 'idle' });

        const actions = await agent['performWork'](context);
        expect(actions).toBeDefined();
        expect(Array.isArray(actions)).toBe(true);
        expect(actions.length).toBeGreaterThan(0);
        expect(actions[0].action).toBe('gather-state');
    });
});

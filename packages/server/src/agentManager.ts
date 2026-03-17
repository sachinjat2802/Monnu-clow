import { Agent } from '../core/types';

/**
 * Manages the lifecycle and state of agents
 */
export class AgentManager {
  private agents: Map<string, Agent> = new Map();

  /**
   * Register a new agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Unregister an agent by ID
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Update agent state
   */
  updateAgent(agentId: string, updates: Partial<Agent>): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, updates);
    }
  }

  /**
   * Get the number of registered agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }
}

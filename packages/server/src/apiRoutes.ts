import { Router } from 'express';
import { AgentManager } from './agentManager';

/**
 * Defines API routes for the server
 */
export function createApiRoutes(agentManager: AgentManager): Router {
  const router = Router();

  // Get all agents
  router.get('/agents', (req, res) => {
    try {
      const agents = agentManager.getAllAgents();
      res.json({ success: true, data: agents });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch agents' });
    }
  });

  // Register an agent
  router.post('/agents', (req, res) => {
    try {
      const agent = req.body;
      agentManager.registerAgent(agent);
      res.status(201).json({ success: true, data: agent });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to register agent' });
    }
  });

  // Get a specific agent
  router.get('/agents/:id', (req, res) => {
    try {
      const agent = agentManager.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }
      res.json({ success: true, data: agent });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch agent' });
    }
  });

  // Update an agent
  router.patch('/agents/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      agentManager.updateAgent(id, updates);
      const updatedAgent = agentManager.getAgent(id);
      res.json({ success: true, data: updatedAgent });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update agent' });
    }
  });

  // Delete an agent
  router.delete('/agents/:id', (req, res) => {
    try {
      const agent = agentManager.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }
      agentManager.unregisterAgent(req.params.id);
      res.json({ success: true, message: 'Agent deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to delete agent' });
    }
  });

  return router;
}

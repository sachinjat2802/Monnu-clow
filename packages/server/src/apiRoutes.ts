import { Router, Request, Response } from 'express';
import { AgentManager } from './agentManager';

/**
 * Defines API routes for the server
 */
export function createApiRoutes(agentManager: AgentManager): Router {
  const router = Router();

  // Get all agents
  router.get('/agents', (req: Request, res: Response) => {
    try {
      const agents = agentManager.getAllAgents();
      res.json({ success: true, data: agents });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch agents' });
    }
  });

  // Get a specific agent
  router.get('/agents/:id', (req: Request, res: Response) => {
    try {
      const agent = agentManager.getAgent(req.params.id as string);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }
      res.json({ success: true, data: agent });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch agent' });
    }
  });

  // Update an agent
  router.patch('/agents/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      agentManager.updateAgent(id, updates);
      const updatedAgent = agentManager.getAgent(id);
      res.json({ success: true, data: updatedAgent });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update agent' });
    }
  });

  // Delete an agent
  router.delete('/agents/:id', (req: Request, res: Response) => {
    try {
      const agent = agentManager.getAgent(req.params.id as string);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }
      agentManager.unregisterAgent(req.params.id as string);
      res.json({ success: true, message: 'Agent deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to delete agent' });
    }
  });

  return router;
}

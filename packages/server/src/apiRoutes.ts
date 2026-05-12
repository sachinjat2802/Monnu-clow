import { Router, Request, Response } from 'express';
import { AgentManager } from './agentManager';
import fs from 'fs/promises';
import path from 'path';

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

  // Get file tree
  router.get('/files/tree', async (req: Request, res: Response) => {
    try {
      const root = (req.query.root as string) || '.';
      const absoluteRoot = path.resolve(root);
      const tree = await buildTree(absoluteRoot, absoluteRoot);
      res.json({ success: true, files: tree });
    } catch (error) {
      console.error('File tree error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch file tree' });
    }
  });

  async function buildTree(dir: string, baseDir: string): Promise<any[]> {
    const files = await fs.readdir(dir, { withFileTypes: true });
    const nodes = await Promise.all(
      files
        .filter(f => !['node_modules', '.git', 'dist'].includes(f.name))
        .map(async f => {
          const fullPath = path.join(dir, f.name);
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const node: any = {
            name: f.name,
            path: relativePath,
            isDir: f.isDirectory()
          };
          if (node.isDir) {
            node.children = await buildTree(fullPath, baseDir);
          }
          return node;
        })
    );
    return nodes;
  }

  // Get file content
  router.get('/files/content', async (req: Request, res: Response) => {
    try {
      const filePath = req.query.path as string;
      const root = (req.query.root as string) || '.';
      const absolutePath = path.resolve(root, filePath);

      const content = await fs.readFile(absolutePath, 'utf-8');
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch file content' });
    }
  });

  // Search files
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      // Mock search or implement using ripgrep if available
      // For now, return empty results
      res.json({ success: true, results: [] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Search failed' });
    }
  });

  return router;
}

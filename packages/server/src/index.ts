import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketHandler } from './websocketHandler';
import { EventBroadcaster } from './eventBroadcaster';
import { AgentManager } from './agentManager';
import { createApiRoutes } from './apiRoutes';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize managers
const eventBroadcaster = new EventBroadcaster();
const agentManager = new AgentManager();

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(server, eventBroadcaster, agentManager);

// Initialize API routes
const apiRouter = createApiRoutes(agentManager);
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

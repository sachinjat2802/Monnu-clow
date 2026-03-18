import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketHandler } from './websocketHandler';
import { EventBroadcaster } from './eventBroadcaster';
import { AgentManager } from './agentManager';
import { createApiRoutes } from './apiRoutes';
import { PipelineExecutor, AgentEventEmitter } from '@monnu-clow/core';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize managers
const eventBroadcaster = new EventBroadcaster();
const agentManager = new AgentManager();
const eventEmitter = new AgentEventEmitter();

// Initialize Pipeline Executor
const pipeline = new PipelineExecutor({
  workingDirectory: process.env.TARGET_REPO || '.',
  autoFix: true,
  verbose: true
}, eventEmitter);

// Bridge Pipeline events to WebSocket
eventEmitter.onAll((event) => {
  // Map core events to the format expected by the dashboard
  // The dashboard useWebSocket.ts expects { type: eventType, data: eventData }
  eventBroadcaster.broadcast({
    type: event.type,
    timestamp: event.timestamp,
    data: event.data,
    agentRole: event.agentRole
  });
});

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(server, eventBroadcaster, agentManager, pipeline);

// Register agents with the manager for dashboard visibility
// Accessing private agents (using any cast for simplicity in this setup)
const agentsDict = (pipeline as any);
if (agentsDict.planner) agentManager.registerAgent(agentsDict.planner);
if (agentsDict.coder) agentManager.registerAgent(agentsDict.coder);
if (agentsDict.tester) agentManager.registerAgent(agentsDict.tester);
if (agentsDict.debugger_) agentManager.registerAgent(agentsDict.debugger_);
if (agentsDict.reviewer) agentManager.registerAgent(agentsDict.reviewer);
if (agentsDict.supervisor) agentManager.registerAgent(agentsDict.supervisor);

// Initialize API routes
const apiRouter = createApiRoutes(agentManager);
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    pipeline: pipeline.getIsRunning() ? 'running' : 'idle'
  });
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

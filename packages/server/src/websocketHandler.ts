import { WebSocketServer, WebSocket } from 'ws';
import { EventBroadcaster } from './eventBroadcaster';
import { AgentManager } from './agentManager';

/**
 * Handles WebSocket connections and messaging
 */
export class WebSocketHandler {
  private wss: WebSocketServer;
  private eventBroadcaster: EventBroadcaster;
  private agentManager: AgentManager;
  private pipeline: any; // Using any to avoid complex type import if not needed, but better to use PipelineExecutor

  constructor(
    server: any,
    eventBroadcaster: EventBroadcaster,
    agentManager: AgentManager,
    pipeline: any
  ) {
    this.eventBroadcaster = eventBroadcaster;
    this.agentManager = agentManager;
    this.pipeline = pipeline;
    this.wss = new WebSocketServer({ server });
    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);

      ws.on('message', (message: WebSocket.Data) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.handleClose(ws);
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleConnection(ws: WebSocket): void {
    console.log('New WebSocket client connected');
    this.eventBroadcaster.addClient(ws);

    // Send initial agent list to new client
    const agents = this.agentManager.getAllAgents();
    ws.send(JSON.stringify({ type: 'AGENTS_INIT', payload: agents }));
  }

  private handleMessage(ws: WebSocket, message: WebSocket.Data): void {
    try {
      const data = JSON.parse(message.toString());

      // Support both { type, payload } and { action, data } formats
      const type = data.type || data.action;
      const payload = data.payload || data.data;

      switch (type) {
        case 'agent:update':
        case 'AGENT_UPDATE':
          this.agentManager.updateAgent(payload?.id, payload?.updates);
          this.eventBroadcaster.broadcast({
            type: 'AGENT_UPDATED',
            payload: this.agentManager.getAgent(payload?.id)
          });
          break;

        case 'start':
        case 'workflow:start-automated':
          console.log('Starting pipeline from dashboard...');
          if (!this.pipeline.getIsRunning()) {
            this.pipeline.start().catch((err: any) => {
              console.error('Failed to start pipeline:', err);
            });
          }
          break;

        case 'stop':
          console.log('Stopping pipeline from dashboard...');
          this.pipeline.stop();
          break;

        default:
          console.warn('Unknown WebSocket message type/action:', type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleClose(ws: WebSocket): void {
    console.log('WebSocket client disconnected');
    this.eventBroadcaster.removeClient(ws);
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(data: unknown): void {
    this.eventBroadcaster.broadcast(data);
  }
}

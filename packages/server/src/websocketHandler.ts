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

  constructor(
    server: any,
    eventBroadcaster: EventBroadcaster,
    agentManager: AgentManager
  ) {
    this.eventBroadcaster = eventBroadcaster;
    this.agentManager = agentManager;
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
      
      switch (data.type) {
        case 'AGENT_UPDATE':
          this.agentManager.updateAgent(data.payload.id, data.payload.updates);
          // Broadcast update to all clients
          this.eventBroadcaster.broadcast({
            type: 'AGENT_UPDATED',
            payload: this.agentManager.getAgent(data.payload.id)
          });
          break;
        
        default:
          console.warn('Unknown WebSocket message type:', data.type);
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

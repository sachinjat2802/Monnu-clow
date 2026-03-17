import { WebSocket } from 'ws';

/**
 * Manages broadcasting events to WebSocket clients
 */
export class EventBroadcaster {
  private clients: Set<WebSocket> = new Set();

  /**
   * Add a WebSocket client to the broadcaster
   */
  addClient(client: WebSocket): void {
    this.clients.add(client);
  }

  /**
   * Remove a WebSocket client from the broadcaster
   */
  removeClient(client: WebSocket): void {
    this.clients.delete(client);
  }

  /**
   * Broadcast data to all connected clients
   * @param data - Data to broadcast (will be stringified)
   */
  broadcast(data: unknown): void {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

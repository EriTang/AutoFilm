import { io, Socket } from 'socket.io-client';
import { WebSocketMessage } from '../types';

class WebSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  connect() {
    if (this.socket?.connected) {
      return;
    }

    console.log('Connecting to WebSocket...');
    
    // 使用原生 WebSocket 而不是 Socket.IO
    this.connectWebSocket();
  }

  private connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // 发送心跳
      this.sendHeartbeat(ws);
    };
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleReconnect();
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    // 保存 WebSocket 实例
    (this as any).ws = ws;
  }

  private sendHeartbeat(ws: WebSocket) {
    const heartbeat = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        setTimeout(heartbeat, 30000); // 每30秒发送一次心跳
      }
    };
    heartbeat();
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('Received WebSocket message:', message);
    
    const listeners = this.listeners.get(message.type) || [];
    listeners.forEach(listener => {
      try {
        listener(message.data || message);
      } catch (error) {
        console.error('Error in WebSocket listener:', error);
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  send(message: any) {
    const ws = (this as any).ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    const ws = (this as any).ws;
    if (ws) {
      ws.close();
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    const ws = (this as any).ws;
    return ws && ws.readyState === WebSocket.OPEN;
  }
}

// 创建全局 WebSocket 管理器实例
export const wsManager = new WebSocketManager();

// 自动连接
wsManager.connect();

export default wsManager;


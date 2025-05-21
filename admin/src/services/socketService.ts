import { io, Socket } from 'socket.io-client';

// Determine the server URL based on environment
const ADMIN_SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://schoolquizgame.onrender.com' 
  : 'http://localhost:5000';

class AdminSocketService {
  private socket: Socket | null = null;
  private connectionPromise: Promise<Socket | null> | null = null;
  private url: string;

  constructor() {
    // Prefer REACT_APP_SOCKET_URL if available, then fall back to ADMIN_SOCKET_URL
    this.url = process.env.REACT_APP_SOCKET_URL || ADMIN_SOCKET_URL;
    console.log('[AdminSocketService] Initializing with URL:', this.url);
  }

  connect(): Promise<Socket | null> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.socket?.connected) {
      return Promise.resolve(this.socket);
    }

    console.log('[AdminSocketService] Attempting to connect to:', this.url);

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000,
        // Consider adding a query parameter to identify as admin
        // query: { isAdmin: true }
      });

      this.socket.on('connect', () => {
        console.log('[AdminSocketService] Connected successfully:', this.socket?.id);
        this.connectionPromise = null;
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[AdminSocketService] Connection error:', error);
        this.connectionPromise = null;
        this.socket?.disconnect(); // Ensure socket is cleaned up
        this.socket = null;
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[AdminSocketService] Disconnected:', reason);
        this.socket = null; 
        // Potentially handle reconnection or notify UI
      });
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.socket) {
      console.log('[AdminSocketService] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionPromise = null;
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }

  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

const adminSocketService = new AdminSocketService();
export default adminSocketService; 
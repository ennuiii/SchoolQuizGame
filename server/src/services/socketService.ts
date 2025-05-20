import { Server } from 'socket.io';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger, logEvent } from './logService';
import * as roomService from './roomService';
import { gameAnalytics } from './gameAnalytics';
import { CustomSocket, GameRoom, GameState, Player } from '../types';

/**
 * SocketService class to manage all socket.io interactions
 */
export class SocketService {
  private io: Server;
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Create a new SocketService instance
   */
  constructor(server: http.Server, allowedOrigins: string[] = ['http://localhost:3000']) {
    // Initialize Socket.IO
    this.io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      maxHttpBufferSize: 5e6, // 5MB
      pingTimeout: 60000,
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
      }
    });
    
    // Setup socket event handlers
    this.setupSocketHandlers();
    logger.log('SocketService initialized', {});
  }
  
  /**
   * Set up all socket event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: CustomSocket) => {
      logger.log(`User connected to socket: ${socket.id}`, {});
      
      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.log(`User disconnected: ${socket.id}, reason: ${reason}`, {});
      });
    });
  }
}

/**
 * Create a SocketService instance
 */
export function createSocketService(server: http.Server, allowedOrigins: string[] = ['http://localhost:3000']): SocketService {
  return new SocketService(server, allowedOrigins);
} 
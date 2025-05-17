import { io, Socket } from 'socket.io-client';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'drawing';
  timeLimit?: number;
  answer?: string;
  grade: number;
  subject: string;
}

// Determine the server URL based on environment
// In production, use the specific backend URL
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://schoolquizgame.onrender.com' // The deployed backend URL
  : 'http://localhost:5000'; // Use port 5000 to match server

export class SocketService {
  private socket: Socket | null = null;
  private connectionState: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private connectionPromise: Promise<Socket | null> | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private connectionStateListeners: ((state: string) => void)[] = [];
  private url: string;

  constructor() {
    this.url = process.env.REACT_APP_SOCKET_URL || 'https://schoolquizgame.onrender.com';
    console.log('[SocketService] Initializing with URL:', this.url);
  }

  // Add method to listen for connection state changes
  onConnectionStateChange(callback: (state: string) => void) {
    this.connectionStateListeners.push(callback);
    // Immediately call with current state
    callback(this.connectionState);
  }

  private updateConnectionState(newState: 'connected' | 'disconnected' | 'connecting') {
    this.connectionState = newState;
    this.connectionStateListeners.forEach(listener => listener(newState));
  }

  connect(): Promise<Socket | null> {
    // If we're already connecting, return the existing promise
    if (this.connectionPromise) {
      console.log('[SocketService] Connection already in progress, reusing promise');
      return this.connectionPromise;
    }

    // If we're already connected, return the existing socket
    if (this.socket?.connected) {
      console.log('[SocketService] Already connected, reusing socket');
      return Promise.resolve(this.socket);
    }

    console.log('[SocketService] Attempting to connect to:', this.url);
    this.updateConnectionState('connecting');

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(this.url, {
        reconnectionAttempts: 3,
        timeout: 10000,
        transports: ['websocket'],
      });
      console.log('[SocketService] io() called, socket instance created:', this.socket ? 'Exists' : 'Null', 'ID before connect event:', this.socket?.id);

      this.socket.on('connect', () => {
        console.log('[SocketService] Connected successfully:', {
          socketId: this.socket?.id,
          timestamp: new Date().toISOString(),
          url: this.url
        });
        this.updateConnectionState('connected');
        this.connectionPromise = null;
        this.connectionStateListeners.forEach(listener => listener('connected'));
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('[SocketService] Connection Error:', error.message, error.stack);
        // this.socket might be null or trying to reconnect based on options
        // If we want to stop further attempts after initial connect_error:
        if (this.socket && !this.socket.active) { // Check if it's not already trying to recover
          this.socket.disconnect();
        }
        this.connectionState = 'disconnected';
        this.connectionPromise = null;
        // Don't reject here if using built-in retries; let 'disconnect' handle final failure.
        // If we want to fail fast for the initial connect() call:
        reject(new Error(`Connection failed: ${error.message}`)); 
        this.connectionStateListeners.forEach(listener => listener('disconnected'));
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`[SocketService] Socket.IO Reconnected after ${attemptNumber} attempts at`, new Date().toISOString());
        this.updateConnectionState('connected');
        this.emit('reconnected_by_library', { attemptNumber });
      });

      this.socket.on('disconnect', (reason: Socket.DisconnectReason) => {
        console.log('[SocketService] Disconnected:', {
          reason,
          timestamp: new Date().toISOString()
        });
        this.updateConnectionState('disconnected');
        if (reason === "io client disconnect") {
          // This was intentional, do nothing further.
        } else {
          console.log('[SocketService] Unexpected disconnect. Socket.IO will attempt to reconnect.');
        }
      });

      this.socket.on('error', (error) => {
        console.error('[SocketService] Socket error:', {
          error,
          timestamp: new Date().toISOString()
        });
        this.emit('error', error);
      });

      this.setupEventHandlers();
    });

    return this.connectionPromise;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[SocketService] Connected successfully:', {
        socketId: this.socket?.id,
        timestamp: new Date().toISOString(),
        url: this.url
      });
      this.updateConnectionState('connected');
      this.emit('connection_established');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[SocketService] Socket.IO Reconnected after ${attemptNumber} attempts at`, new Date().toISOString());
      this.updateConnectionState('connected');
      this.emit('reconnected_by_library', { attemptNumber });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] Connection error:', {
        error: error.message,
        url: this.url,
        timestamp: new Date().toISOString()
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected:', {
        reason,
        timestamp: new Date().toISOString()
      });
      this.updateConnectionState('disconnected');
      if (reason === "io client disconnect") {
        // This was intentional, do nothing further.
      } else {
        console.log('[SocketService] Unexpected disconnect. Socket.IO will attempt to reconnect.');
      }
    });

    this.socket.on('error', (error) => {
      console.error('[SocketService] Socket error:', {
        error,
        timestamp: new Date().toISOString()
      });
      this.emit('error', error);
    });
  }

  // Game-specific methods
  async createRoom(roomCode: string) {
    console.log('[SocketService] Creating room:', { roomCode, timestamp: new Date().toISOString() });
    try {
      const socket = await this.connect();
      if (!socket) {
        throw new Error('Failed to connect socket');
      }
      socket.emit('create_room', { roomCode, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('[SocketService] Failed to create room:', error);
      throw error;
    }
  }

  joinRoom(roomCode: string, playerName: string, isSpectator: boolean = false) {
    console.log('[SocketService] Joining room:', {
      roomCode,
      playerName,
      isSpectator,
      timestamp: new Date().toISOString()
    });
    this.emit('join_room', { roomCode, playerName, isSpectator });
  }

  startGame(roomCode: string, questions: Question[], timeLimit: number): void {
    this.emit('start_game', { roomCode, questions, timeLimit });
  }

  submitAnswer(roomCode: string, answer: string, hasDrawing: boolean = false, drawingData?: string | null) {
    console.log('[SocketService] Submitting answer:', {
      roomCode,
      answerLength: answer.length,
      hasDrawing,
      drawingDataLength: drawingData?.length || 0,
      timestamp: new Date().toISOString()
    });
    this.emit('submit_answer', { roomCode, answer, hasDrawing, drawingData });
  }

  updateBoard(roomCode: string, boardData: any) {
    console.log('[SocketService] Updating board:', {
      roomCode,
      dataSize: boardData?.length || 0,
      timestamp: new Date().toISOString()
    });
    this.emit('update_board', { roomCode, boardData });
  }

  requestGameState(roomCode: string) {
    console.log('[SocketService] Requesting game state:', {
      roomCode,
      timestamp: new Date().toISOString()
    });
    this.emit('get_game_state', { roomCode });
  }

  // Event handling methods
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      console.warn('[SocketService] Attempted to attach listener when socket not connected:', event);
      return;
    }
    this.socket.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (!this.socket) {
      console.warn('[SocketService] Attempted to detach listener when socket not connected:', event);
      return;
    }
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  public emit(event: string, data: any = {}): void {
    if (!this.socket) {
      console.error('[SocketService] Socket not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  // GameMaster actions
  startPreviewMode(roomCode: string) {
    this.emit('start_preview_mode', { roomCode });
  }

  stopPreviewMode(roomCode: string) {
    this.emit('stop_preview_mode', { roomCode });
  }

  focusSubmission(roomCode: string, playerId: string) {
    this.emit('focus_submission', { roomCode, playerId });
  }

  // Player actions
  joinAsSpectator(roomCode: string, playerName: string) {
    console.log(`Joining room ${roomCode} as spectator ${playerName}`);
    this.emit('join_as_spectator', { roomCode, playerName });
  }

  switchToSpectator(roomCode: string, playerId: string) {
    if (this.socket) {
      this.socket.emit('switch_to_spectator', { roomCode, playerId });
    }
  }

  switchToPlayer(roomCode: string, playerName: string) {
    if (this.socket) {
      this.socket.emit('switch_to_player', { roomCode, playerName });
    }
  }

  getSocketId() {
    return this.socket?.id;
  }

  getConnectionState(): 'connected' | 'disconnected' | 'connecting' {
    return this.connectionState;
  }

  disconnect() {
    console.log('[SocketService] Disconnecting');
    this.socket?.disconnect();
    this.socket = null;
    this.updateConnectionState('disconnected');
  }

  // Add missing methods
  nextQuestion(roomCode: string): void {
    this.emit('next_question', { roomCode });
  }

  evaluateAnswer(roomCode: string, playerId: string, isCorrect: boolean): void {
    this.emit('evaluate_answer', { roomCode, playerId, isCorrect });
  }

  endGame(roomCode: string): void {
    this.emit('end_game', { roomCode });
  }

  restartGame(roomCode: string): void {
    this.emit('restart_game', { roomCode });
  }

  endRoundEarly(roomCode: string): void {
    this.emit('end_round_early', { roomCode });
  }

  onError(callback: (error: string) => void): void {
    this.on('error', callback);
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

const socketService = new SocketService();
export default socketService; 
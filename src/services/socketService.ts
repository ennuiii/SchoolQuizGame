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
  private connectionState: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' = 'disconnected';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private connectionStateListeners: ((state: string) => void)[] = [];

  constructor() {
    console.log('[SocketService] Initializing with URL:', SOCKET_URL);
  }

  // Add method to listen for connection state changes
  onConnectionStateChange(callback: (state: string) => void) {
    this.connectionStateListeners.push(callback);
    // Immediately call with current state
    callback(this.connectionState);
  }

  private updateConnectionState(newState: 'connected' | 'disconnected' | 'connecting' | 'reconnecting') {
    this.connectionState = newState;
    this.connectionStateListeners.forEach(listener => listener(newState));
  }

  connect(): Socket | null {
    if (!this.socket) {
      console.log('[SocketService] Attempting to connect to:', SOCKET_URL);
      this.updateConnectionState('connecting');
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 10000,
        forceNew: true,
        withCredentials: true
      });
      
      this.setupEventHandlers();
    }
    return this.socket;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[SocketService] Connected successfully:', {
        socketId: this.socket?.id,
        url: SOCKET_URL,
        timestamp: new Date().toISOString()
      });
      this.updateConnectionState('connected');
      this.reconnectAttempts = 0;
      this.emit('connection_established');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] Connection error:', {
        error: error.message,
        url: SOCKET_URL,
        attempt: this.reconnectAttempts + 1,
        maxAttempts: this.maxReconnectAttempts,
        timestamp: new Date().toISOString()
      });
      this.handleReconnect();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected:', {
        reason,
        timestamp: new Date().toISOString()
      });
      this.updateConnectionState('disconnected');
      this.handleReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('[SocketService] Socket error:', {
        error,
        timestamp: new Date().toISOString()
      });
      this.emit('error', error);
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[SocketService] Max reconnection attempts reached:', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        timestamp: new Date().toISOString()
      });
      this.updateConnectionState('disconnected');
      this.emit('connection_failed');
      return;
    }

    this.reconnectAttempts++;
    this.updateConnectionState('reconnecting');
    console.log(`[SocketService] Attempting to reconnect:`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      timestamp: new Date().toISOString()
    });
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff for reconnection attempts
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.connectionState !== 'connected') {
        console.log('[SocketService] Executing reconnection attempt:', {
          attempt: this.reconnectAttempts,
          delay,
          timestamp: new Date().toISOString()
        });
        this.connect();
      }
    }, delay);
  }

  // Game-specific methods
  createRoom(roomCode?: string) {
    console.log('[SocketService] Creating room:', {
      roomCode: roomCode || 'auto-generated',
      timestamp: new Date().toISOString()
    });
    this.emit('create_room', { roomCode });
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

  submitAnswer(roomCode: string, answer: string, hasDrawing: boolean = false) {
    console.log('[SocketService] Submitting answer:', {
      roomCode,
      answerLength: answer.length,
      hasDrawing,
      timestamp: new Date().toISOString()
    });
    this.emit('submit_answer', { roomCode, answer, hasDrawing });
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
      console.error('[SocketService] Socket not connected');
      return;
    }
    this.socket.on(event, callback);
  }

  off(event: string): void {
    if (!this.socket) {
      console.error('[SocketService] Socket not connected');
      return;
    }
    this.socket.off(event);
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

  getConnectionState(): 'connected' | 'disconnected' | 'connecting' | 'reconnecting' {
    return this.connectionState;
  }

  disconnect() {
    console.log('[SocketService] Disconnecting');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
}

const socketService = new SocketService();
export default socketService; 
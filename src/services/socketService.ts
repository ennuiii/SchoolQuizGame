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

// Define ConnectionStatusType to represent all possible connection states
export type ConnectionStatusType = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'reconnect_failed' | 'error';

// Determine the server URL based on environment
// In production, use the specific backend URL
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://schoolquizgame.onrender.com' // The deployed backend URL
  : 'http://localhost:5000'; // Use port 5000 to match server

// For testing/debugging: force local server during development
// Comment out this line to use production server
const FORCE_LOCAL_SERVER = true;

// Timeout for connection attempts (in milliseconds)
const CONNECTION_TIMEOUT = 10000; // 10 seconds

export class SocketService {
  private socket: Socket | null = null;
  private connectionState: ConnectionStatusType = 'disconnected';
  private connectionPromise: Promise<Socket | null> | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private connectionStateListeners: ((state: string, detailInfo?: any) => void)[] = [];
  private url: string;
  private isReconnecting: boolean = false;

  // New persistent state variables
  private persistentPlayerId: string | null = null;
  private currentSessionPlayerName: string | null = null;
  private tempRoomCodeForGM: string | null = null;
  private tempIsGameMasterQuery: boolean = false;
  private connectionParams: Record<string, any> = {};

  constructor() {
    // Use FORCE_LOCAL_SERVER to override production URLs during development
    this.url = process.env.REACT_APP_SOCKET_URL || 
      (FORCE_LOCAL_SERVER && process.env.NODE_ENV !== 'production' ? 'http://localhost:5000' : SOCKET_URL);
    
    console.log('[SocketService] Initializing with URL:', this.url);
    
    // Load persistent player ID on initialization
    this.loadPersistentPlayerId();
  }

  // Method to set additional connection parameters
  public setConnectionParams(params: Record<string, any>): void {
    this.connectionParams = { ...this.connectionParams, ...params };
  }

  // Private method to load persistentPlayerId from localStorage
  private loadPersistentPlayerId(): void {
    try {
      const storedId = localStorage.getItem('persistentPlayerId_schoolquiz');
      if (storedId) {
        this.persistentPlayerId = storedId;
        console.log('[SocketService] Loaded persistent player ID from localStorage:', storedId);
      }
    } catch (error) {
      console.error('[SocketService] Error loading persistent player ID:', error);
    }
  }

  // Method to set persistentPlayerId in memory and localStorage
  private setPersistentPlayerId(id: string): void {
    if (!id) return;
    
    this.persistentPlayerId = id;
    try {
      localStorage.setItem('persistentPlayerId_schoolquiz', id);
      console.log('[SocketService] Stored persistent player ID in localStorage:', id);
    } catch (error) {
      console.error('[SocketService] Error storing persistent player ID:', error);
    }
  }

  // Getter for persistentPlayerId
  public getPersistentPlayerId(): string | null {
    return this.persistentPlayerId;
  }

  // Method to clear persistentPlayerId
  public clearPersistentPlayerId(): void {
    try {
      localStorage.removeItem('persistentPlayerId_schoolquiz');
      this.persistentPlayerId = null;
      console.log('[SocketService] Cleared persistent player ID');
    } catch (error) {
      console.error('[SocketService] Error clearing persistent player ID:', error);
    }
  }

  // Set player details for connection auth
  public setPlayerDetails(playerName: string): void {
    this.currentSessionPlayerName = playerName;
  }

  // Set GM connection details
  public setGMConnectionDetails(isGM: boolean, roomCode?: string): void {
    this.tempIsGameMasterQuery = isGM;
    this.tempRoomCodeForGM = roomCode || null;
  }

  // Add method to listen for connection state changes
  onConnectionStateChange(callback: (state: string, detailInfo?: any) => void) {
    this.connectionStateListeners.push(callback);
    // Immediately call with current state
    callback(this.connectionState);
  }

  private updateConnectionState(newState: ConnectionStatusType, detailInfo?: any) {
    this.connectionState = newState;
    this.connectionStateListeners.forEach(listener => listener(newState, detailInfo));
  }

  // Force reconnect to fix "Already connected" errors
  async forceReconnect(): Promise<Socket | null> {
    // Perform a clean disconnect first
    console.log('[SocketService] Force reconnecting to clear "Already connected" state...');
    this.isReconnecting = true;
    
    // Complete disconnect first
    if (this.socket) {
      // Properly clean up existing connection
      try {
        const roomCode = localStorage.getItem('roomCode');
        if (roomCode && this.socket.connected) {
          console.log(`[SocketService] Sending leave_room message before force reconnect from room ${roomCode}`);
          this.socket.emit('leave_room', { roomCode });
        }
        
        // Force disconnect
        this.socket.disconnect();
        this.socket = null;
      } catch (error) {
        console.error('[SocketService] Error during force disconnect:', error);
      }
    }
    
    // Reset connection state
    this.connectionPromise = null;
    this.updateConnectionState('disconnected');
    
    // Wait a short delay before reconnecting
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('[SocketService] Disconnected, now reconnecting with fresh connection...');
    this.isReconnecting = false;
    
    // Set parameters for the initial connection to bypass player name requirement
    this.setConnectionParams({ isInitialConnection: true });
    
    // Set a temporary player name for authentication if needed
    this.setPlayerDetails('TemporaryUser');
    
    // Now initiate a new connection
    return this.connect();
  }

  // Connect to socket.io server with CSR
  connect(): Promise<Socket | null> {
    // If we're already connecting, return the existing promise
    if (this.connectionPromise && !this.isReconnecting) {
      console.log('[SocketService] Connection already in progress, reusing promise');
      return this.connectionPromise;
    }

    // If we're already connected, return the existing socket
    if (this.socket?.connected && !this.isReconnecting) {
      console.log('[SocketService] Already connected, reusing socket');
      return Promise.resolve(this.socket);
    }

    console.log('[SocketService] Attempting to connect to:', this.url);
    this.updateConnectionState('connecting');

    // Prepare query parameters for connection - stringify all boolean values
    const queryParams: Record<string, string> = {};
    
    // Convert connectionParams values to strings
    Object.entries(this.connectionParams).forEach(([key, value]) => {
      queryParams[key] = typeof value === 'boolean' ? String(value) : value;
    });
    
    if (this.tempIsGameMasterQuery) {
      queryParams.isGameMaster = "true";
      if (this.tempRoomCodeForGM) {
        queryParams.roomCode = this.tempRoomCodeForGM;
      }
    }

    console.log('[SocketService] Connecting with query params:', queryParams);

    this.connectionPromise = new Promise((resolve, reject) => {
      // Setup connection timeout
      const timeoutId = setTimeout(() => {
        console.error(`[SocketService] Connection attempt timed out after ${CONNECTION_TIMEOUT}ms`);
        this.updateConnectionState('error', { message: 'Connection timeout' });
        if (this.socket) {
          this.socket.disconnect();
        }
        this.connectionPromise = null;
        reject(new Error('Connection timeout'));
      }, CONNECTION_TIMEOUT);

      // Socket.IO client options with CSR support
      this.socket = io(this.url, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        query: queryParams,
        // Authentication callback for CSR
        auth: (cb) => {
          const payload: { persistentPlayerId?: string | null; playerName?: string | null } = {};
          if (this.persistentPlayerId) payload.persistentPlayerId = this.persistentPlayerId;
          if (this.currentSessionPlayerName) payload.playerName = this.currentSessionPlayerName;
          console.log('[SocketService] Auth callback sending:', payload);
          cb(payload);
        }
      });

      // Reset temporary connection parameters
      this.tempIsGameMasterQuery = false;
      this.tempRoomCodeForGM = null;
      this.connectionParams = {}; // Clear connection params after use

      console.log('[SocketService] io() called, socket instance created:', this.socket ? 'Exists' : 'Null', 'ID before connect event:', this.socket?.id);

      // Set up event handlers
      this.socket.on('connect', () => {
        // Clear the timeout since we connected successfully
        clearTimeout(timeoutId);

        console.log('[SocketService] Connected successfully:', {
          socketId: this.socket?.id,
          recovered: this.socket?.recovered,
          timestamp: new Date().toISOString(),
          url: this.url
        });
        this.updateConnectionState('connected', { recovered: this.socket?.recovered });
        this.connectionPromise = null;
        this.setupCommonEventHandlers();
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('[SocketService] Connection Error:', error.message, error.stack);
        
        // Clear the timeout since we got an error response
        clearTimeout(timeoutId);
        
        this.updateConnectionState('error', { message: error.message });
        
        // Check for fatal errors that should cause us to stop reconnecting
        if (error.message.includes('CORS') || 
            error.message.includes('transport error') || 
            error.message.includes('xhr poll error')) {
          // Fatal errors - disconnect and reject the promise
          console.error('[SocketService] Fatal connection error, stopping reconnection attempts');
          if (this.socket) {
            this.socket.disconnect();
          }
          this.connectionPromise = null;
          reject(new Error(`Connection failed: ${error.message}`));
        }
        // For other errors, let Socket.IO's built-in reconnection handle it
      });
    });

    return this.connectionPromise;
  }

  // Setup common event handlers for all connection-related events
  private setupCommonEventHandlers(): void {
    if (!this.socket) return;

    // Disconnect handler
    this.socket.on('disconnect', (reason: Socket.DisconnectReason) => {
      console.log('[SocketService] Disconnected:', {
        reason,
        timestamp: new Date().toISOString()
      });
      
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        // Intentional disconnect - go to disconnected state
        this.updateConnectionState('disconnected', { reason });
        
        // For server-forced disconnects, we shouldn't reconnect automatically
        if (reason === "io server disconnect" && this.socket?.io) {
          this.socket.io.opts.reconnection = false;
        }
      } else {
        // Unexpected disconnect - try to reconnect
        this.updateConnectionState('reconnecting', { reason });
      }
    });

    // Reconnection handlers on the io manager (Socket.IO < 4.0 style)
    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      console.log(`[SocketService] Reconnect attempt #${attempt}`);
      this.updateConnectionState('reconnecting', { attempt });
    });

    this.socket.io.on('reconnect_failed', () => {
      console.log('[SocketService] Reconnection failed after max attempts');
      this.updateConnectionState('reconnect_failed');
    });

    this.socket.io.on('reconnect_error', (error: Error) => {
      console.error('[SocketService] Reconnection error:', error);
    });

    this.socket.io.on('reconnect', (attempt: number) => {
      console.log(`[SocketService] Reconnected after ${attempt} attempts. Socket recovered:`, this.socket?.recovered);
      this.updateConnectionState('connected', { attempt, recovered: this.socket?.recovered });
    });

    // Server error handler
    this.socket.on('error', (error: any) => {
      console.error('[SocketService] Socket error:', {
        error,
        timestamp: new Date().toISOString()
      });
      this.updateConnectionState('error', { error });
    });

    // Handle persistent ID assignment
    this.socket.on('persistent_id_assigned', ({ persistentPlayerId }) => {
      console.log('[SocketService] Received persistent ID assignment:', persistentPlayerId);
      this.setPersistentPlayerId(persistentPlayerId);
    });

    // Handle session recovery failure
    this.socket.on('session_not_fully_recovered_join_manually', () => {
      console.log('[SocketService] Session not fully recovered. Manual rejoin may be needed.');
      // The context will handle this event to attempt a rejoin
    });
  }

  // Robust emit with connection check
  public async robustEmit(event: string, data: any = {}): Promise<void> {
    try {
      const socket = await this.ensureConnected();
      socket.emit(event, data);
    } catch (error) {
      console.error(`[SocketService] Failed to emit ${event}:`, error);
      throw error;
    }
  }

  // Ensure we have a connected socket
  private async ensureConnected(): Promise<Socket> {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.connectionPromise) {
      const socket = await this.connectionPromise;
      if (socket && socket.connected) {
        return socket;
      }
      throw new Error('Connection attempt failed');
    }

    const socket = await this.connect();
    if (socket && socket.connected) {
      return socket;
    }
    throw new Error('Failed to connect');
  }

  // Game-specific methods - now using robustEmit
  async createRoom(roomCode: string, isStreamerMode: boolean = false) {
    console.log('[SocketService] Creating room:', { roomCode, isStreamerMode, timestamp: new Date().toISOString() });
    try {
      await this.robustEmit('create_room', { roomCode, isStreamerMode, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('[SocketService] Failed to create room:', error);
      throw error;
    }
  }

  async joinRoom(roomCode: string, playerName: string, isSpectator: boolean = false) {
    console.log('[SocketService] Joining room:', {
      roomCode,
      playerName,
      isSpectator,
      timestamp: new Date().toISOString()
    });
    
    // Get avatar from localStorage if available
    let avatarSvg: string | null = null;
    const persistentPlayerId = this.getPersistentPlayerId();
    
    if (persistentPlayerId) {
      avatarSvg = localStorage.getItem(`avatar_${persistentPlayerId}`);
    }
    
    await this.robustEmit('join_room', { roomCode, playerName, isSpectator, avatarSvg });
  }

  async startGame(roomCode: string, questions: Question[], timeLimit: number): Promise<void> {
    await this.robustEmit('start_game', { roomCode, questions, timeLimit });
  }

  async submitAnswer(roomCode: string, answer: string, hasDrawing: boolean = false, drawingData?: string | null) {
    console.log('[SocketService] Submitting answer:', {
      roomCode,
      answerLength: answer.length,
      hasDrawing,
      drawingDataLength: drawingData?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    // Generate a unique ID for this answer attempt for idempotency
    const answerAttemptId = this.generateUniqueId();
    
    await this.robustEmit('submit_answer', { 
      roomCode, 
      answer, 
      hasDrawing, 
      drawingData,
      answerAttemptId
    });
  }

  // For high-frequency but non-critical updates, use socket.volatile.emit if connected
  updateBoard(roomCode: string, boardData: any) {
    if (!this.socket?.connected) {
      console.log('[SocketService] Socket not connected, skipping board update');
      return;
    }
    
    // Use volatile emission for board updates to prevent buffering
    this.socket.volatile.emit('update_board', { roomCode, boardData });
  }

  async requestGameState(roomCode: string) {
    console.log('[SocketService] Requesting game state:', {
      roomCode,
      timestamp: new Date().toISOString()
    });
    await this.robustEmit('get_game_state', { roomCode });
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

  // Use robustEmit for all outgoing events
  public async emit(event: string, data: any = {}): Promise<void> {
    await this.robustEmit(event, data);
  }

  // GameMaster actions
  async startPreviewMode(roomCode: string) {
    await this.robustEmit('start_preview_mode', { roomCode });
  }

  async stopPreviewMode(roomCode: string) {
    await this.robustEmit('stop_preview_mode', { roomCode });
  }

  async focusSubmission(roomCode: string, playerId: string) {
    await this.robustEmit('focus_submission', { roomCode, playerId });
  }

  // Player actions
  async joinAsSpectator(roomCode: string, playerName: string) {
    console.log(`Joining room ${roomCode} as spectator ${playerName}`);
    await this.robustEmit('join_as_spectator', { roomCode, playerName });
  }

  async switchToSpectator(roomCode: string, playerId: string) {
    await this.robustEmit('switch_to_spectator', { roomCode, playerId });
  }

  async switchToPlayer(roomCode: string, playerName: string) {
    await this.robustEmit('switch_to_player', { roomCode, playerName });
  }

  getSocketId() {
    return this.socket?.id;
  }

  getConnectionState(): ConnectionStatusType {
    return this.connectionState;
  }

  disconnect() {
    console.log('[SocketService] Disconnecting');
    try {
      // First leave any rooms if we're in any
      if (this.socket?.connected) {
        // Send a graceful leave message
        const roomCode = localStorage.getItem('roomCode');
        if (roomCode) {
          console.log(`[SocketService] Sending leave_room message before disconnecting from room ${roomCode}`);
          this.socket.emit('leave_room', { roomCode });
        }
        
        // Allow some time for the leave_room message to be sent
        setTimeout(() => {
          // Then disconnect
          this.socket?.disconnect();
          this.socket = null;
          this.updateConnectionState('disconnected');
          console.log('[SocketService] Disconnected socket and cleaned up');
        }, 100);
      } else {
        // If not connected, just clean up
        this.socket = null;
        this.updateConnectionState('disconnected');
      }
    } catch (error) {
      console.error('[SocketService] Error during disconnect:', error);
      this.socket = null;
      this.updateConnectionState('disconnected');
    }
  }

  // Helper method to generate a unique ID
  private generateUniqueId(): string {
    const timestamp = new Date().getTime().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${randomPart}`;
  }

  // Add missing methods
  async nextQuestion(roomCode: string): Promise<void> {
    await this.robustEmit('next_question', { roomCode });
  }

  async evaluateAnswer(roomCode: string, playerId: string, isCorrect: boolean): Promise<void> {
    await this.robustEmit('evaluate_answer', { roomCode, playerId, isCorrect });
  }

  async endGame(roomCode: string): Promise<void> {
    await this.robustEmit('end_game', { roomCode });
  }

  async restartGame(roomCode: string): Promise<void> {
    await this.robustEmit('restart_game', { roomCode });
  }

  async endRoundEarly(roomCode: string): Promise<void> {
    await this.robustEmit('end_round_early', { roomCode });
  }

  onError(callback: (error: string) => void): void {
    this.on('error', callback);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  async requestPlayers(roomCode: string): Promise<void> {
    await this.robustEmit('request_players', { roomCode });
  }

  async rejoinRoom(roomCode: string, isGameMaster: boolean = false): Promise<void> {
    // Get avatar from localStorage if available
    let avatarSvg: string | null = null;
    if (this.persistentPlayerId) {
      avatarSvg = localStorage.getItem(`avatar_${this.persistentPlayerId}`);
    }
    
    console.log('[SocketService] Rejoining room with avatar:', {
      roomCode,
      isGameMaster,
      persistentPlayerId: this.persistentPlayerId,
      hasAvatar: !!avatarSvg,
      timestamp: new Date().toISOString()
    });
    
    await this.robustEmit('rejoin_room', { 
      roomCode, 
      isGameMaster, 
      persistentPlayerId: this.persistentPlayerId,
      avatarSvg
    });
  }

  async kickPlayer(roomCode: string, playerIdToKick: string): Promise<void> {
    console.log(`[SocketService] Sending kick_player event for player ${playerIdToKick} in room ${roomCode}`);
    
    // Include the socketId to help server identify which connection to kick
    // when persistent IDs might be the same
    const socketId = this.socket?.id;
    await this.robustEmit('kick_player', { 
      roomCode, 
      playerIdToKick, 
      kickerSocketId: socketId
    });
  }

  // Method to kick player by socket ID directly
  async kickPlayerBySocketId(roomCode: string, playerSocketId: string): Promise<void> {
    console.log(`[SocketService] Kicking player with socket ID ${playerSocketId} in room ${roomCode}`);
    
    // Use the kick_player event directly with the socket ID
    // The server will handle finding the player by socket ID
    await this.robustEmit('kick_player', { 
      roomCode, 
      playerIdToKick: playerSocketId  // Send socket ID instead of persistentPlayerId
    });
  }

  async updateAvatar(roomCode: string, persistentPlayerId: string, avatarSvg: string): Promise<void> {
    console.log('[SocketService] Updating avatar:', {
      roomCode,
      persistentPlayerId,
      hasAvatar: !!avatarSvg,
      timestamp: new Date().toISOString()
    });
    await this.robustEmit('update_avatar', { roomCode, persistentPlayerId, avatarSvg });
  }
}

const socketService = new SocketService();
export default socketService; 
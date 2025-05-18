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

export type ConnectionStatusType = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'reconnect_failed' | 'error';

export class SocketService {
  private socket: Socket | null = null;
  private connectionPromise: Promise<Socket | null> | null = null;
  private connectionStateListeners: ((state: ConnectionStatusType, details?: any) => void)[] = [];
  private url: string;

  // New state for CSR and persistent ID
  private persistentPlayerId: string | null = null;
  private currentSessionPlayerName: string | null = null;
  private tempRoomCodeForGM: string | null = null;
  private tempIsGameMasterQuery: boolean = false;
  private connectionState: ConnectionStatusType = 'disconnected';
  private reconnectAttempts: number = 0;

  constructor() {
    this.url = process.env.REACT_APP_SOCKET_URL || SOCKET_URL;
    console.log('[SocketService] Initializing with URL:', this.url);
    this.loadPersistentPlayerId();
  }

  private loadPersistentPlayerId(): void {
    try {
      const storedId = localStorage.getItem('persistentPlayerId_schoolquiz');
      if (storedId) {
        this.persistentPlayerId = storedId;
        console.log('[SocketService] Loaded persistentPlayerId from localStorage:', storedId);
      }
    } catch (e) {
      console.warn('[SocketService] Could not access localStorage for persistentPlayerId:', e);
    }
  }

  private setPersistentPlayerId(id: string | null): void {
    if (id) {
      this.persistentPlayerId = id;
      try {
        localStorage.setItem('persistentPlayerId_schoolquiz', id);
        console.log('[SocketService] Saved persistentPlayerId to localStorage:', id);
      } catch (e) {
        console.warn('[SocketService] Could not save persistentPlayerId to localStorage:', e);
      }
    } else {
        this.persistentPlayerId = null;
        try {
            localStorage.removeItem('persistentPlayerId_schoolquiz');
        } catch (e) {
            console.warn('[SocketService] Could not remove persistentPlayerId from localStorage:', e);
        }
    }
  }

  public getPersistentPlayerId(): string | null {
    return this.persistentPlayerId;
  }

  public setPlayerDetails(playerName: string): void {
    this.currentSessionPlayerName = playerName;
    console.log('[SocketService] Player details set for auth. Name:', playerName);
  }

  public setGMConnectionDetails(isGM: boolean, roomCode?: string): void {
    this.tempIsGameMasterQuery = isGM;
    this.tempRoomCodeForGM = roomCode || null;
    console.log('[SocketService] GM connection details set for query. IsGM:', isGM, 'RoomCode:', roomCode);
  }

  onConnectionStateChange(callback: (state: ConnectionStatusType, details?: any) => void): () => void {
    this.connectionStateListeners.push(callback);
    callback(this.connectionState); // Immediately call with current state
    return () => {
      this.connectionStateListeners = this.connectionStateListeners.filter(cb => cb !== callback);
    };
  }

  private updateConnectionState(newState: ConnectionStatusType, details?: any): void {
    if (this.connectionState === newState && details === undefined) return; // Avoid redundant updates without new details
    this.connectionState = newState;
    console.log(`[SocketService] Connection state updated to: ${newState}`, details || '');
    this.connectionStateListeners.forEach(listener => listener(newState, details));
  }

  private generateAnswerAttemptId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private async ensureConnected(): Promise<Socket> {
    if (this.socket?.connected) {
      return this.socket;
    }
    if (this.connectionPromise) {
      const socket = await this.connectionPromise;
      if (!socket) throw new Error('Socket connection failed during ensureConnected');
      return socket;
    }
    const socket = await this.connect();
    if (!socket) throw new Error('Socket connection failed during ensureConnected (new attempt)');
    return socket;
  }

  public async robustEmit(event: string, data: any = {}): Promise<void> {
    try {
      const socket = await this.ensureConnected();
      socket.emit(event, data);
      console.log(`[SocketService] RobustEmit sent '${event}'`, data);
    } catch (error) {
      console.error(`[SocketService] RobustEmit failed for event '${event}':`, error, data);
      // Optionally, re-throw or handle specific errors (e.g., notify UI)
      throw error; 
    }
  }
  
  // Volatile emit for non-critical, high-frequency updates
  public async volatileEmitIfConnected(event: string, data: any = {}): Promise<void> {
    if (this.socket?.connected) {
      this.socket.volatile.emit(event, data);
      // console.log(`[SocketService] VolatileEmit sent '${event}'`, data); // Can be too noisy
    } else {
      console.warn(`[SocketService] VolatileEmit skipped for '${event}' (not connected)`);
    }
  }

  connect(): Promise<Socket | null> {
    if (this.connectionPromise) {
      console.log('[SocketService] Connection already in progress, reusing promise');
      return this.connectionPromise;
    }
    if (this.socket?.connected) {
      console.log('[SocketService] Already connected, reusing socket');
      return Promise.resolve(this.socket);
    }

    console.log('[SocketService] Attempting to connect to:', this.url);
    this.updateConnectionState('connecting');

    this.connectionPromise = new Promise((resolve, reject) => {
      const queryParams: { [key: string]: string } = {};
      if (this.tempIsGameMasterQuery) {
        queryParams.isGameMaster = "true";
        if (this.tempRoomCodeForGM) {
          queryParams.roomCode = this.tempRoomCodeForGM;
        }
      }

      // Clean up temp GM details after use
      this.tempIsGameMasterQuery = false;
      this.tempRoomCodeForGM = null;

      this.socket = io(this.url, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000, // Connection timeout
        transports: ['websocket', 'polling'], // Retain polling as fallback
        auth: (cb) => {
          const payload: { persistentPlayerId?: string | null; playerName?: string | null } = {};
          if (this.persistentPlayerId) payload.persistentPlayerId = this.persistentPlayerId;
          if (this.currentSessionPlayerName) payload.playerName = this.currentSessionPlayerName;
          console.log('[SocketService] Auth callback sending:', payload);
          cb(payload);
        },
        query: queryParams
      });

      this.setupCommonEventHandlers(this.socket, resolve, reject);
    });

    return this.connectionPromise;
  }

  private setupCommonEventHandlers(socketInstance: Socket, resolveConnectPromise?: (value: Socket | null) => void, rejectConnectPromise?: (reason?: any) => void) {
    // Clear previous listeners if any (though new socket instance is usually created)
    socketInstance.removeAllListeners();
    if (socketInstance.io) {
        socketInstance.io.removeAllListeners();
    }

    socketInstance.on('connect', () => {
      console.log('[SocketService] Connected successfully:', {
        socketId: socketInstance.id,
        recovered: socketInstance.recovered,
        timestamp: new Date().toISOString(),
      });
      this.updateConnectionState('connected', { recovered: socketInstance.recovered });
      this.connectionPromise = null; 
      if (resolveConnectPromise) resolveConnectPromise(socketInstance);
    });

    socketInstance.on('connect_error', (error: Error) => {
      console.error('[SocketService] Connection Error:', error.message, error.stack);
      this.updateConnectionState('error', { message: error.message });
      // For certain fatal errors, disconnect and reject the initial connection promise
      // Example: if (error.message.includes('Auth failed critical')) { socketInstance.disconnect(); if (rejectConnectPromise) rejectConnectPromise(error); }
      if (rejectConnectPromise) rejectConnectPromise(error); // Let initial connect() call fail for connect_error
      this.connectionPromise = null;
    });

    socketInstance.on('disconnect', (reason: Socket.DisconnectReason, description?: any) => {
      console.log('[SocketService] Disconnected:', { reason, description, timestamp: new Date().toISOString() });
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        this.updateConnectionState('disconnected', { reason });
        if (reason === 'io server disconnect' && socketInstance.io?.opts) {
            // socketInstance.io.opts.reconnection = false; // Example: Stop auto-reconnect on server-side kick
        }
      } else {
        this.updateConnectionState('reconnecting', { reason }); // Assume other reasons lead to reconnection attempts
      }
    });

    // Manager listeners for reconnection events
    if (socketInstance.io) {
      socketInstance.io.on('reconnect_attempt', (attempt) => {
        console.log(`[SocketService] Reconnect attempt ${attempt} at`, new Date().toISOString());
        this.updateConnectionState('reconnecting', { attempt });
      });

      socketInstance.io.on('reconnect_failed', () => {
        console.error('[SocketService] Reconnect failed after maximum attempts.');
        this.updateConnectionState('reconnect_failed');
      });

      socketInstance.io.on('reconnect_error', (error: Error) => {
        console.error('[SocketService] Reconnect error:', error.message);
        // State might remain 'reconnecting' or go to 'error' depending on flow
      });

      socketInstance.io.on('reconnect', (attemptNumber) => {
        console.log(`[SocketService] Reconnected successfully after ${attemptNumber} attempts. Recovered: ${socketInstance.recovered}`);
        // The 'connect' event will also fire, which handles the main logic for state update and persistent ID.
        // We might not need to call updateConnectionState here if 'connect' handles it comprehensively.
        // However, explicit state update here can be good for clarity.
        // this.updateConnectionState('connected', { recovered: socketInstance.recovered, attempts: attemptNumber });
        this.reconnectAttempts = 0;

        // If the connection was recovered, the 'connect' event might have `socketInstance.recovered = true`.
      });
    }

    socketInstance.on('error', (errorData: any) => {
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'Unknown socket error';
      console.error('[SocketService] Socket error event:', message, errorData);
      this.updateConnectionState('error', { message });
      // Propagate this to a general error listener if needed via this.emit('custom_error_event', ...)
    });

    socketInstance.on('persistent_id_assigned', (data: { persistentPlayerId: string }) => {
      if (data.persistentPlayerId) {
        console.log('[SocketService] Received persistent_id_assigned:', data.persistentPlayerId);
        this.setPersistentPlayerId(data.persistentPlayerId);
      } else {
        console.warn('[SocketService] Received persistent_id_assigned but ID was null/undefined.');
      }
    });

    socketInstance.on('session_not_fully_recovered_join_manually', () => {
      console.warn('[SocketService] Received session_not_fully_recovered_join_manually. Client needs to rejoin.');
      this.updateConnectionState('connected', { recoveryStatus: 'needs_manual_join' });
      // Emitting a custom local event or letting contexts handle this via connection state change
    });

    // Generic event proxy to internal event bus (optional, if needed for decoupling contexts from direct socket.on)
    // This is ALREADY handled by the on() / off() / emit() methods of this service if contexts use those.
  }
  
  disconnect(): void {
    if (this.socket) {
      console.log('[SocketService] Disconnecting socket explicitly. ID:', this.socket.id);
      this.socket.disconnect();
      // State update will happen via 'disconnect' event listener
    }
    this.socket = null;
    this.connectionPromise = null;
    this.updateConnectionState('disconnected', { reason: 'client_manual_disconnect' });
  }

  // Game-specific methods using robustEmit
  async createRoom(roomCodeInput?: string) { // roomCode is optional
    const roomCode = roomCodeInput || ''; // Server generates if empty
    console.log('[SocketService] Creating room:', { roomCode, timestamp: new Date().toISOString() });
    await this.robustEmit('create_room', { roomCode });
  }

  async joinRoom(roomCode: string, playerName: string, isSpectator: boolean = false) {
    console.log('[SocketService] Joining room:', { roomCode, playerName, isSpectator });
    this.setPlayerDetails(playerName); // Ensure playerName is set for auth on this connection
    await this.robustEmit('join_room', { roomCode, playerName, isSpectator });
  }

  async startGame(roomCode: string, questions: Question[], timeLimit: number): Promise<void> {
    await this.robustEmit('start_game', { roomCode, questions, timeLimit });
  }

  async submitAnswer(roomCode: string, answer: string, hasDrawing: boolean = false, drawingData?: string | null) {
    const answerAttemptId = this.generateAnswerAttemptId();
    console.log('[SocketService] Submitting answer:', { roomCode, answerLength: answer.length, hasDrawing, drawingDataLength: drawingData?.length, answerAttemptId });
    await this.robustEmit('submit_answer', { roomCode, answer, hasDrawing, drawingData, answerAttemptId });
  }

  async updateBoard(roomCode: string, boardData: any) {
    // Board updates can be frequent; volatile emit if connected, otherwise skip or queue (robustEmit would queue)
    // For simplicity with current plan, let's use robustEmit to ensure it eventually sends or fails clearly.
    // If it becomes a performance issue, switch to volatileEmitIfConnected.
    console.log('[SocketService] Queuing board update (via robustEmit):', { roomCode, dataSize: boardData?.length });
    await this.robustEmit('update_board', { roomCode, boardData });
  }

  async requestGameState(roomCode: string) {
    await this.robustEmit('get_game_state', { roomCode });
  }

  // --- Other emit methods to be updated to use robustEmit ---
  async nextQuestion(roomCode: string): Promise<void> {
    await this.robustEmit('next_question', { roomCode });
  }

  async evaluateAnswer(roomCode: string, playerId: string, isCorrect: boolean): Promise<void> { // playerId should be persistentPlayerId
    await this.robustEmit('evaluate_answer', { roomCode, playerId, isCorrect });
  }

  async endGame(roomCode: string): Promise<void> { // Deprecated or GM only?
      console.warn('[SocketService] endGame called. Ensure this is GM-only or handled by gmEndGameRequest.');
      await this.robustEmit('gm_end_game_request', { roomCode }); // Assuming this is what it should be
  }

  async restartGame(roomCode: string): Promise<void> {
    await this.robustEmit('restart_game', { roomCode });
  }

  async endRoundEarly(roomCode: string): Promise<void> {
    await this.robustEmit('end_round_early', { roomCode });
  }

  async startPreviewMode(roomCode: string) {
    await this.robustEmit('start_preview_mode', { roomCode });
  }

  async stopPreviewMode(roomCode: string) {
    await this.robustEmit('stop_preview_mode', { roomCode });
  }

  async focusSubmission(roomCode: string, playerId: string) { // playerId should be persistentPlayerId
    await this.robustEmit('focus_submission', { roomCode, playerId });
  }
  
  async gmShowRecapToAll(roomCode: string) {
    await this.robustEmit('gm_show_recap_to_all', { roomCode });
  }

  async gmEndGameRequest(roomCode: string) {
    await this.robustEmit('gm_end_game_request', { roomCode });
  }

  async gmNavigateRecapRound(roomCode: string, roundIndex: number) {
    await this.robustEmit('gm_navigate_recap_round', { roomCode, selectedRoundIndex: roundIndex });
  }

  async gmNavigateRecapTab(roomCode: string, tabKey: string) {
    await this.robustEmit('gm_navigate_recap_tab', { roomCode, selectedTabKey: tabKey });
  }

  async kickPlayer(roomCode: string, playerIdToKick: string) { // playerIdToKick is persistentPlayerId
    await this.robustEmit('kick_player', { roomCode, playerIdToKick });
  }
  
  async previewOverlayVersionChanged(version: 'v1' | 'v2') {
      // This event seems to be missing roomCode. Assuming it's broadcast or not room-specific.
      // If room-specific, roomCode needs to be passed here.
      await this.robustEmit('preview_overlay_version_changed', { version }); 
  }

  // Event handling methods (on/off should be used by contexts to listen to events received from server)
  // The existing on/off methods are fine, they attach to the current `this.socket` instance.
  // `setupCommonEventHandlers` handles core lifecycle and specific CSR events.
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      console.warn('[SocketService] Attempted to attach listener when socket not connected:', event);
      // Consider queuing listeners if socket is not yet available, or let connect() handle re-attaching.
      // For now, if called before connect, it might not attach.
      // However, ensureConnected in robustEmit means socket WILL be available when contexts call this after an emit.
      // If contexts call .on() proactively, they should do so after connection or be prepared for no-op.
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

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  getConnectionState(): ConnectionStatusType {
    return this.connectionState;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

const socketService = new SocketService();
export default socketService; 
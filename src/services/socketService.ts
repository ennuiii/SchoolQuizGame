import { io, Socket } from 'socket.io-client';

// Determine the server URL based on environment
// In production, use the specific backend URL
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://schoolquizgame.onrender.com' // The deployed backend URL
  : 'http://localhost:5000'; // Use port 5000 to match server

class SocketService {
  private socket: Socket | null = null;
  private listeners: { [event: string]: ((...args: any[]) => void)[] } = {};
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 2000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' = 'disconnected';
  private connectionStateListeners: ((state: string) => void)[] = [];

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

  connect() {
    if (this.isConnecting) {
      console.log('Socket connection already in progress');
      return this.socket;
    }

    if (!this.socket) {
      console.log(`Connecting to socket server at: ${SOCKET_URL}`);
      this.isConnecting = true;
      this.updateConnectionState('connecting');
      
      this.socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
        timeout: 10000
      });

      // Re-attach existing listeners
      Object.entries(this.listeners).forEach(([event, callbacks]) => {
        callbacks.forEach(callback => {
          this.socket?.on(event, callback);
        });
      });

      // Enhanced connection event handling
      this.socket.on('connect', () => {
        console.log('Socket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.updateConnectionState('connected');
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Attempt to rejoin room with enhanced error handling
        const roomCode = sessionStorage.getItem('roomCode');
        const playerName = sessionStorage.getItem('playerName');
        const isGameMaster = sessionStorage.getItem('isGameMaster') === 'true';
        
        if (roomCode) {
          try {
            if (isGameMaster) {
              this.emit('rejoin_gamemaster', { roomCode });
            } else if (playerName) {
              this.emit('rejoin_player', { roomCode, playerName });
            }
          } catch (error) {
            console.error('Error rejoining room:', error);
            this.handleReconnect();
          }
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.isConnecting = false;
        this.updateConnectionState('disconnected');
        this.handleReconnect();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.updateConnectionState('disconnected');
        
        if (reason === 'io server disconnect' || reason === 'transport close') {
          this.handleReconnect();
        }
      });

      // Add ping timeout handler
      this.socket.on('ping_timeout', () => {
        console.log('Ping timeout - connection unstable');
        this.updateConnectionState('reconnecting');
        this.handleReconnect();
      });
    }
    return this.socket;
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.updateConnectionState('disconnected');
      this.emit('connection_failed');
      return;
    }

    this.reconnectAttempts++;
    this.updateConnectionState('reconnecting');
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff for reconnection attempts
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.connectionState !== 'connected') {
        this.connect();
      }
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (data: any) => void) {
    // Store the callback in the listeners object
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // Attach the callback to the socket
    this.socket?.on(event, (data) => {
      console.log(`[Socket] Received event: ${event}`, data);
      callback(data);
    });
  }

  off(event: string) {
    // Remove all callbacks for this event
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        this.socket?.off(event, callback);
      });
      delete this.listeners[event];
    }
  }

  onError(callback: (error: string) => void) {
    this.socket?.on('error', (error) => {
      console.error('[Socket] Error:', error);
      callback(error);
    });
  }

  emit(event: string, ...args: any[]) {
    console.log(`[Socket] Emitting event: ${event}`, args);
    if (!this.socket?.connected) {
      console.log('Socket not connected, attempting to connect...');
      this.connect();
      // Wait for connection before emitting
      this.socket?.once('connect', () => {
        console.log('Socket connected, emitting event:', event);
        this.socket?.emit(event, ...args);
      });
    } else {
      this.socket.emit(event, ...args);
    }
  }

  // GameMaster actions
  createRoom(roomCode: string) {
    if (!this.socket?.connected) {
      console.log('Socket not connected, attempting to connect before creating room...');
      this.connect();
      this.socket?.once('connect', () => {
        this.emit('create_room', { roomCode });
      });
    } else {
      this.emit('create_room', { roomCode });
    }
  }

  startGame(roomCode: string, questions: any[], timeLimit?: number) {
    if (!this.socket?.connected) {
      console.log('Socket not connected, attempting to connect before starting game...');
      this.connect();
      this.socket?.once('connect', () => {
        this.emit('start_game', { roomCode, questions, timeLimit });
      });
    } else {
      this.emit('start_game', { roomCode, questions, timeLimit });
    }
  }

  restartGame(roomCode: string) {
    this.emit('restart_game', { roomCode });
  }

  evaluateAnswer(roomCode: string, playerId: string, isCorrect: boolean) {
    this.emit('evaluate_answer', { roomCode, playerId, isCorrect });
  }

  nextQuestion(roomCode: string) {
    this.emit('next_question', { roomCode });
  }

  endRoundEarly(roomCode: string) {
    this.emit('end_round_early', { 
      roomCode,
      timestamp: Date.now()
    });
  }

  // Preview Mode actions
  /**
   * These preview mode events are broadcast to all clients in the room.
   * GameMaster triggers, all Players and GameMaster receive.
   */
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
  joinRoom(roomCode: string, playerName: string, isSpectator: boolean = false) {
    if (this.socket) {
      this.socket.emit('join_room', { roomCode, playerName, isSpectator });
    }
  }

  joinAsSpectator(roomCode: string, playerName: string) {
    console.log(`Joining room ${roomCode} as spectator ${playerName}`);
    this.emit('join_as_spectator', { roomCode, playerName });
  }

  submitAnswer(roomCode: string, answer: string, hasDrawing: boolean = false) {
    console.log('Submitting answer:', { roomCode, answer, hasDrawing });
    if (!this.socket?.connected) {
      console.log('Socket not connected, attempting to connect before submitting answer...');
      this.connect();
      this.socket?.once('connect', () => {
        console.log('Socket connected, submitting answer');
        this.socket?.emit('submit_answer', { roomCode, answer, hasDrawing });
      });
    } else {
      console.log('Socket connected, submitting answer directly');
      this.socket.emit('submit_answer', { roomCode, answer, hasDrawing });
    }
  }
  
  // Board update function
  updateBoard(roomCode: string, boardData: string) {
    console.log(`Updating board for room ${roomCode}`);
    if (!this.socket?.connected) {
      console.log('Socket not connected, attempting to connect before updating board...');
      this.connect();
      this.socket?.once('connect', () => {
        console.log('Socket connected, sending board update');
        this.emit('update_board', { roomCode, boardData });
      });
    } else {
      console.log('Socket connected, sending board update directly');
      this.emit('update_board', { roomCode, boardData });
    }
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

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService; 
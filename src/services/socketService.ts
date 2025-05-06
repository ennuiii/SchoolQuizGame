import { io, Socket } from 'socket.io-client';

// Determine the server URL based on environment
// In production, use the specific backend URL
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://schoolquizgame.onrender.com' // The deployed backend URL
  : 'http://localhost:5000'; // Use port 5000 to match server

class SocketService {
  private socket: Socket | null = null;
  private listeners: { [event: string]: ((...args: any[]) => void)[] } = {};

  connect() {
    if (!this.socket) {
      console.log(`Connecting to socket server at: ${SOCKET_URL}`);
      this.socket = io(SOCKET_URL);
      
      // Re-attach existing listeners
      Object.entries(this.listeners).forEach(([event, callbacks]) => {
        callbacks.forEach(callback => {
          this.socket?.on(event, callback);
        });
      });
      
      // Add connection event logging
      this.socket.on('connect', () => {
        console.log('Socket connected successfully');
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback && this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(c => c !== callback);
      this.socket?.off(event, callback);
    } else {
      delete this.listeners[event];
      this.socket?.off(event);
    }
  }

  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }

  // GameMaster actions
  createRoom(roomCode: string) {
    this.emit('create_room', { roomCode });
  }

  startGame(roomCode: string, questions: any[], timeLimit?: number) {
    this.emit('start_game', { roomCode, questions, timeLimit });
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

  // Player actions
  joinRoom(roomCode: string, playerName: string) {
    console.log(`Joining room ${roomCode} as ${playerName}`);
    this.emit('join_room', { roomCode, playerName });
  }

  submitAnswer(roomCode: string, answer: any) {
    this.emit('submit_answer', { roomCode, answer });
  }
  
  // Board update function - missing function that was causing the build error
  updateBoard(roomCode: string, boardData: string) {
    this.emit('board_update', { roomCode, boardData });
  }
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService; 
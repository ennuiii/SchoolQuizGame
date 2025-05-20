import { Socket } from 'socket.io';

// Custom socket type that includes roomCode property
export interface CustomSocket extends Socket {
  roomCode?: string;
  data: {
    isGameMaster?: boolean;
    playerName?: string;
    persistentPlayerId?: string;
    isWebRTCReady?: boolean;
    [key: string]: any;
  };
}

// Player interface
export interface Player {
  id: string;
  persistentPlayerId: string;
  name: string;
  lives: number;
  answers: Array<AnswerSubmission | undefined>;
  isActive: boolean;
  isSpectator?: boolean;
  joinedAsSpectator?: boolean;
  disconnectTimer: NodeJS.Timeout | null;
  avatarSvg?: string | null;
}

// Question interface
export interface Question {
  id: string;
  text: string;
  type: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

// Game Room interface
export interface GameRoom {
  roomCode: string;
  gamemaster: string | null;
  gamemasterSocketId: string | null;
  gamemasterPersistentId: string;
  gamemasterDisconnected: boolean;
  gamemasterDisconnectTimer: NodeJS.Timeout | null;
  gamemasterDisconnectTime?: string;
  players: Player[];
  started: boolean;
  questions: Question[];
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  timeLimit: number | null;
  questionStartTime: number | null;
  roundAnswers: Record<string, AnswerSubmission>;
  evaluatedAnswers: Record<string, boolean>;
  playerBoards: Record<string, PlayerBoard>;
  submissionPhaseOver: boolean;
  isConcluded: boolean;
  isStreamerMode: boolean;
  createdAt: string;
  lastActivity: string;
}

// Game State interface (for client)
export interface GameState {
  started: boolean;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  timeLimit: number | null;
  questionStartTime: number | null;
  players: Player[];
  roundAnswers: Record<string, any>;
  evaluatedAnswers: Record<string, boolean>;
  submissionPhaseOver: boolean;
  isConcluded: boolean;
  playerBoards: Record<string, any>;
}

// Player Board interface
export interface PlayerBoard {
  boardData: string;
  roundIndex: number;
  timestamp: number;
  persistentPlayerId?: string;
  playerName?: string;
}

// Answer Submission interface
export interface AnswerSubmission {
  playerId: string;
  answer: string;
  timestamp: number;
  submissionTime: number;
  isEvaluated?: boolean;
  isCorrect?: boolean;
  hasDrawing?: boolean;
  drawingData?: string | null;
}

// Log Entry interface
export interface LogEntry {
  eventType: string;
  timestamp: string;
  details: any;
}

// Room state for persistence
export interface RoomState {
  roomCode: string;
  gamemasterPersistentId: string;
  players: Player[];
  started: boolean;
  questions: Question[];
  currentQuestionIndex: number;
  timeLimit: number | null;
  questionStartTime: number | null;
  isStreamerMode: boolean;
  isConcluded: boolean;
  lastSaved: string;
}

// For player statistics tracking
export interface AnswerStats {
  answer: string;
  isCorrect: boolean;
  responseTime: number;
}

// Player stats for game analytics
export interface PlayerStats {
  id: string;
  name: string;
  joinTime: Date;
  answers: AnswerStats[];
  correctAnswers: number;
  averageResponseTime: number;
}

// Game statistics
export interface GameStats {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  players: PlayerStats[];
  rounds: any[]; // Can be expanded based on the need
  totalQuestions: number;
  totalAnswers: number;
  correctAnswers: number;
  averageResponseTime: number;
  finalStats?: GameFinalStats;
}

// Final game statistics
export interface GameFinalStats {
  totalPlayers: number;
  averageScore: number;
  fastestPlayer: PlayerStats | null;
  mostAccuratePlayer: (PlayerStats & { accuracy: number }) | null;
}

// Game analytics service interface
export interface GameAnalytics {
  games: Record<string, GameStats>;
  addGame(roomCode: string): void;
  addPlayer(roomCode: string, player: Player): void;
  recordAnswer(roomCode: string, playerId: string, answer: string, isCorrect: boolean | null, responseTime: number): void;
  endGame(roomCode: string): GameFinalStats | undefined;
  getGameStats(roomCode: string): GameStats | undefined;
}

// Game Recap interface
export interface GameRecap {
  roomCode: string;
  startTime?: Date | string;
  endTime: Date | string;
  players: RecapPlayer[];
  rounds: RecapRound[];
}

// Recap Player interface
export interface RecapPlayer {
  id: string;
  persistentPlayerId: string;
  name: string;
  finalLives: number;
  isSpectator: boolean;
  isActive: boolean;
  isWinner?: boolean;
}

// Recap Round interface
export interface RecapRound {
  roundNumber: number;
  question: Question;
  submissions: RecapSubmission[];
}

// Recap Submission interface
export interface RecapSubmission {
  playerId: string;
  persistentPlayerId: string;
  playerName: string;
  answer: string | null;
  hasDrawing: boolean;
  drawingData: string | null;
  isCorrect: boolean | null;
} 
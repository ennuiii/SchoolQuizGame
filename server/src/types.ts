import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

// Basic type definitions
export interface Question {
  id: string;
  text: string;
  type: 'text' | 'drawing';
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

export interface PlayerAnswer {
  playerId: string;
  persistentPlayerId: string;
  playerName: string;
  answer: string;
  hasDrawing: boolean;
  drawingData?: string | null;
  timestamp: number;
  isCorrect: boolean | null;
  answerAttemptId?: string | null;
  submissionOrder?: number;
  submissionTime?: number;
  pointsAwarded?: number | null;
  pointsBreakdown?: any | null;
}

export interface Player {
  id: string; 
  persistentPlayerId: string;
  name: string;
  lives: number;
  score: number;
  streak: number;
  position: number | null;
  lastPointsEarned: number | null;
  lastAnswerTimestamp: number | null;
  isActive: boolean;
  isSpectator: boolean;
  isEliminated: boolean; // Track if player is eliminated but chose to stay
  joinedAsSpectator: boolean;
  disconnectTimer: NodeJS.Timeout | null;
  answers: PlayerAnswer[];
  avatarSvg?: string | null;
}

export interface PlayerBoardEntry {
  boardData: string;
  roundIndex?: number;
  timestamp?: number;
  playerId?: string;
  persistentPlayerId?: string;
}

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
  roundAnswers: Record<string, PlayerAnswer>;
  evaluatedAnswers: Record<string, boolean>;
  playerBoards: Record<string, PlayerBoardEntry>;
  submissionPhaseOver: boolean;
  isConcluded: boolean;
  isStreamerMode: boolean;
  isPointsMode: boolean;
  answeredPlayersCorrectly: string[];
  createdAt: string;
  lastActivity: string;
  isCommunityVotingMode?: boolean;
  gameMasterBoardData?: string | null;
  votes?: Record<string, Record<string, 'correct' | 'incorrect'>>;
  // Life restoration tracking
  roundStartLives?: Record<string, number>; // Track lives at start of round for each player
  lifeRestoreOffered?: boolean; // Track if restore has been offered this round
  // Submission order tracking
  currentSubmissionCounter?: number; // Atomic counter for submission order
}

export interface GameState {
  started: boolean;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  timeLimit: number | null;
  questionStartTime: number | null;
  players: Player[];
  roundAnswers: Record<string, PlayerAnswer>;
  evaluatedAnswers: Record<string, boolean>;
  submissionPhaseOver: boolean;
  isConcluded: boolean;
  playerBoards: Record<string, any>;
  isCommunityVotingMode?: boolean;
  isPointsMode?: boolean;
  gameMasterBoardData?: string | null;
  currentVotes?: Record<string, Record<string, 'correct' | 'incorrect'>>;
}

export interface GameRecap {
  roomCode: string;
  startTime: Date | string;
  endTime: Date | string;
  isPointsMode?: boolean; // Include points mode flag
  players: RecapPlayer[];
  rounds: RecapRound[];
  initialSelectedRoundIndex?: number;
  initialSelectedTabKey?: string;
}

export interface RecapPlayer {
  id: string;
  persistentPlayerId: string;
  name: string;
  finalLives: number;
  finalScore?: number; // Include final score for points mode
  finalStreak?: number; // Include final streak for points mode
  isSpectator: boolean;
  isActive: boolean;
  isWinner: boolean;
}

export interface RecapRound {
  roundNumber: number;
  question: Question;
  submissions: RecapSubmission[];
}

export interface RecapSubmission {
  playerId: string;
  persistentPlayerId: string;
  playerName: string;
  answer: string | null;
  hasDrawing: boolean;
  drawingData: string | null;
  isCorrect: boolean | null;
  pointsAwarded?: number; // Include points awarded for this submission
  pointsBreakdown?: any; // Include points breakdown data
}

// Game Analytics
export interface GameAnalyticsPlayer {
  id: string;
  name: string;
  joinTime: Date;
  answers: {
    answer: string;
    isCorrect: boolean;
    responseTime: number;
  }[];
  correctAnswers: number;
  averageResponseTime: number;
  accuracy?: number;
}

export interface GameAnalyticsData {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  players: GameAnalyticsPlayer[];
  rounds: any[];
  totalQuestions: number;
  averageResponseTime: number;
  correctAnswers: number;
  totalAnswers: number;
  finalStats?: any;
}

export interface SocketData {
  persistentPlayerId?: string;
  playerName?: string;
  isGameMaster?: boolean;
  reconnecting?: boolean;
  isWebRTCReady?: boolean;
}

// Define the socket with proper type parameters
export interface ExtendedSocket extends Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  roomCode?: string;
  recovered: boolean;
}

export interface ServerToClientEvents {
  game_state_update: (state: GameState) => void;
  room_created: (data: { roomCode: string, isStreamerMode: boolean }) => void;
  room_joined: (data: { roomCode: string, playerId: string, isStreamerMode: boolean }) => void;
  game_started: (data: { question: Question, timeLimit: number }) => void;
  timer_update: (data: { timeRemaining: number }) => void;
  time_up: () => void;
  answer_received: (data: { status: string, message: string }) => void;
  board_update: (data: { playerId: string, playerName: string, boardData: string }) => void;
  player_reconnected_status: (data: { playerId: string, persistentPlayerId: string, isActive: boolean }) => void;
  gm_disconnected_status: (data: { disconnected: boolean, temporary?: boolean }) => void;
  player_disconnected_status: (data: { playerId: string, persistentPlayerId: string, isActive: boolean, temporary?: boolean }) => void;
  game_restarted: (data: { roomCode: string }) => void;
  new_question: (data: { question: Question, timeLimit: number }) => void;
  players_update: (players: Player[]) => void;
  player_left_gracefully: (data: { playerId: string, persistentPlayerId: string, playerName: string }) => void;
  player_removed_after_timeout: (data: { playerId: string, persistentPlayerId: string, playerName: string }) => void;
  kicked_from_room: (data: { roomCode: string, reason: string }) => void;
  room_not_found: (data: { message: string }) => void;
  error: (error: string | { message: string }) => void;
  become_spectator: () => void;
  persistent_id_assigned: (data: { persistentPlayerId: string }) => void;
  session_not_fully_recovered_join_manually: () => void;
  avatar_updated: (data: { persistentPlayerId: string, avatarSvg: string }) => void;
  avatar_update_error: (data: { message: string }) => void;
  game_over_pending_recap: (data: { roomCode: string, winner: { id: string, persistentPlayerId: string, name: string } | null }) => void;
  game_recap: (data: GameRecap & { initialSelectedRoundIndex?: number, initialSelectedTabKey?: string }) => void;
  recap_round_changed: (data: { selectedRoundIndex: number }) => void;
  recap_tab_changed: (data: { selectedTabKey: string }) => void;
  start_preview_mode: () => void;
  stop_preview_mode: () => void;
  focus_submission: (data: { playerId: string }) => void;
  game_over: (data: { reason: string }) => void;
  // WebRTC signaling
  'webrtc-existing-peers': (data: { peers: Array<{ socketId: string, persistentPlayerId: string, playerName: string, isGameMaster: boolean }> }) => void;
  'webrtc-new-peer': (data: { newPeer: { socketId: string, persistentPlayerId: string, playerName: string, isGameMaster: boolean } }) => void;
  'webrtc-user-left': (data: { socketId: string }) => void;
  'webrtc-offer': (data: { offer: any, from: string }) => void;
  'webrtc-answer': (data: { answer: any, from: string }) => void;
  'webrtc-ice-candidate': (data: { candidate: any, from: string }) => void;
  'webrtc-refresh-states': (data: { timestamp: number }) => void;
  'webcam-state-change': (data: { fromSocketId: string, enabled: boolean }) => void;
  'microphone-state-change': (data: { fromSocketId: string, enabled: boolean }) => void;
  community_voting_status_changed: (data: { isCommunityVotingMode: boolean }) => void;
  points_mode_status_changed: (data: { isPointsMode: boolean }) => void;
  answer_voted: (data: { answerId: string, voterId: string, vote: 'correct' | 'incorrect', voteCounts: { correct: number, incorrect: number } }) => void;
  correct_answer_revealed: (data: { questionId: string, correctAnswer: string }) => void;
  all_votes_submitted: (data: { message: string }) => void;
  gm_community_answer_accepted: (data: { questionId: string }) => void;
  player_kicked: (data: { playerId: string, persistentPlayerId: string, playerName: string, wasDisconnected: boolean }) => void;
  life_restore_prompt: (data: { roomCode: string, affectedPlayers: Array<{ persistentPlayerId: string, name: string, livesLost: number }> }) => void;
  lives_restored: (data: { roomCode: string, restoredPlayers: Array<{ persistentPlayerId: string, name: string, livesRestored: number }> }) => void;
  // Elimination choice events
  elimination_choice_prompt: (data: { roomCode: string }) => void;
  player_eliminated_status: (data: { playerId: string, persistentPlayerId: string, isEliminated: boolean, isSpectator?: boolean, isActive?: boolean }) => void;
}

export interface ClientToServerEvents {
  create_room: (data: { roomCode?: string, isStreamerMode?: boolean, isPointsMode?: boolean }) => void;
  join_room: (data: { roomCode: string, playerName: string, isSpectator?: boolean, avatarSvg?: string }) => void;
  start_game: (data: { roomCode: string, questions: Question[], timeLimit: number }) => void;
  submit_answer: (data: { roomCode: string, answer: string, hasDrawing?: boolean, drawingData?: string, answerAttemptId?: string }) => void;
  update_board: (data: { roomCode: string, boardData: string }) => void;
  get_game_state: (data: { roomCode: string }) => void;
  next_question: (data: { roomCode: string }) => void;
  evaluate_answer: (data: { roomCode: string, playerId: string, isCorrect: boolean }) => void;
  end_round_early: (data: { roomCode: string }) => void;
  start_preview_mode: (data: { roomCode: string }) => void;
  stop_preview_mode: (data: { roomCode: string }) => void;
  focus_submission: (data: { roomCode: string, playerId: string }) => void;
  restart_game: (data: { roomCode: string }) => void;
  request_players: (data: { roomCode: string }) => void;
  kick_player: (data: { roomCode: string, playerIdToKick: string, kickerSocketId?: string }) => void;
  kick_player_by_socket: (data: { roomCode: string, playerSocketId: string, kickerSocketId: string }) => void;
  rejoin_room: (data: { roomCode: string, isGameMaster?: boolean, persistentPlayerId?: string, avatarSvg?: string }) => void;
  update_avatar: (data: { roomCode: string, persistentPlayerId: string, avatarSvg: string }) => void;
  gm_end_game_request: (data: { roomCode: string }) => void;
  gm_show_recap_to_all: (data: { roomCode: string }) => void;
  gm_navigate_recap_round: (data: { roomCode: string, selectedRoundIndex: number }) => void;
  gm_navigate_recap_tab: (data: { roomCode: string, selectedTabKey: string }) => void;
  // WebRTC signaling
  'webrtc-ready': (data: { roomCode: string }) => void;
  'webrtc-offer': (data: { offer: any, to: string, from: string }) => void;
  'webrtc-answer': (data: { answer: any, to: string, from: string }) => void;
  'webrtc-ice-candidate': (data: { candidate: any, to: string, from: string }) => void;
  toggle_community_voting: (data: { roomCode: string, isCommunityVotingMode: boolean }) => void;
  toggle_points_mode: (data: { roomCode: string, isPointsMode: boolean }) => void;
  submit_vote: (data: { roomCode: string, answerId: string, vote: 'correct' | 'incorrect' }) => void;
  show_answer: (data: { roomCode: string, questionId: string }) => void;
  update_game_master_board: (data: { roomCode: string, boardData: string }) => void;
  clear_game_master_board: (data: { roomCode: string }) => void;
  'webcam-state-change': (data: { roomCode: string, enabled: boolean, fromSocketId: string }) => void;
  'microphone-state-change': (data: { roomCode: string, enabled: boolean, fromSocketId: string }) => void;
  force_end_voting: (data: { roomCode: string }) => void;
  adjust_player_lives: (data: { roomCode: string; playerId: string; adjustment: number }) => void;
  'webrtc-refresh-states': (data: { timestamp: number }) => void;
  // Life restoration events
  restore_round_lives: (data: { roomCode: string }) => void;
  // Elimination choice events
  elimination_choice_response: (data: { roomCode: string, becomeSpectator: boolean }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export type GameRooms = Record<string, GameRoom>;

// Game Analytics Interface
export interface GameAnalytics {
  games: Record<string, GameAnalyticsData>;
  addGame(roomCode: string): void;
  addPlayer(roomCode: string, player: Player): void;
  recordAnswer(roomCode: string, playerId: string, answer: string, isCorrect: boolean | null, responseTime: number): void;
  endGame(roomCode: string): any;
  getGameStats(roomCode: string): GameAnalyticsData | undefined;
}

// Types for persistent room state (room-state.json)
export interface SimplifiedPlayer {
  persistentPlayerId: string;
  name: string;
  lives: number;
  isActive: boolean;
  isSpectator: boolean;
  joinedAsSpectator: boolean;
  answers: PlayerAnswer[]; // Or a simplified version if needed
}

export interface SimplifiedRoom {
  roomCode: string;
  gamemasterPersistentId: string;
  players: SimplifiedPlayer[];
  started: boolean;
  questions: Question[];
  currentQuestionIndex: number;
  timeLimit: number | null;
  questionStartTime: number | null; // Serialized as number (Date.now()) or string (ISO)
  isStreamerMode: boolean;
  isConcluded: boolean;
  lastSaved: string; // ISOString
}

export type SavedRoomsState = Record<string, SimplifiedRoom>;

// Consistent WinnerInfo Type for game conclusion
export interface WinnerInfo {
  id: string;
  persistentPlayerId: string;
  name: string;
} 
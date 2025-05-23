export interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

export interface Player {
  id: string;
  persistentPlayerId: string;
  name: string;
  lives: number;
  answers: {
    playerId: string;
    persistentPlayerId: string;
    playerName: string;
    answer: string;
    hasDrawing: boolean;
    drawingData?: string | null;
    timestamp: number;
    isCorrect: boolean | null;
    answerAttemptId?: string | null;
  }[];
  isActive: boolean;
  isSpectator: boolean;
}

export interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
  timestamp?: number;
  roundIndex?: number;
}

export interface AnswerSubmission {
  persistentPlayerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
  hasDrawing?: boolean;
  drawingData?: string | null;
}

export interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

export interface GameState {
  roomCode: string;
  players: Player[];
  currentRound: number;
  isGameStarted: boolean;
  isGameEnded: boolean;
  currentQuestion?: Question;
  roundAnswers?: Record<string, AnswerSubmission>;
  evaluatedAnswers?: Record<string, boolean>;
  playerBoards?: Record<string, PlayerBoard>;
  previewMode?: PreviewModeState;
} 
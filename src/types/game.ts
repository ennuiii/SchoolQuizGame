export interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

export interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

export interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
  hasDrawing: boolean;
}

export interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

export interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

export interface ReviewNotificationProps {
  answer: string;
  isCorrect: boolean;
  timestamp: number;
  onClose: () => void;
  message?: string;
}

export interface PlayerListProps {
  players: Player[];
  onPlayerClick: (playerId: string) => void;
  selectedPlayerId: string | null;
  title?: string;
  onPlayerSelect?: (playerId: string) => void;
}

export interface PlayerBoardDisplayProps {
  board: PlayerBoard;
  isVisible?: boolean;
  isFocused?: boolean;
  onToggleVisibility?: (playerId: string) => void;
  transform?: { scale: number; x: number; y: number };
  onScale?: (playerId: string, scale: number) => void;
  onPan?: (playerId: string, dx: number, dy: number) => void;
  onReset?: (playerId: string) => void;
}

export interface PreviewOverlayProps {
  players: Player[];
  playerBoards: PlayerBoard[];
  allAnswersThisRound: Record<string, AnswerSubmission>;
  evaluatedAnswers: Record<string, boolean | null>;
  previewMode: PreviewModeState;
  onFocus: (playerId: string) => void;
  onClose: () => void;
  isGameMaster?: boolean;
}

export interface GameState {
  roomCode: string | null;
  playerName: string | null;
  isSpectator: boolean;
  gameStarted: boolean;
  currentQuestion: string | null;
  players: Player[];
  playerBoards: PlayerBoard[];
  answers: Record<string, AnswerSubmission>;
  evaluatedAnswers: Record<string, boolean | null>;
  timeLeft: number | null;
  isTimerRunning: boolean;
  error: string | null;
  previewMode: boolean;
  focusedSubmission: string | null;
} 
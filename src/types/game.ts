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

export interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

export interface ReviewNotificationProps {
  answer: string;
  isCorrect: boolean;
  timestamp: number;
  onClose: () => void;
}

export interface PlayerListProps {
  players: Player[];
  onPlayerClick: (playerId: string) => void;
  selectedPlayerId?: string | null;
}

export interface PreviewOverlayProps {
  players: Player[];
  playerBoards: PlayerBoard[];
  allAnswersThisRound: Record<string, AnswerSubmission>;
  evaluatedAnswers: Record<string, boolean>;
  focusedPlayerId: string | null;
  onClose: () => void;
} 
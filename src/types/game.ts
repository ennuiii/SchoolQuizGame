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
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

export interface PlayerBoard {
  playerId: string;
  persistentPlayerId: string;
  playerName: string;
  boardData: string;
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
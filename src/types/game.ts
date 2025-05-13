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
  timestamp?: number;
}

export interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
} 
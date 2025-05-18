// src/types/recap.ts

// This QuestionInRecap should align with the Question type from GameContext
// and what the server includes in the recap.
export interface QuestionInRecap {
  id: string; // From the original Question object
  text: string;
  type: 'text' | 'drawing';
  answer: string; // Server provides the actual answer in the recap
  grade: number;  // Aligning with GameContext.Question (source) which is number
  subject: string;
  // language?: string; // Add if present in server's question object within recap & needed
}

export interface SubmissionInRecap {
  playerId: string;
  persistentPlayerId: string;
  playerName: string;
  answer: string | null;
  hasDrawing: boolean;
  drawingData: string | null; // This is typically a string (e.g., SVG or data URL)
  isCorrect: boolean | null;
}

export interface RoundInRecap {
  roundNumber: number;
  question: QuestionInRecap;
  submissions: SubmissionInRecap[];
  // TODO: Server's generateGameRecap in server/index.js needs to be updated
  // to include correctAnswers and totalAnswers for each round.
  // RecapModal.tsx uses these to display "X / Y correct".
  // For now, these fields are omitted to match current server output.
  // correctAnswers?: number;
  // totalAnswers?: number;
}

export interface PlayerInRecap {
  id: string;
  persistentPlayerId: string;
  name: string;
  finalLives: number;
  isSpectator: boolean;
  isWinner: boolean;
  isActive: boolean;
  joinedAsSpectator?: boolean;
  // TODO: Server's generateGameRecap in server/index.js needs to be updated
  // to include a score for each player if desired in the recap.
  // RecapModal.tsx might have displayed this.
  // score?: number;
}

export interface GameRecapData {
  roomCode: string;
  startTime: string; // Dates from server are typically strings, convert on client with new Date()
  endTime: string;   // Dates from server are typically strings, convert on client with new Date()
  players: PlayerInRecap[];
  rounds: RoundInRecap[];
  // TODO: Server's generateGameRecap in server/index.js needs to be updated
  // to include overall game statistics like total correct answers, total questions,
  // if these are desired directly on the recap object.
  // correctAnswers?: number;
  // totalQuestions?: number;
  // score?: number; // Overall game score or similar metric
} 
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import socketService from '../services/socketService';
import { GameState, Player, PlayerBoard, AnswerSubmission } from '../types/game';

type GameAction =
  | { type: 'SET_ROOM_CODE'; payload: string }
  | { type: 'SET_PLAYER_NAME'; payload: string }
  | { type: 'SET_SPECTATOR'; payload: boolean }
  | { type: 'SET_GAME_STARTED'; payload: boolean }
  | { type: 'SET_CURRENT_QUESTION'; payload: string }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'SET_PLAYER_BOARDS'; payload: PlayerBoard[] }
  | { type: 'ADD_ANSWER_SUBMISSION'; payload: AnswerSubmission }
  | { type: 'SET_TIME_LEFT'; payload: number }
  | { type: 'SET_TIMER_RUNNING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_PREVIEW_MODE'; payload: boolean }
  | { type: 'SET_FOCUSED_SUBMISSION'; payload: string }
  | { type: 'RESET_GAME' };

const initialState: GameState = {
  roomCode: null,
  playerName: null,
  isSpectator: false,
  gameStarted: false,
  currentQuestion: null,
  players: [],
  playerBoards: [],
  answers: {},
  evaluatedAnswers: {},
  timeLeft: null,
  isTimerRunning: false,
  error: null,
  previewMode: false,
  focusedSubmission: null
};

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'SET_ROOM_CODE':
      return { ...state, roomCode: action.payload };
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.payload };
    case 'SET_SPECTATOR':
      return { ...state, isSpectator: action.payload };
    case 'SET_GAME_STARTED':
      return { ...state, gameStarted: action.payload };
    case 'SET_CURRENT_QUESTION':
      return { ...state, currentQuestion: action.payload };
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'SET_PLAYER_BOARDS':
      return { ...state, playerBoards: action.payload };
    case 'ADD_ANSWER_SUBMISSION':
      return {
        ...state,
        answers: { ...state.answers, [action.payload.playerId]: action.payload }
      };
    case 'SET_TIME_LEFT':
      return { ...state, timeLeft: action.payload };
    case 'SET_TIMER_RUNNING':
      return { ...state, isTimerRunning: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PREVIEW_MODE':
      return { ...state, previewMode: action.payload };
    case 'SET_FOCUSED_SUBMISSION':
      return { ...state, focusedSubmission: action.payload };
    case 'RESET_GAME':
      return initialState;
    default:
      return state;
  }
};

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}; 
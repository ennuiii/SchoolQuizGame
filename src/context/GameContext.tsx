import React, { createContext, useContext, useReducer, useEffect } from 'react';
import socketService from '../services/socketService';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
  hasDrawing: boolean;
}

interface GameState {
  roomCode: string;
  playerName: string;
  isSpectator: boolean;
  gameStarted: boolean;
  currentQuestion: string | null;
  players: Player[];
  playerBoards: PlayerBoard[];
  allAnswersThisRound: Record<string, AnswerSubmission>;
  evaluatedAnswers: Record<string, boolean>;
  timeRemaining: number | null;
  isTimerRunning: boolean;
  errorMsg: string;
}

type GameAction =
  | { type: 'SET_ROOM_CODE'; payload: string }
  | { type: 'SET_PLAYER_NAME'; payload: string }
  | { type: 'SET_SPECTATOR'; payload: boolean }
  | { type: 'SET_GAME_STARTED'; payload: boolean }
  | { type: 'SET_CURRENT_QUESTION'; payload: string | null }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'UPDATE_PLAYER_BOARDS'; payload: PlayerBoard[] }
  | { type: 'UPDATE_ANSWERS'; payload: Record<string, AnswerSubmission> }
  | { type: 'UPDATE_EVALUATED_ANSWERS'; payload: Record<string, boolean> }
  | { type: 'SET_TIME_REMAINING'; payload: number | null }
  | { type: 'SET_TIMER_RUNNING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET_GAME' };

const initialState: GameState = {
  roomCode: '',
  playerName: '',
  isSpectator: false,
  gameStarted: false,
  currentQuestion: null,
  players: [],
  playerBoards: [],
  allAnswersThisRound: {},
  evaluatedAnswers: {},
  timeRemaining: null,
  isTimerRunning: false,
  errorMsg: ''
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
    case 'UPDATE_PLAYERS':
      return { ...state, players: action.payload };
    case 'UPDATE_PLAYER_BOARDS':
      return { ...state, playerBoards: action.payload };
    case 'UPDATE_ANSWERS':
      return { ...state, allAnswersThisRound: action.payload };
    case 'UPDATE_EVALUATED_ANSWERS':
      return { ...state, evaluatedAnswers: action.payload };
    case 'SET_TIME_REMAINING':
      return { ...state, timeRemaining: action.payload };
    case 'SET_TIMER_RUNNING':
      return { ...state, isTimerRunning: action.payload };
    case 'SET_ERROR':
      return { ...state, errorMsg: action.payload };
    case 'RESET_GAME':
      return {
        ...initialState,
        roomCode: state.roomCode,
        playerName: state.playerName,
        isSpectator: state.isSpectator
      };
    default:
      return state;
  }
};

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
} | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    // Set up socket event listeners
    socketService.on('players_update', (players: Player[]) => {
      dispatch({ type: 'UPDATE_PLAYERS', payload: players });
    });

    socketService.on('board_update', (board: PlayerBoard) => {
      dispatch({ type: 'UPDATE_PLAYER_BOARDS', payload: [board] });
    });

    socketService.on('answer_submitted', (submission: AnswerSubmission) => {
      dispatch({ type: 'UPDATE_ANSWERS', payload: { [submission.playerId]: submission } });
    });

    socketService.on('answer_evaluation', (data: { isCorrect: boolean, playerId: string }) => {
      dispatch({ type: 'UPDATE_EVALUATED_ANSWERS', payload: { [data.playerId]: data.isCorrect } });
    });

    socketService.on('game_started', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: true });
    });

    socketService.on('game_restarted', () => {
      dispatch({ type: 'RESET_GAME' });
    });

    socketService.on('timer_update', (data: { timeRemaining: number }) => {
      dispatch({ type: 'SET_TIME_REMAINING', payload: data.timeRemaining });
      dispatch({ type: 'SET_TIMER_RUNNING', payload: true });
    });

    socketService.on('time_up', () => {
      dispatch({ type: 'SET_TIME_REMAINING', payload: 0 });
      dispatch({ type: 'SET_TIMER_RUNNING', payload: false });
    });

    socketService.on('error', (msg: string) => {
      dispatch({ type: 'SET_ERROR', payload: msg });
    });

    return () => {
      // Clean up socket listeners
      socketService.off('players_update');
      socketService.off('board_update');
      socketService.off('answer_submitted');
      socketService.off('answer_evaluation');
      socketService.off('game_started');
      socketService.off('game_restarted');
      socketService.off('timer_update');
      socketService.off('time_up');
      socketService.off('error');
    };
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}; 
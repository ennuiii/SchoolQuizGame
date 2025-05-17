import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import socketService, { ConnectionStatusType } from '../services/socketService';
import { supabaseService } from '../services/supabaseService';
import type { GameRecapData } from '../types/recap'; // Import GameRecapData

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'drawing';
  timeLimit?: number;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

interface Player {
  id: string;
  persistentPlayerId: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

export interface PlayerBoard {
  persistentPlayerId: string;
  playerName: string;
  boardData: string;
}

interface AnswerSubmission {
  persistentPlayerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
  hasDrawing?: boolean;
  drawingData?: string | null;
  isCorrect?: boolean | null;
  answerAttemptId?: string;
}

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

interface GameContextType {
  // Game State
  gameStarted: boolean;
  gameOver: boolean;
  isWinner: boolean;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  timeLimit: number | null;
  timeRemaining: number | null;
  isTimerRunning: boolean;
  submittedAnswer: boolean;
  isGameConcluded: boolean;
  
  // Recap State
  gameRecapData: GameRecapData | null;
  recapSelectedRoundIndex: number;
  recapSelectedTabKey: string;
  
  // Players and Boards
  players: Player[];
  playerBoards: PlayerBoard[];
  visibleBoards: Set<string>;
  boardVisibility: Record<string, boolean>;
  
  // Answers and Evaluations
  allAnswersThisRound: Record<string, AnswerSubmission>;
  evaluatedAnswers: Record<string, boolean | null>;
  
  // Preview Mode
  previewMode: PreviewModeState;
  
  // Questions
  questions: Question[];
  subjects: string[];
  languages: string[];
  selectedSubject: string;
  selectedGrade: number | '';
  selectedLanguage: string;
  isLoadingQuestions: boolean;
  availableQuestions: Question[];
  questionErrorMsg: string;
  randomCount: number;
  isLoadingRandom: boolean;
  
  // Preview Overlay Version
  previewOverlayVersion: 'v1' | 'v2';
  
  // Actions
  startGame: (roomCode: string, questions: Question[], timeLimit: number) => Promise<void>;
  nextQuestion: (roomCode: string) => Promise<void>;
  submitAnswer: (roomCode: string, answer: string, answerAttemptId: string, hasDrawing?: boolean, drawingData?: string | null) => Promise<void>;
  evaluateAnswer: (roomCode: string, persistentPlayerId: string, isCorrect: boolean) => Promise<void>;
  restartGame: (roomCode: string) => Promise<void>;
  endRoundEarly: (roomCode: string) => Promise<void>;
  toggleBoardVisibility: (playerIdOrSet: string | Set<string>) => void;
  startPreviewMode: (roomCode: string) => Promise<void>;
  stopPreviewMode: (roomCode: string) => Promise<void>;
  focusSubmission: (roomCode: string, persistentPlayerId: string) => Promise<void>;
  setQuestions: (questions: Question[]) => void;
  setSelectedSubject: (subject: string) => void;
  setSelectedGrade: (grade: number | '') => void;
  setSelectedLanguage: (language: string) => void;
  setRandomCount: (count: number) => void;
  loadQuestions: () => Promise<void>;
  loadRandomQuestions: () => Promise<void>;
  
  // Question Management
  addQuestionToSelected: (question: Question) => void;
  removeSelectedQuestion: (questionId: string) => void;
  clearAllSelectedQuestions: () => void;
  organizeSelectedQuestions: () => void;
  addCustomQuestion: () => void;
  gmShowRecapToAll: (roomCode: string) => Promise<void>;
  gmEndGameRequest: (roomCode: string) => Promise<void>;
  gmNavigateRecapRound: (roomCode: string, roundIndex: number) => Promise<void>;
  hideRecap: () => void;
  gmNavigateRecapTab: (roomCode: string, tabKey: string) => Promise<void>;
  
  // Preview Overlay Version
  setPreviewOverlayVersion: (version: 'v1' | 'v2') => Promise<void>;
  togglePreviewOverlayVersion: () => Promise<void>;
  
  connectionStatus: ConnectionStatusType;
}

const GameContext = createContext<GameContextType | null>(null);

type SocketConnectionState = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Game State
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<boolean>(false);
  const [isGameConcluded, setIsGameConcluded] = useState<boolean>(false);
  
  // Recap State
  const [gameRecapData, setGameRecapData] = useState<GameRecapData | null>(null);
  const [recapSelectedRoundIndex, setRecapSelectedRoundIndex] = useState<number>(0);
  const [recapSelectedTabKey, setRecapSelectedTabKey] = useState<string>('overallResults');
  
  // Players and Boards
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerBoards, setPlayerBoards] = useState<PlayerBoard[]>([]);
  const [visibleBoards, setVisibleBoards] = useState<Set<string>>(new Set());
  const [boardVisibility, setBoardVisibility] = useState<Record<string, boolean>>({});
  
  // Answers and Evaluations
  const [allAnswersThisRound, setAllAnswersThisRound] = useState<Record<string, AnswerSubmission>>({});
  const [evaluatedAnswers, setEvaluatedAnswers] = useState<Record<string, boolean | null>>({});
  
  // Preview Mode
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({
    isActive: false,
    focusedPlayerId: null
  });

  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);

  // Question Selection State
  const [subjects, setSubjects] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [questionErrorMsg, setQuestionErrorMsg] = useState<string>('');
  const [randomCount, setRandomCount] = useState<number>(5);
  const [isLoadingRandom, setIsLoadingRandom] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>(socketService.getConnectionState());

  // Preview Overlay Version (sync across clients)
  const [previewOverlayVersion, setPreviewOverlayVersionState] = useState<'v1' | 'v2'>('v1');

  const boardUpdateHandler = useCallback((updatedBoard: PlayerBoard) => {
    console.log('[GameContext] board_update received', updatedBoard);
    setPlayerBoards(prevBoards => {
      const index = prevBoards.findIndex(b => b.persistentPlayerId === updatedBoard.persistentPlayerId);
      if (index !== -1) {
        // Update existing board
        const newBoards = [...prevBoards];
        newBoards[index] = updatedBoard;
        return newBoards;
      } else {
        // Add new board
        return [...prevBoards, updatedBoard];
      }
    });
  }, []);

  // New useEffect to default boards to visible when players list changes
  useEffect(() => {
    setVisibleBoards(prevVisibleBoards => {
      const newVisibleBoards = new Set<string>(); // Stores persistentPlayerId
      let changed = false;

      players.forEach(player => {
        if (player.isActive && !player.isSpectator) {
          // If GM hasn't explicitly hidden, default to visible.
          // boardVisibility stores GM's explicit choices (persistentPlayerId -> boolean)
          if (boardVisibility[player.persistentPlayerId] !== false) {
            if (!prevVisibleBoards.has(player.persistentPlayerId)) {
              newVisibleBoards.add(player.persistentPlayerId);
              changed = true;
            }
          } else if (prevVisibleBoards.has(player.persistentPlayerId)) {
            // Was visible, but GM has now hidden it, so respect that.
            // This case might be redundant if boardVisibility update also triggers this effect
            // or if toggleBoardVisibility directly updates visibleBoards.
            // For now, ensure consistency.
          }
        } else {
          // Not active or is spectator, ensure not in visible set
          if (prevVisibleBoards.has(player.persistentPlayerId)) {
            // No need to add to newVisibleBoards, effectively removing it
            changed = true;
          }
        }
      });
      
      // Add back any boards that were in prevVisibleBoards and still correspond to active players
      // and haven't been explicitly hidden by the GM.
      prevVisibleBoards.forEach(pid => {
        const player = players.find(p => p.persistentPlayerId === pid);
        if (player && player.isActive && !player.isSpectator && boardVisibility[pid] !== false) {
          if (!newVisibleBoards.has(pid)) {
             newVisibleBoards.add(pid);
             // `changed` should already be true if this makes a difference from initial scan
          }
        }
      });

      // Ensure all items in newVisibleBoards correspond to an actual player to prevent stale entries.
      const currentPlayerPIDs = new Set(players.map(p => p.persistentPlayerId));
      let finalBoardsChanged = false;
      const finalVisibleBoards = new Set<string>();
      newVisibleBoards.forEach(pid => {
        if(currentPlayerPIDs.has(pid)){
          finalVisibleBoards.add(pid);
        } else {
          finalBoardsChanged = true; // An invalid PID was about to be added
        }
      });

      if (changed || finalBoardsChanged) {
        console.log('[GameContext] Updated visibleBoards by default logic:', finalVisibleBoards);
        return finalVisibleBoards;
      }
      return prevVisibleBoards;
    });
  }, [players, boardVisibility]); // Depends on GameContext's internal players list and GM visibility settings

  // Effect to sync with socketService connection state
  useEffect(() => {
    const cleanup = socketService.onConnectionStateChange((state, details) => {
      console.log('[GameContext] Connection state changed via socketService:', state, details);
      setConnectionStatus(state);
      // Potentially handle 'error' or 'reconnect_failed' states here too for GameContext specific UI
      if (state === 'connected') {
        // Potentially re-sync or fetch game state if needed after a reconnect
        console.log('[GameContext] Reconnected to server.');
      }
    });
    return cleanup;
  }, []);

  // Helper function to get player name
  const getPlayerName = useCallback((playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown Player';
  }, [players]);

  // Actions
  const startGame = useCallback(async (roomCode: string, gameQuestions: Question[], gameTimeLimit: number) => {
    if (gameQuestions.length > 0) {
      setQuestions(gameQuestions);
      setTimeLimit(gameTimeLimit);
      // Reset relevant game states
      setGameStarted(false); // Will be set to true by server event
      setGameOver(false);
      setIsWinner(false);
      setCurrentQuestion(null);
      setCurrentQuestionIndex(0);
      setTimeRemaining(null);
      setIsTimerRunning(false);
      setSubmittedAnswer(false);
      setAllAnswersThisRound({});
      setEvaluatedAnswers({});
      setPlayerBoards([]); // Player boards might be sent on game_started or game_state_update
      setGameRecapData(null);
      setPreviewMode({ isActive: false, focusedPlayerId: null });

      await socketService.robustEmit('start_game', { roomCode, questions: gameQuestions, timeLimit: gameTimeLimit });
      console.log('[GameContext] startGame emitted');
    } else {
      console.error('[GameContext] No questions selected to start the game.');
      setQuestionErrorMsg('Please select questions before starting the game.');
      setTimeout(() => setQuestionErrorMsg(''), 3000);
    }
  }, []);

  const nextQuestion = useCallback(async (roomCode: string) => {
    setSubmittedAnswer(false); // Reset for the new question
    setAllAnswersThisRound({}); // Clear answers from previous question
    setEvaluatedAnswers({}); // Clear evaluations from previous question
    await socketService.robustEmit('next_question', { roomCode });
    console.log('[GameContext] nextQuestion emitted');
  }, []);

  const submitAnswer = useCallback(async (roomCode: string, answer: string, answerAttemptId: string, hasDrawing?: boolean, drawingData?: string | null) => {
    if (currentQuestion && !submittedAnswer) {
      await socketService.robustEmit('submit_answer', {
        roomCode,
        answerData: {
          answer,
          questionId: currentQuestion.id,
          answerAttemptId, // Include the attempt ID
          hasDrawing: !!hasDrawing,
          drawingData: hasDrawing ? drawingData : null,
        }
      });
      // Optimistically set submittedAnswer to true, or wait for server confirmation via answer_received_confirmation
      // setSubmittedAnswer(true); // Decided to use server event 'answer_received_confirmation' to set this
      console.log('[GameContext] submitAnswer emitted with attemptId:', answerAttemptId);
    }
  }, [currentQuestion, submittedAnswer]);

  const evaluateAnswer = useCallback(async (roomCode: string, persistentPlayerId: string, isCorrect: boolean) => {
    // GM action: persistentPlayerId is the ID of the player whose answer is being evaluated.
    await socketService.robustEmit('evaluate_answer', { roomCode, playerId: persistentPlayerId, isCorrect });
    console.log('[GameContext] evaluateAnswer emitted for player:', persistentPlayerId);
  }, []);

  const restartGame = useCallback(async (roomCode: string) => {
    await socketService.robustEmit('restart_game', { roomCode });
    // Reset local state immediately for responsiveness, server will confirm with game_state_update
    setGameStarted(false);
    setGameOver(false);
    setIsWinner(false);
    setCurrentQuestion(null);
    setCurrentQuestionIndex(0);
    setTimeRemaining(null);
    setIsTimerRunning(false);
    setSubmittedAnswer(false);
    setAllAnswersThisRound({});
    setEvaluatedAnswers({});
    setPlayerBoards([]);
    setGameRecapData(null);
    setPreviewMode({ isActive: false, focusedPlayerId: null });
    console.log('[GameContext] restartGame emitted');
  }, []);

  const endRoundEarly = useCallback(async (roomCode: string) => {
    await socketService.robustEmit('end_round_early', { roomCode });
    console.log('[GameContext] endRoundEarly emitted');
  }, []);

  const gmShowRecapToAll = useCallback(async (roomCode: string) => {
    await socketService.robustEmit('gm_show_recap', { roomCode });
    console.log('[GameContext] gmShowRecapToAll emitted');
  }, []);

  const gmEndGameRequest = useCallback(async (roomCode: string) => {
    await socketService.robustEmit('gm_end_game', { roomCode });
    console.log('[GameContext] gmEndGameRequest emitted');
    // Expect server to handle actual game end and send 'game_over' or similar.
  }, []);

  const gmNavigateRecapRound = useCallback(async (roomCode: string, roundIndex: number) => {
    setRecapSelectedRoundIndex(roundIndex); // Optimistic update
    await socketService.robustEmit('gm_navigate_recap_round', { roomCode, roundIndex });
    console.log('[GameContext] gmNavigateRecapRound emitted');
  }, []);

  const gmNavigateRecapTab = useCallback(async (roomCode: string, tabKey: string) => {
    setRecapSelectedTabKey(tabKey); // Optimistic update
    await socketService.robustEmit('gm_navigate_recap_tab', { roomCode, tabKey });
    console.log('[GameContext] gmNavigateRecapTab emitted');
  }, []);

  const hideRecap = useCallback(() => {
    setGameRecapData(null);
    setRecapSelectedRoundIndex(0);
    setRecapSelectedTabKey('overallResults');
    console.log('[GameContext] Recap hidden locally.');
  }, []);

  // Toggle board visibility (local GM state)
  const toggleBoardVisibility = useCallback((playerIdOrSet: string | Set<string>) => {
    // playerIdOrSet is persistentPlayerId
    setBoardVisibility(prev => {
      const newVisibility = { ...prev };
      const idsToToggle = typeof playerIdOrSet === 'string' ? [playerIdOrSet] : Array.from(playerIdOrSet);
      
      idsToToggle.forEach(pid => {
        newVisibility[pid] = !prev[pid]; // Toggle: if undefined (never set), becomes true.
      });
      return newVisibility;
    });

    // Update visibleBoards based on new boardVisibility and current players
    // This logic is now primarily handled by the useEffect watching [players, boardVisibility]
    // However, we can provide an immediate hint for local responsiveness if needed.
    // For simplicity, relying on the useEffect might be cleaner.
  }, []);

  const startPreviewMode = useCallback(async (roomCode: string) => {
    await socketService.robustEmit('start_preview_mode', { roomCode });
    console.log('[GameContext] startPreviewMode emitted');
    // Server will send 'start_preview_mode' event to all clients to update their state.
  }, []);

  const stopPreviewMode = useCallback(async (roomCode: string) => {
    await socketService.robustEmit('stop_preview_mode', { roomCode });
    console.log('[GameContext] stopPreviewMode emitted');
    // Server will send 'stop_preview_mode' event to all clients.
  }, []);

  const focusSubmission = useCallback(async (roomCode: string, persistentPlayerId: string) => {
    // GM action: persistentPlayerId is the ID of the player submission to focus on.
    await socketService.robustEmit('focus_submission', { roomCode, playerId: persistentPlayerId });
    console.log('[GameContext] focusSubmission emitted for player:', persistentPlayerId);
    // Server will send 'focus_submission' event to all clients.
  }, []);

  // Load questions based on filters
  const loadQuestions = useCallback(async () => {
    setIsLoadingQuestions(true);
    setQuestionErrorMsg('');
    try {
      const questions = await supabaseService.getQuestions({
        subject: selectedSubject,
        grade: selectedGrade === '' ? undefined : selectedGrade,
        language: selectedLanguage
      });

      setAvailableQuestions(questions.map(convertSupabaseQuestion));
    } catch (error) {
      console.error('Error loading questions:', error);
      setQuestionErrorMsg('Failed to load questions');
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [selectedSubject, selectedGrade, selectedLanguage]);

  // Load random questions
  const loadRandomQuestions = useCallback(async () => {
    setIsLoadingRandom(true);
    try {
      const fetchedQuestions = await supabaseService.getQuestions({
        subject: selectedSubject,
        grade: selectedGrade === '' ? undefined : Number(selectedGrade),
        language: selectedLanguage,
        sortByGrade: true
      });

      const shuffled = fetchedQuestions.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, randomCount);
      const convertedQuestions = selected.map(convertSupabaseQuestion);
      
      // Merge with existing selected questions
      const newQuestions = [...questions, ...convertedQuestions]
        .filter((q, index, self) => // Remove duplicates
          index === self.findIndex(t => t.id === q.id)
        )
        .sort((a, b) => a.grade - b.grade); // Sort by grade

      setQuestions(newQuestions);
      setQuestionErrorMsg(`Added ${convertedQuestions.length} random questions`);
      setTimeout(() => setQuestionErrorMsg(''), 3000);
    } catch (error) {
      console.error('Error loading random questions:', error);
      setQuestionErrorMsg('Failed to load random questions');
    } finally {
      setIsLoadingRandom(false);
    }
  }, [selectedSubject, selectedGrade, selectedLanguage, randomCount, questions]);

  // Load subjects and languages on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const subjectsData = await supabaseService.getSubjects();
        const languagesData = await supabaseService.getLanguages();
        setSubjects(subjectsData);
        setLanguages(languagesData);
      } catch (error) {
        console.error('Error loading metadata:', error);
      }
    };

    loadMetadata();
  }, []);

  // Socket event handlers
  React.useEffect(() => {
    if (connectionStatus !== 'connected') {
      console.log('[GameContext] Socket not connected, skipping event listener setup. Status:', connectionStatus);
      return () => {
        // No cleanup action needed here as listeners are attached conditionally
      };
    }

    console.log('[GameContext] Socket connected, setting up socket event listeners:', {
      isSocketConnected: connectionStatus,
      timestamp: new Date().toISOString()
    });

    // --- Robust reconnection and state sync logic ---
    // After a successful rejoin (room_joined or game_state), always request the latest game state
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('room_joined', (data: { roomCode: string }) => {
        console.log('[GameContext] Detected room_joined after reconnect. Requesting latest game state.');
        socket.emit('get_game_state', { roomCode: data.roomCode });
      });
      socket.on('game_state', (state: any) => {
        console.log('[GameContext] Received game_state after reconnect:', state);
        // No-op: handled by gameStateUpdateHandler, but log for clarity
      });
    }
    // --- End robust reconnection and state sync logic ---

    // Define all handlers first (ensure these are defined before use)
    const gameStartedHandler = (data: { question: Question, timeLimit: number, players: Player[] }) => {
      console.log('[GameContext] IMMEDIATE: Game started event received');
      console.log('[GameContext] Game started event received:', {
        questionText: data.question.text, timeLimit: data.timeLimit,
        currentGameStarted: gameStarted, currentQuestion: currentQuestion?.text,
        currentQuestionIndex, timestamp: new Date().toISOString()
      });
      try {
        setGameStarted(true); 
        setCurrentQuestion(data.question); 
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeLimit < 99999 ? data.timeLimit : null);
        setIsTimerRunning(data.timeLimit < 99999);
        setCurrentQuestionIndex(0); 
        setSubmittedAnswer(false); 
        setAllAnswersThisRound({});
        setEvaluatedAnswers({}); 
        setPlayerBoards([]);
        setIsGameConcluded(false);
        setGameOver(false);
        setIsWinner(false);
        
        // Make all non-spectator player boards visible by default
        // Use players from the event data if available, otherwise use the current 'players' state.
        const currentPlayers = data.players || players;
        const initialVisiblePlayerIds = new Set(currentPlayers.filter(p => !p.isSpectator).map(p => p.id));
        setVisibleBoards(initialVisiblePlayerIds);
        console.log('[GameContext] Initial visible boards set:', initialVisiblePlayerIds);

        console.log('[GameContext] State updated after game_started event:', {
          newGameStarted: true, newQuestion: data.question.text, newTimeLimit: data.timeLimit,
          newQuestionIndex: 0, timestamp: new Date().toISOString()
        });

        // Reset recap and conclusion state on restart
        setIsGameConcluded(false);
        setGameRecapData(null);
        setRecapSelectedRoundIndex(0);
        setRecapSelectedTabKey('overallResults');
      } catch (error: any) {
        console.error('[GameContext] Error handling game_started event:', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
      }
    };

    const gameStateUpdateHandler = (state: any) => {
      console.log('[GameContext] game_state_update received', state);
      setGameStarted(state.gameStarted);
      setGameOver(state.gameOver);
      setCurrentQuestion(state.currentQuestion);
      setCurrentQuestionIndex(state.currentQuestionIndex);
      setTimeLimit(state.timeLimit);
      setTimeRemaining(state.timeRemaining);
      setPlayers(state.players); // Assuming server sends full player list with persistentPlayerId
      setPlayerBoards(state.playerBoards); // Assuming server sends boards keyed by persistentPlayerId
      setIsWinner(state.isWinner || false); // Ensure isWinner is boolean
      setSubmittedAnswer(state.submittedAnswer || false);
      setIsGameConcluded(state.isGameConcluded || false);
      setAllAnswersThisRound(state.allAnswersThisRound || {}); // Keyed by persistentPlayerId
      setEvaluatedAnswers(state.evaluatedAnswers || {}); // Keyed by persistentPlayerId
      
      if (state.previewMode) {
        setPreviewMode(state.previewMode); // Server sends { isActive, focusedPlayerId (persistent) }
      }

      if (state.gameRecapData) {
        setGameRecapData(state.gameRecapData);
      }
      if (typeof state.recapSelectedRoundIndex === 'number') {
        setRecapSelectedRoundIndex(state.recapSelectedRoundIndex);
      }
      if (typeof state.recapSelectedTabKey === 'string') {
        setRecapSelectedTabKey(state.recapSelectedTabKey);
      }
      if (state.previewOverlayVersion) {
        setPreviewOverlayVersionState(state.previewOverlayVersion);
      }
      // Update boardVisibility based on players from state if needed
      // This might be complex if GM settings are preserved client-side only
      // For now, assume server state is authoritative or GM updates boardVisibility directly
    };
    
    const newQuestionHandler = (data: { question: Question, timeLimit: number }) => { 
        console.log('[GameContext] New question:', { questionText: data.question.text, timeLimit: data.timeLimit, timestamp: new Date().toISOString() });
        setCurrentQuestion(data.question); 
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeLimit < 99999 ? data.timeLimit : null);
        setIsTimerRunning(data.timeLimit < 99999);
        setCurrentQuestionIndex(prev => { const newIndex = prev + 1; console.log('[GameContext] Updated question index:', { prev, new: newIndex }); return newIndex; });
        setSubmittedAnswer(false); 
        setAllAnswersThisRound({}); 
        setEvaluatedAnswers({}); 
        setPlayerBoards([]);
    };
    const errorHandler = (error: string) => { setQuestionErrorMsg(error); setTimeout(() => setQuestionErrorMsg(''), 3000); };
    const gameOverHandler = () => { setGameOver(true); setIsTimerRunning(false); };
    const gameWinnerHandler = (data: { persistentPlayerId: string; playerName?: string }) => {
      console.log('[GameContext] Game winner announced:', data);
      // Assuming RoomContext provides the current user's persistentPlayerId
      // For now, we can't directly check if *this* client is the winner without access to that.
      // The server might set a flag on the player object itself, or RoomContext can handle it.
      // For GameContext, we just record that a winner was announced.
      // The actual "isWinner" for *this* client might be better managed in RoomContext
      // or by the server sending a specific "you_are_the_winner" event or a player property.
      // For now, if the server sends a global `isWinner` flag in game_state_update, that's used.
      // This handler might be more for a specific "winner_announced" event.
      setGameOver(true);
      setIsTimerRunning(false);
      // If a general isWinner field is not enough, then the game_state_update needs to send player specific isWinner flag
      // or this client needs its own persistentPlayerId to compare.
      // For now, this handler mostly signals game over, winner detail is in data.
    };
    const timerUpdateHandler = (data: { timeRemaining: number }) => { console.log('[GameContext] Timer update:', { timeRemaining: data.timeRemaining, timestamp: new Date().toISOString() }); setTimeRemaining(data.timeRemaining); setIsTimerRunning(data.timeRemaining > 0); };
    const timeUpHandler = () => { 
        console.log('[GameContext] Time up event received by context'); 
        setTimeRemaining(0); 
        setIsTimerRunning(false);
    };
    const startPreviewModeHandler = () => { 
        console.log('[GameContext] Starting preview mode (socket event)'); 
        setPreviewMode(prev => ({ ...prev, isActive: true }));
        // DO NOT alter visibleBoards here; let GM control visibility via toggleBoardVisibility
        // The useEffect above will ensure new/active players are visible by default.
    };
    const stopPreviewModeHandler = () => { 
        console.log('[GameContext] Stopping preview mode (socket event)'); 
        setPreviewMode({ isActive: false, focusedPlayerId: null }); 
        // DO NOT alter visibleBoards here either.
    };
    const focusSubmissionHandler = (data: { persistentPlayerId: string }) => {
      console.log('[GameContext] Focusing submission:', {
        persistentPlayerId: data.persistentPlayerId,
        playerName: players.find(p => p.persistentPlayerId === data.persistentPlayerId)?.name
      });
      setPreviewMode(prev => ({ ...prev, focusedPlayerId: data.persistentPlayerId }));
    };
    const answerEvaluatedHandler = (data: { persistentPlayerId: string, isCorrect: boolean, score?: number, lives?: number }) => {
      console.log('[GameContext] answer_evaluated received', data);
      setEvaluatedAnswers(prev => ({ ...prev, [data.persistentPlayerId]: data.isCorrect }));
      // Update player score/lives if provided
      setPlayers(prevPlayers => prevPlayers.map(p => {
        if (p.persistentPlayerId === data.persistentPlayerId) {
          return {
            ...p,
            ...(typeof data.score === 'number' && { score: data.score }),
            ...(typeof data.lives === 'number' && { lives: data.lives }),
          };
        }
        return p;
      }));
    };
    const roundOverHandler = (data: { roundAnswers: Record<string, AnswerSubmission>, evaluatedAnswersUpdate?: Record<string, boolean | null> }) => {
      console.log('[GameContext] round_over received', data);
      setAllAnswersThisRound(prev => ({...prev, ...data.roundAnswers})); // Merge, server is source of truth for this round's final answers
      if (data.evaluatedAnswersUpdate) {
         setEvaluatedAnswers(prev => ({...prev, ...data.evaluatedAnswersUpdate}));
      }
      setIsTimerRunning(false);
      // Any other round-specific cleanup
    }; 

    const gameOverPendingRecapHandler = (data: { roomCode: string, winner?: {id: string, name: string} }) => {
      console.log('[GameContext] game_over_pending_recap received:', data);
      setGameOver(true); 
      setIsGameConcluded(true); 
      setIsTimerRunning(false);
      if (data.winner && data.winner.id === socketService.getSocketId()) {
        setIsWinner(true);
      } else if (!data.winner) {
        setIsWinner(false);
      }
    };

    const gameRecapHandler = (recapDataWithInitialState: GameRecapData & { initialSelectedRoundIndex?: number, initialSelectedTabKey?: string }) => {
        console.log('[GameContext] game_recap received:', recapDataWithInitialState);
        setIsGameConcluded(true); 
        setGameOver(true); // Assuming recap means game is fully over
        setGameRecapData(recapDataWithInitialState);
        setRecapSelectedRoundIndex(recapDataWithInitialState.initialSelectedRoundIndex ?? 0);
        setRecapSelectedTabKey(recapDataWithInitialState.initialSelectedTabKey ?? 'overallResults'); // Set initial tab key
    };

    const recapRoundChangedHandler = (data: { selectedRoundIndex: number }) => {
      console.log('[GameContext] recap_round_changed received:', data);
      setRecapSelectedRoundIndex(data.selectedRoundIndex);
    };

    const recapTabChangedHandler = (data: { selectedTabKey: string }) => {
      console.log('[GameContext] recap_tab_changed received:', data);
      setRecapSelectedTabKey(data.selectedTabKey);
    };

    // Preview Overlay Version Handler
    const previewOverlayVersionChangedHandler = (data: { version: 'v1' | 'v2' }) => {
      setPreviewOverlayVersionState(data.version);
    };

    const allAnswersSubmittedHandler = (data: { allAnswersThisRound: Record<string, AnswerSubmission> }) => {
      console.log('[GameContext] all_answers_submitted_for_round received', data);
      setAllAnswersThisRound(data.allAnswersThisRound);
      // Potentially trigger UI change indicating evaluation is pending
    };

    const answerReceivedHandler = (data: { persistentPlayerId: string, answerAttemptId: string, message?: string }) => {
      console.log('[GameContext] answer_received_confirmation received', data);
      // If we need to give feedback based on answerAttemptId, we can do it here.
      // For now, mainly a server ack. If it includes player's answer, update allAnswersThisRound.
      // This is useful if the GM sees answers live.
      // setAllAnswersThisRound(prev => ({ ...prev, [data.persistentPlayerId]: { /* update if server sends full answer data */ } }));
      setSubmittedAnswer(true); // Generic flag, might need to be per-player if context tracks multiple players' submissions
    };

    // Attach listeners
    socketService.on('game_started', gameStartedHandler);
    socketService.on('game_state_update', gameStateUpdateHandler);
    socketService.on('new_question', newQuestionHandler);
    socketService.on('error', errorHandler);
    socketService.on('game_over', gameOverHandler);
    socketService.on('game_winner', gameWinnerHandler);
    socketService.on('timer_update', timerUpdateHandler);
    socketService.on('time_up', timeUpHandler);
    socketService.on('start_preview_mode', startPreviewModeHandler);
    socketService.on('stop_preview_mode', stopPreviewModeHandler);
    socketService.on('focus_submission', focusSubmissionHandler);
    socketService.on('board_update', boardUpdateHandler);
    socketService.on('answer_evaluated', answerEvaluatedHandler);
    socketService.on('round_over', roundOverHandler);
    socketService.on('game_over_pending_recap', gameOverPendingRecapHandler);
    socketService.on('game_recap', gameRecapHandler);
    socketService.on('recap_round_changed', recapRoundChangedHandler);
    socketService.on('recap_tab_changed', recapTabChangedHandler);
    socketService.on('preview_overlay_version_changed', previewOverlayVersionChangedHandler);
    socketService.on('all_answers_submitted_for_round', allAnswersSubmittedHandler);
    socketService.on('answer_received_confirmation', answerReceivedHandler);

    // Cleanup
    return () => {
      console.log('[GameContext] Cleaning up ALL socket event listeners (connection status on cleanup:', connectionStatus, ')');
      // According to linter, .off might only take the event name
      socketService.off('game_started');
      socketService.off('game_state_update');
      socketService.off('new_question');
      socketService.off('error');
      socketService.off('game_over');
      socketService.off('game_winner');
      socketService.off('timer_update');
      socketService.off('time_up');
      socketService.off('start_preview_mode');
      socketService.off('stop_preview_mode');
      socketService.off('focus_submission');
      socketService.off('board_update');
      socketService.off('answer_evaluated');
      socketService.off('round_over');
      socketService.off('room_created');
      socketService.off('game_over_pending_recap');
      socketService.off('game_recap');
      socketService.off('recap_round_changed');
      socketService.off('recap_tab_changed');
      socketService.off('preview_overlay_version_changed');
      socketService.off('all_answers_submitted_for_round');
      socketService.off('answer_received_confirmation');
      // socketService.off('answer_submitted');
      // socketService.off('answer_evaluation');
    };
  }, [connectionStatus, boardUpdateHandler, players]); // Added players to dependencies for focusSubmissionHandler name lookup

  // Question Management Functions
  const addQuestionToSelected = useCallback((question: Question) => {
    if (questions.some(q => q.id === question.id)) {
      setQuestionErrorMsg('This question is already selected');
      return;
    }
    const newQuestions = [...questions, question].sort((a, b) => a.grade - b.grade);
    setQuestions(newQuestions);
    setAvailableQuestions(prev => prev.filter(q => q.id !== question.id));
  }, [questions]);

  const removeSelectedQuestion = useCallback((questionId: string) => {
    const questionToRemove = questions.find(q => q.id === questionId);
    if (questionToRemove) {
      const newQuestions = questions.filter(q => q.id !== questionId);
      setQuestions(newQuestions);
      setAvailableQuestions(prev => [...prev, questionToRemove].sort((a, b) => a.grade - b.grade));
    }
  }, [questions]);

  const clearAllSelectedQuestions = useCallback(() => {
    if (questions.length === 0) {
      setQuestionErrorMsg('No questions to clear');
      return;
    }
    
    // Add all selected questions back to available questions
    const updatedAvailableQuestions = [...availableQuestions, ...questions].sort((a, b) => a.grade - b.grade);
    setAvailableQuestions(updatedAvailableQuestions);
    
    // Clear selected questions
    setQuestions([]);
    setQuestionErrorMsg('All questions cleared');
    setTimeout(() => setQuestionErrorMsg(''), 3000);
  }, [questions, availableQuestions]);

  const organizeSelectedQuestions = useCallback(() => {
    const organized = [...questions].sort((a, b) => a.grade - b.grade);
    setQuestions(organized);
  }, [questions]);

  const addCustomQuestion = useCallback(() => {
    const text = prompt('Enter the question:');
    if (!text) return;
    
    const answerInput = prompt('Enter the answer:');
    const answer = answerInput || undefined;
    const subject = prompt('Enter the subject:') || 'General';
    const grade = parseInt(prompt('Enter the grade level (1-13):') || '5', 10);
    const language = prompt('Enter the language (e.g., de, en):') || 'de';
    
    // Validate inputs
    if (!text.trim()) {
      setQuestionErrorMsg('Question text cannot be empty');
      return;
    }
    
    if (isNaN(grade) || grade < 1 || grade > 13) {
      setQuestionErrorMsg('Grade must be between 1 and 13');
      return;
    }
    
    const newQuestion: Question = {
      id: Date.now().toString(), // Convert timestamp to string
      text: text.trim(),
      type: 'text',
      answer: answer?.trim(),
      subject: subject.trim(),
      grade: Math.min(13, Math.max(1, grade)),
      language: language.trim()
    };
    
    // Check for duplicate custom questions
    const isDuplicate = questions.some(
      q => q.text.toLowerCase() === newQuestion.text.toLowerCase() &&
           q.subject.toLowerCase() === newQuestion.subject.toLowerCase()
    );
    
    if (isDuplicate) {
      setQuestionErrorMsg('A similar question already exists in the selection');
      return;
    }
    
    const newQuestions = [...questions, newQuestion].sort((a, b) => a.grade - b.grade);
    setQuestions(newQuestions);
    setQuestionErrorMsg('Custom question added to selection');
    setTimeout(() => setQuestionErrorMsg(''), 3000);
  }, [questions]);

  // Action to set version and emit to others (GameMaster only)
  const setPreviewOverlayVersion = useCallback(async (version: 'v1' | 'v2') => {
    setPreviewOverlayVersionState(version);
    await socketService.robustEmit('gm_set_preview_overlay_version', { version });
    console.log('[GameContext] gm_set_preview_overlay_version emitted with version:', version);
  }, []);

  // Action to toggle version
  const togglePreviewOverlayVersion = useCallback(async () => {
    const newVersion = previewOverlayVersion === 'v1' ? 'v2' : 'v1';
    setPreviewOverlayVersionState(newVersion);
    await socketService.robustEmit('gm_set_preview_overlay_version', { version: newVersion });
    console.log('[GameContext] gm_set_preview_overlay_version (toggled) emitted with version:', newVersion);
  }, [previewOverlayVersion]);

  // Listen for version changes from server
  useEffect(() => {
    const handler = (data: { version: 'v1' | 'v2' }) => {
      setPreviewOverlayVersionState(data.version);
    };
    socketService.on('preview_overlay_version_changed', handler);
    return () => {
      socketService.off('preview_overlay_version_changed', handler);
    };
  }, []);

  const value = {
    gameStarted,
    gameOver,
    isWinner,
    currentQuestion,
    currentQuestionIndex,
    timeLimit,
    timeRemaining,
    isTimerRunning,
    submittedAnswer,
    isGameConcluded,
    players,
    playerBoards,
    visibleBoards,
    boardVisibility,
    allAnswersThisRound,
    evaluatedAnswers,
    previewMode,
    questions,
    subjects,
    languages,
    selectedSubject,
    selectedGrade,
    selectedLanguage,
    isLoadingQuestions,
    availableQuestions,
    questionErrorMsg,
    randomCount,
    isLoadingRandom,
    gameRecapData,
    recapSelectedRoundIndex,
    recapSelectedTabKey,
    gmNavigateRecapRound,
    hideRecap,
    gmNavigateRecapTab,
    setQuestions,
    setSelectedSubject,
    setSelectedGrade,
    setSelectedLanguage,
    setRandomCount,
    loadQuestions,
    loadRandomQuestions,
    startGame,
    nextQuestion,
    submitAnswer,
    evaluateAnswer,
    restartGame,
    endRoundEarly,
    toggleBoardVisibility,
    startPreviewMode,
    stopPreviewMode,
    focusSubmission,
    addQuestionToSelected,
    removeSelectedQuestion,
    clearAllSelectedQuestions,
    organizeSelectedQuestions,
    addCustomQuestion,
    gmShowRecapToAll,
    gmEndGameRequest,
    previewOverlayVersion,
    setPreviewOverlayVersion,
    togglePreviewOverlayVersion,
    connectionStatus
  };

  return (
    <GameContext.Provider value={value}>
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

// Helper function to sort questions by grade, then by subject, then by text
const sortByGrade = (a: Question, b: Question) => {
  if (a.grade !== b.grade) {
    return a.grade - b.grade;
  }
  if (a.subject !== b.subject) {
    return a.subject.localeCompare(b.subject);
  }
  return a.text.localeCompare(b.text);
};

// Helper function to convert Supabase question format to local Question type
// Ensure this aligns with your actual Supabase structure and Question interface
const convertSupabaseQuestion = (q: any): Question => ({
  id: q.id.toString(), // Supabase ID might be number
  text: q.question_text,
  type: q.question_type as 'text' | 'drawing', // Ensure this cast is safe
  timeLimit: q.time_limit || undefined,
  answer: q.correct_answer || '', // Assuming a field for the correct answer
  grade: parseInt(q.grade_level, 10) || 0, // Assuming grade_level is a string
  subject: q.subject || 'General',
  language: q.language || 'en',
}); 
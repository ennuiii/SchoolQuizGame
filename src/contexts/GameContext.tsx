import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import socketService from '../services/socketService';
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

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
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
  
  // Actions
  startGame: (roomCode: string, questions: Question[], timeLimit: number) => void;
  nextQuestion: (roomCode: string) => void;
  evaluateAnswer: (roomCode: string, playerId: string, isCorrect: boolean) => void;
  restartGame: (roomCode: string) => void;
  endRoundEarly: (roomCode: string) => void;
  toggleBoardVisibility: (playerIdOrSet: string | Set<string>) => void;
  startPreviewMode: (roomCode: string) => void;
  stopPreviewMode: (roomCode: string) => void;
  focusSubmission: (roomCode: string, playerId: string) => void;
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
  gmShowRecapToAll: (roomCode: string) => void;
  gmEndGameRequest: (roomCode: string) => void;
  gmNavigateRecapRound: (roomCode: string, roundIndex: number) => void;
  hideRecap: () => void;
  gmNavigateRecapTab: (roomCode: string, tabKey: string) => void;
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
  const [socketConnectionStatus, setSocketConnectionStatus] = useState<SocketConnectionState>(socketService.getConnectionState() as SocketConnectionState);

  const boardUpdateHandler = useCallback((updatedBoard: PlayerBoard) => {
    console.log('[GameContext] board_update received', updatedBoard);
    setPlayerBoards(prevBoards => {
      const index = prevBoards.findIndex(b => b.playerId === updatedBoard.playerId);
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

  // Effect to subscribe to socket connection state changes
  useEffect(() => {
    const handleConnectionChange = (state: string) => {
      console.log('[GameContext] Socket connection state changed from service:', state);
      setSocketConnectionStatus(state as SocketConnectionState);
    };
    // Subscribe to connection state changes
    socketService.onConnectionStateChange(handleConnectionChange);
    
    // Cleanup: How to unsubscribe from onConnectionStateChange?
    // Assuming there isn't a direct return, and no specific offConnectionStateChange is visible in socketService
    // This listener might be intended to persist or needs a specific method in socketService to unregister.
    // For now, no direct cleanup call if 'unsubscribe' wasn't a function.
    return () => {
        console.log('[GameContext] Cleanup for onConnectionStateChange listener (no specific off method called).');
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  // Helper function to get player name
  const getPlayerName = useCallback((playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown Player';
  }, [players]);

  // Actions
  const startGame = useCallback((roomCode: string, questions: Question[], timeLimit: number) => {
    if (!questions || questions.length === 0) {
      setQuestionErrorMsg('Cannot start game: No questions selected');
      setTimeout(() => setQuestionErrorMsg(''), 3000);
      return;
    }
    socketService.startGame(roomCode, questions, timeLimit);
  }, []);

  const nextQuestion = useCallback((roomCode: string) => {
    socketService.nextQuestion(roomCode);
  }, []);

  const evaluateAnswer = useCallback((roomCode: string, playerId: string, isCorrect: boolean) => {
    socketService.evaluateAnswer(roomCode, playerId, isCorrect);
  }, []);

  const restartGame = useCallback((roomCode: string) => {
    // Reset recap and conclusion state on restart
    setIsGameConcluded(false);
    setGameRecapData(null);
    setRecapSelectedRoundIndex(0);
    setRecapSelectedTabKey('overallResults');
    socketService.restartGame(roomCode);
  }, []);

  const endRoundEarly = useCallback((roomCode: string) => {
    socketService.endRoundEarly(roomCode);
  }, []);

  const gmShowRecapToAll = useCallback((roomCode: string) => {
    socketService.emit('gm_show_recap_to_all', { roomCode });
  }, []);

  const gmEndGameRequest = useCallback((roomCode: string) => {
    socketService.emit('gm_end_game_request', { roomCode });
  }, []);

  const gmNavigateRecapRound = useCallback((roomCode: string, roundIndex: number) => {
    socketService.emit('gm_navigate_recap_round', { roomCode, selectedRoundIndex: roundIndex });
  }, []);

  const hideRecap = useCallback(() => {
    setGameRecapData(null);
    // Potentially reset other recap-related states if necessary
  }, []);

  const gmNavigateRecapTab = useCallback((roomCode: string, tabKey: string) => {
    socketService.emit('gm_navigate_recap_tab', { roomCode, selectedTabKey: tabKey });
  }, []);

  const toggleBoardVisibility = useCallback((playerIdOrSet: string | Set<string>) => {
    setVisibleBoards(prev => {
      const newSet = new Set(prev);
      if (typeof playerIdOrSet === 'string') {
        if (newSet.has(playerIdOrSet)) {
          newSet.delete(playerIdOrSet);
        } else {
          newSet.add(playerIdOrSet);
        }
      } else {
        // If it's a Set, replace the current set with the new one
        return playerIdOrSet;
      }
      return newSet;
    });
  }, []);

  const startPreviewMode = useCallback((roomCode: string) => {
    socketService.startPreviewMode(roomCode);
    setPreviewMode(prev => ({ ...prev, isActive: true }));
    // Make all non-spectator player boards visible when entering preview mode
    setVisibleBoards(new Set(players.filter(p => !p.isSpectator).map(p => p.id)));
  }, [players]);

  const stopPreviewMode = useCallback((roomCode: string) => {
    socketService.stopPreviewMode(roomCode);
    setPreviewMode({ isActive: false, focusedPlayerId: null });
  }, []);

  const focusSubmission = useCallback((roomCode: string, playerId: string) => {
    socketService.focusSubmission(roomCode, playerId);
    setPreviewMode(prev => ({ ...prev, focusedPlayerId: playerId }));
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
    if (socketConnectionStatus !== 'connected') {
      console.log('[GameContext] Socket not connected, skipping event listener setup. Status:', socketConnectionStatus);
      return () => {
        // No cleanup action needed here as listeners are attached conditionally
      };
    }

    console.log('[GameContext] Socket connected, setting up socket event listeners:', {
      isSocketConnected: socketConnectionStatus,
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
      console.log('[GameContext] Game state update received:', {
        started: state.started, currentGameStarted: gameStarted, hasQuestion: !!state.currentQuestion,
        currentQuestion: state.currentQuestion?.text, timeLimit: state.timeLimit,
        playerCount: state.players?.length, answerCount: state.roundAnswers ? Object.keys(state.roundAnswers).length : 0,
        timestamp: new Date().toISOString()
      });
      try {
        if (state.started !== gameStarted) {
          console.log('[GameContext] Updating gameStarted state:', { from: gameStarted, to: state.started, timestamp: new Date().toISOString() });
          setGameStarted(state.started);
        }
        if (state.currentQuestion && (!currentQuestion || currentQuestion.text !== state.currentQuestion.text)) {
          console.log('[GameContext] Updating currentQuestion:', { from: currentQuestion?.text, to: state.currentQuestion.text, timestamp: new Date().toISOString() });
          setCurrentQuestion(state.currentQuestion);
        }
        if (state.timeLimit !== timeLimit) {
          console.log('[GameContext] Updating timeLimit:', { from: timeLimit, to: state.timeLimit, timestamp: new Date().toISOString() });
          setTimeLimit(state.timeLimit);
        }
        const newPlayers = state.players || [];
        setPlayers(newPlayers);
        setAllAnswersThisRound(state.roundAnswers || {});
        setEvaluatedAnswers(state.evaluatedAnswers || {});

        // Update visible boards for new non-spectator players if game has started
        if (state.started) {
          const newNonSpectatorPlayerIds = newPlayers
            .filter((p: Player) => !p.isSpectator)
            .map((p: Player) => p.id);
          
          setVisibleBoards(prevVisibleBoards => {
            const updatedVisibleBoards = new Set(prevVisibleBoards);
            let boardsUpdated = false;
            newNonSpectatorPlayerIds.forEach((id: string) => {
              if (!updatedVisibleBoards.has(id)) {
                updatedVisibleBoards.add(id);
                boardsUpdated = true;
              }
            });
            if (boardsUpdated) {
              console.log('[GameContext] Added new players to visible boards:', updatedVisibleBoards);
            }
            return updatedVisibleBoards;
          });
        }
        
        if (state.isConcluded !== undefined && state.isConcluded !== isGameConcluded) {
          setIsGameConcluded(state.isConcluded);
        }
        if (state.started === false && gameStarted === true && state.isConcluded === false) { 
          setIsGameConcluded(false);
          setGameOver(false);
          setIsWinner(false);
        }
        console.log('[GameContext] State update complete:', { gameStarted: state.started, hasQuestion: !!state.currentQuestion, playerCount: state.players?.length, timestamp: new Date().toISOString() });
      } catch (error: any) {
        console.error('[GameContext] Error handling game state update:', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
      }
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
    const gameWinnerHandler = (data: { playerId: string }) => { setIsWinner(data.playerId === socketService.getSocketId()); setGameOver(true); setIsTimerRunning(false); };
    const timerUpdateHandler = (data: { timeRemaining: number }) => { console.log('[GameContext] Timer update:', { timeRemaining: data.timeRemaining, timestamp: new Date().toISOString() }); setTimeRemaining(data.timeRemaining); setIsTimerRunning(data.timeRemaining > 0); };
    const timeUpHandler = () => { 
        console.log('[GameContext] Time up event received by context'); 
        setTimeRemaining(0); 
        setIsTimerRunning(false);
    };
    const startPreviewModeHandler = () => { 
        console.log('[GameContext] Starting preview mode'); setPreviewMode(prev => ({ ...prev, isActive: true }));
        const nonSpectatorIds = players.filter(p => !p.isSpectator).map(p => p.id);
        setVisibleBoards(new Set(nonSpectatorIds));
    };
    const stopPreviewModeHandler = () => { console.log('[GameContext] Stopping preview mode'); setPreviewMode({ isActive: false, focusedPlayerId: null }); };
    const focusSubmissionHandler = (data: { playerId: string }) => { console.log('[GameContext] Focusing submission:', { playerId: data.playerId, playerName: players.find(p => p.id === data.playerId)?.name }); setPreviewMode(prev => ({ ...prev, focusedPlayerId: data.playerId })); };
    const answerEvaluatedHandler = (data: any) => { console.log('[GameContext] answer_evaluated received', data); /* Placeholder */ };
    const roundOverHandler = (data: any) => { console.log('[GameContext] round_over received', data); /* Placeholder */ }; 

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

    // Cleanup
    return () => {
      console.log('[GameContext] Cleaning up ALL socket event listeners (connection status on cleanup:', socketConnectionStatus, ')');
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
      // socketService.off('answer_submitted');
      // socketService.off('answer_evaluation');
    };
  }, [gameStarted, currentQuestion, timeLimit, players, socketConnectionStatus, boardUpdateHandler]); // Added boardUpdateHandler to dependencies

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
    gmEndGameRequest
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

// Helper function for grade comparison
const sortByGrade = (a: Question, b: Question) => {
  const gradeA = Number(a.grade) || 0;
  const gradeB = Number(b.grade) || 0;
  return gradeA - gradeB;
};

// Helper function for question type conversion
const convertSupabaseQuestion = (q: any): Question => ({
  id: q.id.toString(),
  text: q.text,
  type: q.type || 'text',
  timeLimit: q.timeLimit,
  answer: q.answer,
  grade: parseInt(q.grade, 10) || 0,
  subject: q.subject,
  language: q.language
}); 
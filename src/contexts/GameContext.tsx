import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import socketService from '../services/socketService';
import { supabaseService } from '../services/supabaseService';

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
}

const GameContext = createContext<GameContextType | null>(null);

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

  // Helper function to get player name
  const getPlayerName = useCallback((playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown Player';
  }, [players]);

  // Actions
  const handleStartGame = (roomCode: string, questions: Question[], timeLimit: number) => {
    socketService.emit('start_game', { roomCode, questions, timeLimit });
  };

  const handleNextQuestion = (roomCode: string) => {
    socketService.emit('next_question', { roomCode });
  };

  const handleEvaluateAnswer = (roomCode: string, playerId: string, isCorrect: boolean) => {
    socketService.emit('evaluate_answer', { roomCode, playerId, isCorrect });
  };

  const handleRestartGame = (roomCode: string) => {
    socketService.emit('restart_game', { roomCode });
  };

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
    socketService.restartGame(roomCode);
  }, []);

  const endRoundEarly = useCallback((roomCode: string) => {
    socketService.endRoundEarly(roomCode);
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
    try {
      const questions = await supabaseService.getQuestions({
        subject: selectedSubject,
        grade: selectedGrade === '' ? undefined : Number(selectedGrade),
        language: selectedLanguage,
        sortByGrade: true
      });

      const shuffled = questions.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, randomCount);
      setAvailableQuestions(selected.map(convertSupabaseQuestion));
    } catch (error) {
      console.error('Error loading random questions:', error);
      setQuestionErrorMsg('Failed to load random questions');
    }
  }, [selectedSubject, selectedGrade, selectedLanguage, randomCount]);

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
    // Handle complete game state updates
    socketService.on('game_state_update', (state: any) => {
      console.log('[GameContext] Received game state update:', {
        started: state.started,
        currentQuestionIndex: state.currentQuestionIndex,
        timeLimit: state.timeLimit,
        playerCount: state.players?.length,
        boardCount: state.playerBoards ? Object.keys(state.playerBoards).length : 0,
        answerCount: state.roundAnswers ? Object.keys(state.roundAnswers).length : 0
      });
      
      try {
        setGameStarted(state.started);
        setCurrentQuestion(state.currentQuestion);
        setCurrentQuestionIndex(state.currentQuestionIndex);
        setTimeLimit(state.timeLimit);
        setPlayers(state.players);
        
        // Update player boards
        if (state.playerBoards) {
          const boardsArray = Object.entries(state.playerBoards).map(([playerId, data]: [string, any]) => ({
            playerId,
            boardData: data.boardData,
            playerName: state.players.find((p: any) => p.id === playerId)?.name || 'Unknown'
          }));
          setPlayerBoards(boardsArray);
          console.log('[GameContext] Updated player boards:', {
            count: boardsArray.length,
            players: boardsArray.map(b => b.playerName)
          });
        }

        // Update answers
        if (state.roundAnswers) {
          setAllAnswersThisRound(state.roundAnswers);
          console.log('[GameContext] Updated round answers:', {
            count: Object.keys(state.roundAnswers).length,
            answers: Object.entries(state.roundAnswers).map(([pid, data]: [string, any]) => ({
              player: state.players.find((p: any) => p.id === pid)?.name,
              hasDrawing: data.hasDrawing
            }))
          });
        }

        // Update evaluations
        if (state.evaluatedAnswers) {
          setEvaluatedAnswers(state.evaluatedAnswers);
          console.log('[GameContext] Updated answer evaluations:', {
            count: Object.keys(state.evaluatedAnswers).length,
            results: Object.entries(state.evaluatedAnswers).map(([pid, isCorrect]) => ({
              player: state.players.find((p: any) => p.id === pid)?.name,
              isCorrect
            }))
          });
        }

        // Make all boards visible by default
        const playerIds = state.players
          .filter((p: any) => !p.isSpectator)
          .map((p: any) => p.id);
        setVisibleBoards(new Set(playerIds));

      } catch (error) {
        console.error('[GameContext] Error processing game state update:', error);
      }
    });

    // Handle game started event
    socketService.on('game_started', (data: { question: Question, timeLimit: number }) => {
      console.log('[GameContext] Game started:', {
        questionText: data.question.text,
        timeLimit: data.timeLimit,
        timestamp: new Date().toISOString()
      });
      
      setGameStarted(true);
      setCurrentQuestion(data.question);
      setTimeLimit(data.timeLimit);
      setCurrentQuestionIndex(0);
      setSubmittedAnswer(false);
      setAllAnswersThisRound({});
      setEvaluatedAnswers({});
      setPlayerBoards([]);
    });

    // Handle new question event
    socketService.on('new_question', (data: { question: Question, timeLimit: number }) => {
      console.log('[GameContext] New question:', {
        questionText: data.question.text,
        timeLimit: data.timeLimit,
        timestamp: new Date().toISOString()
      });
      
      setCurrentQuestion(data.question);
      setTimeLimit(data.timeLimit);
      setCurrentQuestionIndex(prev => {
        const newIndex = prev + 1;
        console.log('[GameContext] Updated question index:', { prev, new: newIndex });
        return newIndex;
      });
      setSubmittedAnswer(false);
      setAllAnswersThisRound({});
      setEvaluatedAnswers({});
      setPlayerBoards([]);
    });

    // Handle errors
    socketService.on('error', (error: string) => {
      setQuestionErrorMsg(error);
      setTimeout(() => setQuestionErrorMsg(''), 3000);
    });

    // Handle game over
    socketService.on('game_over', () => {
      setGameOver(true);
      setIsTimerRunning(false);
    });

    // Handle winner
    socketService.on('game_winner', (data: { playerId: string }) => {
      setIsWinner(data.playerId === socketService.getSocketId());
      setGameOver(true);
      setIsTimerRunning(false);
    });

    // Handle timer updates
    socketService.on('timer_update', (data: { timeRemaining: number }) => {
      console.log('[GameContext] Timer update:', {
        timeRemaining: data.timeRemaining,
        timestamp: new Date().toISOString()
      });
      setTimeRemaining(data.timeRemaining);
      setIsTimerRunning(data.timeRemaining > 0);
    });

    // Handle time up
    socketService.on('time_up', () => {
      console.log('[GameContext] Time up event received');
      setTimeRemaining(0);
      setIsTimerRunning(false);
      
      // Auto-submit if needed
      if (!submittedAnswer && currentQuestion) {
        const roomCode = sessionStorage.getItem('roomCode');
        if (roomCode) {
          console.log('[GameContext] Auto-submitting answer due to time up');
          const answerInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          const currentAnswer = answerInput?.value?.trim() || '';
          const canvas = document.querySelector('canvas');
          const hasDrawing = canvas && (canvas as any)._fabricCanvas?.getObjects().length > 0;
          
          socketService.submitAnswer(roomCode, currentAnswer || (hasDrawing ? 'Drawing submitted' : ''), hasDrawing || false);
          setSubmittedAnswer(true);
        }
      }
    });

    // Handle preview mode
    socketService.on('start_preview_mode', () => {
      console.log('[GameContext] Starting preview mode');
      setPreviewMode(prev => ({ ...prev, isActive: true }));
      // Show all non-spectator boards
      const nonSpectatorIds = players
        .filter(p => !p.isSpectator)
        .map(p => p.id);
      setVisibleBoards(new Set(nonSpectatorIds));
    });

    socketService.on('stop_preview_mode', () => {
      console.log('[GameContext] Stopping preview mode');
      setPreviewMode({ isActive: false, focusedPlayerId: null });
    });

    socketService.on('focus_submission', (data: { playerId: string }) => {
      console.log('[GameContext] Focusing submission:', {
        playerId: data.playerId,
        playerName: players.find(p => p.id === data.playerId)?.name
      });
      setPreviewMode(prev => ({ ...prev, focusedPlayerId: data.playerId }));
    });

    // Cleanup
    return () => {
      console.log('[GameContext] Cleaning up event listeners');
      socketService.off('game_state_update');
      socketService.off('game_started');
      socketService.off('new_question');
      socketService.off('error');
      socketService.off('game_over');
      socketService.off('game_winner');
      socketService.off('timer_update');
      socketService.off('time_up');
      socketService.off('start_preview_mode');
      socketService.off('stop_preview_mode');
      socketService.off('focus_submission');
    };
  }, [players, currentQuestion, submittedAnswer]);

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
    addCustomQuestion
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
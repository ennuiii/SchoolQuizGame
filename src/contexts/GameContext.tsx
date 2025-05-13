import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import socketService from '../services/socketService';
import { supabaseService } from '../services/supabaseService';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
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
  removeSelectedQuestion: (questionId: number) => void;
  clearAllSelectedQuestions: () => void;
  organizeSelectedQuestions: () => void;
  addCustomQuestion: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Game State
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('de');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [questionErrorMsg, setQuestionErrorMsg] = useState('');
  const [randomCount, setRandomCount] = useState<number>(5);
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);

  // Actions
  const startGame = useCallback((roomCode: string, questions: Question[], timeLimit: number) => {
    if (!questions || questions.length === 0) {
      setQuestionErrorMsg('Cannot start game: No questions selected');
      setTimeout(() => setQuestionErrorMsg(''), 3000);
      return;
    }

    const activePlayers = players.filter(player => !player.isSpectator);
    if (activePlayers.length < 2) {
      setQuestionErrorMsg('Cannot start game: Need at least 2 active players');
      setTimeout(() => setQuestionErrorMsg(''), 3000);
      return;
    }

    socketService.startGame(roomCode, questions, timeLimit);
  }, [players]);

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
  }, []);

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
      const data = await supabaseService.getQuestions({
        subject: selectedSubject,
        grade: selectedGrade === '' ? undefined : selectedGrade,
        language: selectedLanguage
      });
      setAvailableQuestions(data);
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
    setQuestionErrorMsg('');
    try {
      const data = await supabaseService.getQuestions({
        subject: selectedSubject,
        grade: selectedGrade === '' ? undefined : selectedGrade,
        language: selectedLanguage
      });

      // Shuffle and take randomCount questions
      const shuffled = data.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, randomCount);
      
      setQuestions(prev => [...prev, ...selected]);
      setAvailableQuestions(prev => [...prev, ...selected]);
    } catch (error) {
      console.error('Error loading random questions:', error);
      setQuestionErrorMsg('Failed to load random questions');
    } finally {
      setIsLoadingRandom(false);
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
    socketService.on('game_started', (data: { question: Question, timeLimit?: number }) => {
      setGameStarted(true);
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(0);
      if (data.timeLimit) {
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeLimit);
        setIsTimerRunning(true);
      }
    });

    socketService.onError((error: string) => {
      setQuestionErrorMsg(error);
      setTimeout(() => setQuestionErrorMsg(''), 3000);
    });

    socketService.on('new_question', (data: { question: Question, timeLimit?: number }) => {
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(prev => prev + 1);
      if (data.timeLimit) {
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeLimit);
        setIsTimerRunning(true);
      }
    });

    socketService.on('players_update', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    socketService.on('board_update', (data: PlayerBoard) => {
      setPlayerBoards(prevBoards => {
        const index = prevBoards.findIndex(b => b.playerId === data.playerId);
        if (index >= 0) {
          const newBoards = [...prevBoards];
          newBoards[index] = data;
          return newBoards;
        }
        return [...prevBoards, data];
      });
    });

    socketService.on('answer_submitted', (submission: AnswerSubmission) => {
      setAllAnswersThisRound(prev => ({
        ...prev,
        [submission.playerId]: submission
      }));
    });

    socketService.on('answer_evaluation', (data: { isCorrect: boolean, playerId: string }) => {
      setEvaluatedAnswers(prev => ({
        ...prev,
        [data.playerId]: data.isCorrect
      }));
    });

    socketService.on('game_over', () => {
      setGameOver(true);
    });

    socketService.on('game_winner', (data: { playerId: string }) => {
      setIsWinner(true);
    });

    socketService.on('game_restarted', () => {
      setGameStarted(false);
      setGameOver(false);
      setIsWinner(false);
      setCurrentQuestion(null);
      setCurrentQuestionIndex(0);
      setPlayerBoards([]);
      setAllAnswersThisRound({});
      setEvaluatedAnswers({});
      setVisibleBoards(new Set());
      setTimeRemaining(null);
      setIsTimerRunning(false);
      setSubmittedAnswer(false);
    });

    socketService.on('timer_update', (data: { timeRemaining: number }) => {
      setTimeRemaining(data.timeRemaining);
      setIsTimerRunning(true);
    });

    socketService.on('time_up', () => {
      setTimeRemaining(0);
      setIsTimerRunning(false);
    });

    socketService.on('end_round_early', () => {
      setTimeRemaining(0);
      setIsTimerRunning(false);
    });

    return () => {
      socketService.off('game_started');
      socketService.off('new_question');
      socketService.off('players_update');
      socketService.off('board_update');
      socketService.off('answer_submitted');
      socketService.off('answer_evaluation');
      socketService.off('game_over');
      socketService.off('game_winner');
      socketService.off('game_restarted');
      socketService.off('timer_update');
      socketService.off('time_up');
      socketService.off('end_round_early');
    };
  }, []);

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

  const removeSelectedQuestion = useCallback((questionId: number) => {
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
      id: Date.now(), // Use timestamp as temporary ID
      text: text.trim(),
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
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}; 
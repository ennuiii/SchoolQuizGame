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
  persistentPlayerId: string;
  name: string;
  lives: number;
  score: number;
  streak: number;
  position: number | null;
  lastPointsEarned: number | null;
  lastAnswerTimestamp: number | null;
  answers: {
    playerId: string;
    persistentPlayerId: string;
    playerName: string;
    answer: string;
    hasDrawing: boolean;
    drawingData?: string | null;
    timestamp: number;
    isCorrect: boolean | null;
    answerAttemptId?: string | null;
    submissionOrder?: number;  // Order in which the answer was submitted
    submissionTime?: number;   // Time taken to submit in milliseconds
    pointsAwarded?: number;
    pointsBreakdown?: {
      base: number;
      time: number;
      position: number;
      streakMultiplier: number;
      total: number;
    };
  }[];
  isActive: boolean;
  isSpectator: boolean;
  isEliminated?: boolean; // Track if player is eliminated but chose to stay
  avatarSvg?: string; // Avatar SVG data
}

export interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
  roundIndex?: number;
  timestamp?: number;
}

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
  hasDrawing?: boolean;
  drawingData?: string | null;
  submissionOrder?: number;  // Order in which the answer was submitted
  submissionTime?: number;   // Time taken to submit in milliseconds
  submissionTimestamp?: number; // When the answer was submitted
  pointsAwarded?: number; // Points awarded for this submission
  pointsBreakdown?: {
    base: number;
    time: number;
    position: number;
    streakMultiplier: number;
    total: number;
  }; // Points breakdown for this submission
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
  isPointsMode: boolean;
  
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
  currentVotes?: Record<string, Record<string, 'correct' | 'incorrect'>>;
  
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
  
  // New filtering state
  availableSubjects: string[];
  availableGrades: number[];
  selectedSubjects: string[];
  selectedGrades: number[];
  isLoadingMetadata: boolean;
  
  // Preview Overlay Version
  previewOverlayVersion: 'v1' | 'v2';
  isCommunityVotingMode: boolean;
  
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
  
  // Preview Overlay Version & Community Voting
  setPreviewOverlayVersion: (version: 'v1' | 'v2') => void;
  togglePreviewOverlayVersion: () => void;
  toggleCommunityVoting?: (roomCode: string) => void;
  
  // New filtering actions
  loadMetadataByLanguage: (language: string) => Promise<void>;
  loadQuestionsWithFilters: () => Promise<void>;
  setSelectedSubjects: (subjects: string[]) => void;
  setSelectedGrades: (grades: number[]) => void;
  toggleSubjectSelection: (subject: string) => void;
  toggleGradeSelection: (grade: number) => void;
  selectAllSubjects: () => void;
  selectAllGrades: () => void;
  clearAllSubjects: () => void;
  clearAllGrades: () => void;
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
    const [submittedAnswer, setSubmittedAnswer] = useState<boolean>(false);  const [isGameConcluded, setIsGameConcluded] = useState<boolean>(false);  const [isPointsMode, setIsPointsMode] = useState<boolean>(false);
  
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
  const [currentVotes, setCurrentVotes] = useState<Record<string, Record<string, 'correct' | 'incorrect'>>>({});
  
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

  // Preview Overlay Version (sync across clients)
  const [previewOverlayVersion, setPreviewOverlayVersionState] = useState<'v1' | 'v2'>('v1');
  const [isCommunityVotingMode, setIsCommunityVotingMode] = useState(false);

  // New filtering state
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableGrades, setAvailableGrades] = useState<number[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

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

  // New useEffect to default boards to visible when players list changes
  useEffect(() => {
    setVisibleBoards(prevVisibleBoards => {
      const newVisibleBoards = new Set(prevVisibleBoards);
      let changed = false;

      // Remove players from visibleBoards if they are no longer active/non-spectators or not in the players list.
      // This ensures that if a player was in prevVisibleBoards but is no longer valid (e.g., left, became spectator), they are removed.
      // The GM's explicit action to hide a board is respected and not overridden here.
      const validPlayerIds = new Set(players.filter(p => p.isActive && !p.isSpectator).map(p => p.id));

      prevVisibleBoards.forEach(visiblePlayerId => {
        if (!validPlayerIds.has(visiblePlayerId)) {
          if (newVisibleBoards.has(visiblePlayerId)) { // Check if it was in the set we are building
            newVisibleBoards.delete(visiblePlayerId);
            changed = true;
          }
        }
      });
      
      if (changed) {
        console.log('[GameContext] Updated visibleBoards by removing inactive/spectator players:', newVisibleBoards);
        return newVisibleBoards;
      }
      return prevVisibleBoards; // No change, return the original set
    });
  }, [players, gameStarted]); // Depends on GameContext's internal players list and gameStarted

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
    socketService.startPreviewMode(roomCode); // This emits to server, server broadcasts 'start_preview_mode'
    // Client will react to 'start_preview_mode' event via startPreviewModeHandler above.
    // No direct state change to visibleBoards here.
  }, []);

  const stopPreviewMode = useCallback((roomCode: string) => {
    socketService.stopPreviewMode(roomCode); // This emits to server, server broadcasts 'stop_preview_mode'
    // Client will react to 'stop_preview_mode' event via stopPreviewModeHandler above.
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

  // New load questions function with multiple filters
  const loadQuestionsWithFilters = useCallback(async () => {
    // Validate that at least one subject and one grade are selected
    if (selectedSubjects.length === 0 || selectedGrades.length === 0) {
      setQuestionErrorMsg('Please select at least one grade and subject');
      setTimeout(() => setQuestionErrorMsg(''), 3000);
      setAvailableQuestions([]);
      return;
    }

    setIsLoadingQuestions(true);
    setQuestionErrorMsg('');
    try {
      // Fetch questions for each combination of selected subjects and grades
      const allQuestions: any[] = [];
      
      for (const subject of selectedSubjects) {
        for (const grade of selectedGrades) {
          const questions = await supabaseService.getQuestions({
            subject,
            grade,
            language: selectedLanguage
          });
          allQuestions.push(...questions);
        }
      }

      // Remove duplicates and convert
      const uniqueQuestions = allQuestions.filter((question, index, self) => 
        index === self.findIndex(q => q.id === question.id)
      );

      setAvailableQuestions(uniqueQuestions.map(convertSupabaseQuestion));
      
      if (uniqueQuestions.length === 0) {
        setQuestionErrorMsg('No questions found for the selected filters');
        setTimeout(() => setQuestionErrorMsg(''), 3000);
      }
    } catch (error) {
      console.error('Error loading questions with filters:', error);
      setQuestionErrorMsg('Failed to load questions');
      setTimeout(() => setQuestionErrorMsg(''), 3000);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [selectedSubjects, selectedGrades, selectedLanguage]);

  // Load random questions
  const loadRandomQuestions = useCallback(async () => {
    setIsLoadingRandom(true);
    try {
      // Fetch all questions based on filters
      const fetchedQuestions = await supabaseService.getQuestions({
        subject: selectedSubject,
        grade: selectedGrade === '' ? undefined : Number(selectedGrade),
        language: selectedLanguage,
        sortByGrade: true
      });

      // If no grade is selected and we have multiple grades, distribute evenly
      if (selectedGrade === '' && fetchedQuestions.length > 0) {
        // Group questions by grade
        const questionsByGrade: Record<number, any[]> = {};
        fetchedQuestions.forEach(q => {
          if (!questionsByGrade[q.grade]) {
            questionsByGrade[q.grade] = [];
          }
          questionsByGrade[q.grade].push(q);
        });

        const availableGrades = Object.keys(questionsByGrade).map(Number);
        
        // If we have multiple grades, distribute evenly
        if (availableGrades.length > 1) {
          let selected: any[] = [];
          
          // First pass: Get at least one question from each grade
          availableGrades.forEach(grade => {
            const gradeQuestions = questionsByGrade[grade];
            if (gradeQuestions.length > 0) {
              // Shuffle questions of this grade and take one
              const shuffled = [...gradeQuestions].sort(() => 0.5 - Math.random());
              selected.push(shuffled[0]);
            }
          });
          
          // Early return if we already have more than requested
          if (selected.length >= randomCount) {
            // Trim down to exactly randomCount, ensuring we have as many grades as possible
            selected = selected.slice(0, randomCount);
          } else {
            // Second pass: Calculate questions per grade for remaining slots
            const remainingSlots = randomCount - selected.length;
            const additionalPerGrade = Math.floor(remainingSlots / availableGrades.length);
            let extraQuestions = remainingSlots % availableGrades.length;
            
            // Distribute remaining slots
            availableGrades.forEach(grade => {
              const gradeQuestions = questionsByGrade[grade];
              // Skip grades with no questions or already used 
              if (gradeQuestions.length <= 1) return;
              
              // Take additional questions per grade, avoiding the one we already took
              const shuffled = [...gradeQuestions].sort(() => 0.5 - Math.random());
              const alreadySelected = selected.filter(q => q.grade === grade).length;
              const canTakeMore = Math.min(additionalPerGrade, shuffled.length - alreadySelected);
              
              if (canTakeMore > 0) {
                const startIndex = alreadySelected;
                selected.push(...shuffled.slice(startIndex, startIndex + canTakeMore));
              }
              
              // Add one extra question from grades with more questions if we need extras
              if (extraQuestions > 0 && shuffled.length > (alreadySelected + canTakeMore)) {
                selected.push(shuffled[alreadySelected + canTakeMore]);
                extraQuestions--;
              }
            });
            
            // If we still need more questions, keep adding from grades with the most available
            if (selected.length < randomCount) {
              // Sort grades by number of remaining questions (descending)
              const gradesWithRemainingQuestions = availableGrades
                .filter(grade => {
                  const alreadySelected = selected.filter(q => q.grade === grade).length;
                  return questionsByGrade[grade].length > alreadySelected;
                })
                .sort((a, b) => {
                  const aRemaining = questionsByGrade[a].length - selected.filter(q => q.grade === a).length;
                  const bRemaining = questionsByGrade[b].length - selected.filter(q => q.grade === b).length;
                  return bRemaining - aRemaining;
                });
              
              let remaining = randomCount - selected.length;
              
              for (const grade of gradesWithRemainingQuestions) {
                if (remaining <= 0) break;
                
                const gradeQuestions = questionsByGrade[grade];
                const alreadySelected = selected.filter(q => q.grade === grade).length;
                const remainingForGrade = gradeQuestions.length - alreadySelected;
                const toTakeMore = Math.min(remaining, remainingForGrade);
                
                if (toTakeMore > 0) {
                  const shuffled = [...gradeQuestions].sort(() => 0.5 - Math.random());
                  // Avoid duplicates by using the already selected count as offset
                  selected.push(...shuffled.slice(alreadySelected, alreadySelected + toTakeMore));
                  remaining -= toTakeMore;
                }
              }
            }
          }
          
          // Final check to ensure we don't exceed randomCount
          if (selected.length > randomCount) {
            selected = selected.slice(0, randomCount);
          }
          
          // Prepare the selected questions
          const convertedQuestions = selected.map(convertSupabaseQuestion);
          
          // Merge with existing selected questions
          const newQuestions = [...questions, ...convertedQuestions]
            .filter((q, index, self) => // Remove duplicates
              index === self.findIndex(t => t.id === q.id)
            )
            .sort((a, b) => a.grade - b.grade); // Sort by grade

          setQuestions(newQuestions);
          setQuestionErrorMsg(`Added ${convertedQuestions.length} random questions, distributed across grades`);
          setTimeout(() => setQuestionErrorMsg(''), 3000);
        } else {
          // Use a simpler selection logic if only one grade is available
          const shuffled = fetchedQuestions.sort(() => 0.5 - Math.random());
          // Take exactly randomCount questions
          const selected = shuffled.slice(0, Math.min(randomCount, shuffled.length));
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
        }
      } else {
        // Use a simpler selection logic if specific grade is selected
        const shuffled = fetchedQuestions.sort(() => 0.5 - Math.random());
        // Take exactly randomCount questions
        const selected = shuffled.slice(0, Math.min(randomCount, shuffled.length));
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
      }
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
        const currentPlayers = data.players || players; // Use event data first
        const initialVisiblePlayerIds = new Set(
          currentPlayers.filter(p => p.isActive && !p.isSpectator).map(p => p.id)
        );
        setVisibleBoards(initialVisiblePlayerIds);
        console.log('[GameContext] Initial visible boards set in gameStartedHandler:', initialVisiblePlayerIds);

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
      console.log('[GameContext] Game state update received:', JSON.stringify(state, null, 2)); // Log entire state
      try {
        if (state.started !== gameStarted) {
          console.log('[GameContext] Updating gameStarted state:', { from: gameStarted, to: state.started, timestamp: new Date().toISOString() });
          setGameStarted(state.started);
        }
        if (state.currentQuestion && (!currentQuestion || currentQuestion.id !== state.currentQuestion.id)) { // Compare by ID for robustness
          console.log('[GameContext] Updating currentQuestion from gameStateUpdate:', { from: currentQuestion?.text, to: state.currentQuestion.text, timestamp: new Date().toISOString() });
          setCurrentQuestion(state.currentQuestion);
          // When the question changes, always reset timer states based on the NEW question's time limit from the server state.
          const newQuestionTimeLimit = state.currentQuestion.timeLimit !== undefined ? state.currentQuestion.timeLimit : state.timeLimit;
          console.log('[GameContext] New question detected in gameStateUpdate. Resetting timer. New question timeLimit from state.currentQuestion.timeLimit or state.timeLimit:', newQuestionTimeLimit);
          if (newQuestionTimeLimit !== null && newQuestionTimeLimit < 99999) {
            setTimeLimit(newQuestionTimeLimit); // Update overall timeLimit state as well
            setTimeRemaining(newQuestionTimeLimit);
            setIsTimerRunning(true);
          } else {
            setTimeLimit(newQuestionTimeLimit); // Could be null or 99999
            setTimeRemaining(null);
            setIsTimerRunning(false);
          }
        }
        // Update currentQuestionIndex
        if (state.currentQuestionIndex !== undefined && state.currentQuestionIndex !== currentQuestionIndex) {
          console.log('[GameContext] Updating currentQuestionIndex from gameStateUpdate:', { from: currentQuestionIndex, to: state.currentQuestionIndex, timestamp: new Date().toISOString() });
          setCurrentQuestionIndex(state.currentQuestionIndex);
        }
        // This block handles explicit timeLimit changes if the question itself hasn't changed
        // but the timeLimit for the current question was updated (e.g., by GM action - though not implemented).
        // This might be redundant now with the above block, but kept for safety for now.
        if (state.timeLimit !== timeLimit && (!state.currentQuestion || state.currentQuestion.id === currentQuestion?.id) ) {
          console.log('[GameContext] Updating timeLimit from gameStateUpdate (question same or not in state):', { from: timeLimit, to: state.timeLimit, timestamp: new Date().toISOString() });
          setTimeLimit(state.timeLimit);
          if (state.timeLimit !== null && state.timeLimit < 99999) {
            setTimeRemaining(state.timeLimit);
            setIsTimerRunning(true);
          } else {
            setTimeRemaining(null);
            setIsTimerRunning(false);
          }
        }
        
        const newPlayers = state.players || [];
        // Detailed logging for players update in GameContext
        setPlayers(prevPlayers => {
          console.log('[GameContext] setPlayers (gameStateUpdate) - PREV players:', JSON.stringify(prevPlayers, null, 2));
          console.log('[GameContext] setPlayers (gameStateUpdate) - RECEIVED players from event:', JSON.stringify(newPlayers, null, 2));
          // Basic check: if newPlayers is substantially different, log more, or always log for now
          if (JSON.stringify(prevPlayers) !== JSON.stringify(newPlayers)) {
            console.log('[GameContext] setPlayers (gameStateUpdate) - Players array IS different. Updating.');
          } else {
            console.log('[GameContext] setPlayers (gameStateUpdate) - Players array is the same. No change to player list itself.');
          }
          return newPlayers; // Update with the new list from server
        });

        console.log('[GameContext] gameStateUpdateHandler: BEFORE setAllAnswersThisRound. Current context:', JSON.stringify(allAnswersThisRound), 'Incoming state.roundAnswers:', JSON.stringify(state.roundAnswers));
        // Transform the roundAnswers to include submission order and time taken
        const transformedRoundAnswers = Object.entries(state.roundAnswers || {}).reduce((acc, [key, value]: [string, any]) => {
          acc[key] = {
            ...value,
            submissionOrder: value.submissionOrder,
            submissionTime: value.submissionTime,
            submissionTimestamp: value.timestamp
          };
          return acc;
        }, {} as Record<string, AnswerSubmission>);
        setAllAnswersThisRound(transformedRoundAnswers);
        console.log('[GameContext] gameStateUpdateHandler: AFTER setAllAnswersThisRound. New context:', JSON.stringify(transformedRoundAnswers));

        console.log('[GameContext] gameStateUpdateHandler: BEFORE setEvaluatedAnswers. Current context:', JSON.stringify(evaluatedAnswers), 'Incoming state.evaluatedAnswers:', JSON.stringify(state.evaluatedAnswers));
        setEvaluatedAnswers(state.evaluatedAnswers || {});
        console.log('[GameContext] gameStateUpdateHandler: AFTER setEvaluatedAnswers. New context:', JSON.stringify(state.evaluatedAnswers || {}));

        // Update player boards from server state - critical for reconnection recovery
        if (state.playerBoards) {
          console.log('[GameContext] Restoring player boards from server state:', Object.keys(state.playerBoards).length);
          
          const receivedBoards = Object.values(state.playerBoards).map((board: any) => ({
            playerId: board.playerId,
            playerName: board.playerName || getPlayerName(board.playerId),
            boardData: board.boardData,
            roundIndex: board.roundIndex,
            timestamp: board.timestamp
          }));
          
          setPlayerBoards(prevBoards => {
            // If we have no boards but server has them, use server's completely
            if (prevBoards.length === 0 && receivedBoards.length > 0) {
              console.log('[GameContext] No local boards, using server boards completely');
              return receivedBoards;
            }
            
            // Otherwise merge, prioritizing server data for each player
            const mergedBoards = [...prevBoards]; // Start with local boards
            
            // For each server board, update or add to our local collection
            receivedBoards.forEach(serverBoard => {
              const localBoardIndex = mergedBoards.findIndex(b => b.playerId === serverBoard.playerId);
              
              if (localBoardIndex !== -1) {
                // Only override local board if server has newer data or local is empty
                const localBoard = mergedBoards[localBoardIndex];
                if (!localBoard.boardData || localBoard.boardData === '' || 
                    (serverBoard.timestamp && (!localBoard.timestamp || serverBoard.timestamp > localBoard.timestamp))) {
                  console.log(`[GameContext] Updating board for player ${serverBoard.playerId} with newer server data`);
                  mergedBoards[localBoardIndex] = serverBoard;
                }
              } else {
                // No local board for this player, add the server one
                console.log(`[GameContext] Adding missing board for player ${serverBoard.playerId} from server`);
                mergedBoards.push(serverBoard);
              }
            });
            
            return mergedBoards;
          });
        }

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
        if (state.isCommunityVotingMode !== undefined && state.isCommunityVotingMode !== isCommunityVotingMode) {          setIsCommunityVotingMode(state.isCommunityVotingMode);        }        if (state.isPointsMode !== undefined && state.isPointsMode !== isPointsMode) {          setIsPointsMode(state.isPointsMode);        }
        if (state.started === false && gameStarted === true && state.isConcluded === false) { 
          setIsGameConcluded(false);
          setGameOver(false);
          setIsWinner(false);
        }
        // Update currentVotes if present in the server state
        if (state.currentVotes) {
          setCurrentVotes(state.currentVotes);
        }
        console.log('[GameContext] State update complete:', { gameStarted: state.started, hasQuestion: !!state.currentQuestion, playerCount: state.players?.length, timestamp: new Date().toISOString() });
      } catch (error: any) {
        console.error('[GameContext] Error handling game state update:', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
      }
    };
    
    const newQuestionHandler = (data: { question: Question, timeLimit: number }) => { 
        console.log(`[GameContext] 'new_question' event received. Question Text: ${data.question.text}, Time Limit: ${data.timeLimit}`);
        // Most state is now set by gameStateUpdateHandler.
        // This handler can be used for immediate client-side only logic if needed,
        // or for things not covered by the main game state object from server.
        setSubmittedAnswer(false); // Reset context-level submission flag (likely for GM UI)
        
        // Explicitly reset answers for new question to ensure drawing isn't disabled
        console.log('[GameContext] Explicitly clearing allAnswersThisRound in newQuestionHandler');
        setAllAnswersThisRound({});
        
        // Ensure preview overlay is closed when new question starts (client-side safety net)
        if (previewMode.isActive) {
            console.log('[GameContext] Auto-closing preview overlay for new question');
            setPreviewMode({ isActive: false, focusedPlayerId: null });
        }
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

    // Add handler for game_restarted event
    const gameRestartedHandler = (data: { roomCode: string }) => {
      console.log('[GameContext] Game restarted event received:', data);
      // Reset all game state for a fresh start
      setGameStarted(false);
      setCurrentQuestion(null);
      setCurrentQuestionIndex(0);
      setSubmittedAnswer(false);
      setAllAnswersThisRound({});
      setEvaluatedAnswers({});
      setCurrentVotes({});
      setPlayerBoards([]);
      setIsGameConcluded(false);
      setGameOver(false);
      setIsWinner(false);
      setGameRecapData(null);
      setRecapSelectedRoundIndex(0);
      setRecapSelectedTabKey('overallResults');
      setPreviewMode({ isActive: false, focusedPlayerId: null });
      setIsCommunityVotingMode(false);
    };

    // Add handler for points mode status change
    const pointsModeStatusChangedHandler = (data: { isPointsMode: boolean }) => {
      console.log('[GameContext] Points mode status changed event received:', data);
      setIsPointsMode(data.isPointsMode);
    };

    // Add handler for player elimination status changes
    const playerEliminatedStatusHandler = (data: { 
      playerId: string, 
      persistentPlayerId: string, 
      isEliminated: boolean,
      isSpectator?: boolean,
      isActive?: boolean
    }) => {
      console.log('[GameContext] Player elimination status update received:', data);
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.persistentPlayerId === data.persistentPlayerId) {
            console.log(`[GameContext] Updating elimination status for player ${player.name}: ${player.isEliminated} -> ${data.isEliminated}`);
            return {
              ...player,
              isEliminated: data.isEliminated,
              isSpectator: data.isSpectator !== undefined ? data.isSpectator : player.isSpectator,
              isActive: data.isActive !== undefined ? data.isActive : player.isActive
            };
          }
          return player;
        });
      });
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
    socketService.on('game_restarted', gameRestartedHandler);
    socketService.on('points_mode_status_changed', pointsModeStatusChangedHandler);
    socketService.on('player_eliminated_status', playerEliminatedStatusHandler);

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
      socketService.off('game_restarted');
      socketService.off('points_mode_status_changed');
      socketService.off('player_eliminated_status');
      // socketService.off('answer_submitted');
      // socketService.off('answer_evaluation');
    };
  }, [socketConnectionStatus, boardUpdateHandler, gameStarted]); // REMOVED 'players' from dependency array

  // Question Management Functions
  const addQuestionToSelected = useCallback((question: Question) => {
    if (questions.some(q => q.id === question.id)) {
      setQuestionErrorMsg('This question is already selected');
      setTimeout(() => setQuestionErrorMsg(''), 3000); // Clear message after 3 seconds
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
      setTimeout(() => setQuestionErrorMsg(''), 3000); // Clear message after 3 seconds
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
      setTimeout(() => setQuestionErrorMsg(''), 3000); // Clear message after 3 seconds
      return;
    }
    
    if (isNaN(grade) || grade < 1 || grade > 13) {
      setQuestionErrorMsg('Grade must be between 1 and 13');
      setTimeout(() => setQuestionErrorMsg(''), 3000); // Clear message after 3 seconds
      return;
    }
    
    const newQuestion: Question = {
      id: Date.now().toString(), // Convert timestamp to string
      text: text.trim(),
      type: 'text', // Always set type to 'text' for custom questions
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
      setTimeout(() => setQuestionErrorMsg(''), 3000); // Clear message after 3 seconds
      return;
    }
    
    const newQuestions = [...questions, newQuestion].sort((a, b) => a.grade - b.grade);
    setQuestions(newQuestions);
    setQuestionErrorMsg('Custom question added to selection');
    setTimeout(() => setQuestionErrorMsg(''), 3000);
  }, [questions]);

  // Action to set version and emit to others (GameMaster only)
  const setPreviewOverlayVersion = useCallback((version: 'v1' | 'v2') => {
    setPreviewOverlayVersionState(version);
    socketService.emit('preview_overlay_version_changed', { version });
  }, []);

  // Action to toggle version
  const togglePreviewOverlayVersion = useCallback(() => {
    setPreviewOverlayVersion(previewOverlayVersion === 'v1' ? 'v2' : 'v1');
  }, [previewOverlayVersion, setPreviewOverlayVersion]);

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

  // New filtering functions
  const loadMetadataByLanguage = useCallback(async (language: string) => {
    setIsLoadingMetadata(true);
    try {
      const [subjectsData, gradesData] = await Promise.all([
        supabaseService.getSubjectsByLanguage(language),
        supabaseService.getGradesByLanguage(language)
      ]);
      setAvailableSubjects(subjectsData);
      setAvailableGrades(gradesData);
    } catch (error) {
      console.error('Error loading metadata by language:', error);
      setQuestionErrorMsg('Failed to load subjects and grades');
      setTimeout(() => setQuestionErrorMsg(''), 3000);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, []);

  const toggleSubjectSelection = useCallback((subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  }, []);

  const toggleGradeSelection = useCallback((grade: number) => {
    setSelectedGrades(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade)
        : [...prev, grade]
    );
  }, []);

  const selectAllSubjects = useCallback(() => {
    setSelectedSubjects([...availableSubjects]);
  }, [availableSubjects]);

  const selectAllGrades = useCallback(() => {
    setSelectedGrades([...availableGrades]);
  }, [availableGrades]);

  const clearAllSubjects = useCallback(() => {
    setSelectedSubjects([]);
  }, []);

  const clearAllGrades = useCallback(() => {
    setSelectedGrades([]);
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
      isPointsMode,
      players,
      playerBoards,
      visibleBoards,
      boardVisibility,
      allAnswersThisRound,
      evaluatedAnswers,
      currentVotes,
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
      gmEndGameRequest,
      previewOverlayVersion,
      setPreviewOverlayVersion,
      togglePreviewOverlayVersion,
      isCommunityVotingMode,
      availableSubjects,
      availableGrades,
      selectedSubjects,
      selectedGrades,
      isLoadingMetadata,
      loadMetadataByLanguage,
      setSelectedSubjects,
      setSelectedGrades,
      toggleSubjectSelection,
      toggleGradeSelection,
      selectAllSubjects,
      selectAllGrades,
      clearAllSubjects,
      clearAllGrades,
      loadQuestionsWithFilters
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
  type: 'text', // Always default to 'text' type
  timeLimit: q.timeLimit,
  answer: q.answer,
  grade: parseInt(q.grade, 10) || 0,
  subject: q.subject,
  language: q.language
}); 
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { supabaseService } from '../services/supabaseService';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
}

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
  hasDrawing: boolean;
}

interface AutofillSettings {
  language: string;
  subjects: string[];
  grades: number[];
  questionsPerGrade: number;
}

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [playerBoards, setPlayerBoards] = useState<PlayerBoard[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<AnswerSubmission[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('de'); // Default to German
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [sortByGrade, setSortByGrade] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const [visibleBoards, setVisibleBoards] = useState<Set<string>>(new Set());
  const [boardTransforms, setBoardTransforms] = useState<{[playerId: string]: {scale: number, x: number, y: number}}>(() => ({}));
  const panState = useRef<{[playerId: string]: {panning: boolean, lastX: number, lastY: number}}>({});
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedPreviewPlayer, setSelectedPreviewPlayer] = useState<string | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<AnswerSubmission[]>([]);
  const [showAutofillPopup, setShowAutofillPopup] = useState(false);
  const [autofillSettings, setAutofillSettings] = useState<AutofillSettings>({
    language: 'de',
    subjects: [],
    grades: [],
    questionsPerGrade: 1
  });
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableGrades, setAvailableGrades] = useState<number[]>([]);
  const [isLoadingAutofill, setIsLoadingAutofill] = useState(false);

  useEffect(() => {
    // Connect to socket server
    socketService.connect();

    // Set up event listeners
    socketService.on('room_created', (data) => {
      console.log('Room created:', data);
      setIsLoading(false);
      
      // Set room code received from server
      if (data && data.roomCode) {
        setRoomCode(data.roomCode);
        sessionStorage.setItem('roomCode', data.roomCode);
        sessionStorage.setItem('isGameMaster', 'true');
      }
      
      // Only start the game immediately if questions are already selected
      if (questions.length > 0) {
        setCurrentQuestion(questions[0]);
        
        // Start the game with sorted questions
        socketService.startGame(data.roomCode, questions, timeLimit || undefined);
        setGameStarted(true);
        
        // Initialize timer if timeLimit is set
        if (timeLimit) {
          setTimeRemaining(timeLimit);
          const timer = setInterval(() => {
            setTimeRemaining(prev => {
              if (prev !== null && prev > 0) {
                return prev - 1;
              } else {
                clearInterval(timer);
                return 0;
              }
            });
          }, 1000);
        }
      }
    });
    
    // Add game_started event listener
    socketService.on('game_started', (data) => {
      console.log('Game started event received:', data);
      if (data && data.question) {
        // Ensure the question object has the expected structure
        const questionObj: Question = {
          id: data.question.id || 0,
          text: data.question.text || '',
          answer: data.question.answer,
          grade: data.question.grade || 0,
          subject: data.question.subject || '',
          language: data.question.language || 'de'
        };
        
        console.log('Setting current question:', questionObj);
        setCurrentQuestion(questionObj);
        setGameStarted(true);
        setCurrentQuestionIndex(0);
        
        // Initialize timer if timeLimit is set
        if (data.timeLimit) {
          setTimeLimit(data.timeLimit);
          setTimeRemaining(data.timeLimit);
          
          const timer = setInterval(() => {
            setTimeRemaining(prev => {
              if (prev !== null && prev > 0) {
                return prev - 1;
              } else {
                clearInterval(timer);
                return 0;
              }
            });
          }, 1000);
        }
      }
    });
    
    // Add event handler for new_question event
    socketService.on('new_question', (data) => {
      console.log('New question event received:', data);
      if (data && data.question) {
        // Ensure the question object has the expected structure
        const questionObj: Question = {
          id: data.question.id || 0,
          text: data.question.text || '',
          answer: data.question.answer,
          grade: data.question.grade || 0,
          subject: data.question.subject || '',
          language: data.question.language || 'de'
        };
        
        console.log('Setting next question:', questionObj);
        setCurrentQuestion(questionObj);
        setCurrentQuestionIndex(prev => prev + 1);
        setPendingAnswers([]);
        
        // Reset timer for new question if time limit is set
        if (data.timeLimit) {
          setTimeLimit(data.timeLimit);
          setTimeRemaining(data.timeLimit);
          
          const timer = setInterval(() => {
            setTimeRemaining(prev => {
              if (prev !== null && prev > 0) {
                return prev - 1;
              } else {
                clearInterval(timer);
                return 0;
              }
            });
          }, 1000);
        }
      }
    });
    
    socketService.on('player_joined', (player: Player) => {
      console.log('Player joined:', player);
      // Update players list when a player joins
      setPlayers(prevPlayers => {
        // Check if player already exists
        const existingIndex = prevPlayers.findIndex(p => p.id === player.id);
        if (existingIndex >= 0) {
          // Replace the existing player
          const updatedPlayers = [...prevPlayers];
          updatedPlayers[existingIndex] = player;
          return updatedPlayers;
        } else {
          // Add new player
          return [...prevPlayers, player];
        }
      });
    });

    socketService.on('players_update', (updatedPlayers: Player[]) => {
      console.log('Players updated:', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    socketService.on('player_board_update', (data: PlayerBoard) => {
      console.log(`Received board update from ${data.playerName}`);
      setPlayerBoards(prevBoards => {
        const existingIndex = prevBoards.findIndex(b => b.playerId === data.playerId);
        if (existingIndex >= 0) {
          const updatedBoards = [...prevBoards];
          updatedBoards[existingIndex] = data;
          return updatedBoards;
        } else {
          return [...prevBoards, data];
        }
      });

      // If this player is currently selected, ensure the DOM is updated
      if (selectedPlayerId === data.playerId) {
        setTimeout(() => {
          const boardElement = document.querySelector('.drawing-board');
          if (boardElement) {
            boardElement.innerHTML = data.boardData;
          }
        }, 10);
      }
    });

    socketService.on('answer_submitted', (submission: AnswerSubmission) => {
      console.log(`Answer received from ${submission.playerName}:`, submission.answer);
      
      // Make sure we're not adding duplicate answers
      setPendingAnswers(prev => {
        // Check if we already have an answer from this player
        const existingIndex = prev.findIndex(a => a.playerId === submission.playerId);
        
        if (existingIndex >= 0) {
          // Replace the existing answer
          console.log(`Replacing existing answer for ${submission.playerName}`);
          const updatedAnswers = [...prev];
          updatedAnswers[existingIndex] = submission;
          return updatedAnswers;
        } else {
          // Add as new answer
          console.log(`Adding new answer from ${submission.playerName}`);
          return [...prev, submission];
        }
      });
    });

    socketService.on('error', (msg: string) => {
      setErrorMsg(msg);
      setIsLoading(false);
    });
    
    socketService.on('game_restarted', () => {
      // Reset game state on restart
      setGameStarted(false);
      setCurrentQuestion(null);
      setCurrentQuestionIndex(0);
      setPlayerBoards([]);
      setPendingAnswers([]);
      setTimeRemaining(null);
      setIsRestarting(false);
    });
    
    socketService.on('timer_update', (data: { timeRemaining: number }) => {
      const now = performance.now();
      // Only update if at least 900ms have passed since last update
      if (now - timerUpdateRef.current >= 900) {
        // Use requestAnimationFrame for smooth updates
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        animationFrameRef.current = requestAnimationFrame(() => {
          setTimeRemaining(data.timeRemaining);
          setIsTimerRunning(true);
          timerUpdateRef.current = now;
        });
      }
    });

    socketService.on('time_up', () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      requestAnimationFrame(() => {
        setTimeRemaining(0);
        setIsTimerRunning(false);
        timerUpdateRef.current = performance.now();
      });
    });

    // Add handler for end_round_early event
    socketService.on('end_round_early', () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      requestAnimationFrame(() => {
        setTimeRemaining(0);
        setIsTimerRunning(false);
        timerUpdateRef.current = performance.now();
      });
    });

    // Check if returning from a refresh (restore state)
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const isGameMaster = sessionStorage.getItem('isGameMaster') === 'true';
    
    if (savedRoomCode && isGameMaster) {
      console.log('Rejoining as gamemaster for room:', savedRoomCode);
      setRoomCode(savedRoomCode);
      // Re-join as gamemaster to ensure we get the current state
      socketService.emit('rejoin_gamemaster', { roomCode: savedRoomCode });
    }

    return () => {
      // Clean up listeners
      socketService.off('room_created');
      socketService.off('game_started');
      socketService.off('new_question');
      socketService.off('player_joined');
      socketService.off('players_update');
      socketService.off('player_board_update');
      socketService.off('answer_submitted');
      socketService.off('error');
      socketService.off('game_restarted');
      socketService.off('timer_update');
      socketService.off('time_up');
      socketService.off('end_round_early');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Fetch available subjects and languages from Supabase when component mounts
  useEffect(() => {
    const fetchData = async () => {
      const subjectList = await supabaseService.getSubjects();
      setSubjects(subjectList);
      
      const languageList = await supabaseService.getLanguages();
      setLanguages(languageList);
    };

    fetchData();
  }, []);

  useEffect(() => {
    // Update preview answers when pending answers change
    setPreviewAnswers(pendingAnswers);
  }, [pendingAnswers]);

  const createRoom = () => {
    console.log('Creating new room...');
    setIsLoading(true);
    socketService.createRoom(roomCodeInput);
  };

  const startGame = () => {
    if (!roomCode) {
      setErrorMsg('Please enter a room code!');
      return;
    }
    
    if (selectedQuestions.length === 0) {
      setErrorMsg('Please select at least one question!');
      return;
    }
    
    // Sort questions by grade before starting the game
    const gradeSortedQuestions = [...selectedQuestions].sort((a, b) => a.grade - b.grade);
    setSelectedQuestions(gradeSortedQuestions);
    setQuestions(gradeSortedQuestions);
    
    // Set the first question as the current question
    setCurrentQuestion(gradeSortedQuestions[0]);
    setCurrentQuestionIndex(0);
    
    // Start the game with the existing room
    setIsLoading(true);
    // If timeLimit is null or blank, set it to 99999 internally but don't show it
    const effectiveTimeLimit = timeLimit === null ? 99999 : timeLimit;
    socketService.startGame(roomCode, gradeSortedQuestions, effectiveTimeLimit);
    setGameStarted(true);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // Do NOT update currentQuestionIndex or currentQuestion here!
      setPendingAnswers([]);
      setTimeRemaining(null);
      setIsTimerRunning(false);
      socketService.nextQuestion(roomCode);
    } else {
      alert('No more questions available!');
    }
  };

  const evaluateAnswer = (playerId: string, isCorrect: boolean) => {
    socketService.evaluateAnswer(roomCode, playerId, isCorrect);
    setPendingAnswers(prev => prev.filter(a => a.playerId !== playerId));
  };

  const addCustomQuestion = async () => {
    const text = prompt('Enter the question:');
    if (text) {
      const answerInput = prompt('Enter the answer:');
      const answer = answerInput || undefined;
      const subject = prompt('Enter the subject:') || 'General';
      const grade = parseInt(prompt('Enter the grade level (1-13):') || '5', 10);
      const language = prompt('Enter the language (e.g., de, en):') || 'de';
      
      const newQuestion: Question = {
        id: questions.length + 1,
        text,
        answer,
        subject,
        grade: Math.min(13, Math.max(1, grade)), // Ensure between 1-13
        language
      };
      
      setQuestions(prev => [...prev, newQuestion]);
      
      // Save the question to the database
      try {
        setErrorMsg('Saving question to database...');
        const savedQuestion = await supabaseService.addQuestion(newQuestion);
        
        if (savedQuestion) {
          setErrorMsg('Question saved to database successfully!');
          
          // Update subjects and languages lists if new values were added
          if (!subjects.includes(subject)) {
            setSubjects(prev => [...prev, subject].sort());
          }
          
          if (language && !languages.includes(language)) {
            setLanguages(prev => [...prev, language].sort());
          }
          
          setTimeout(() => setErrorMsg(''), 3000);
        } else {
          setErrorMsg('Failed to save question to database.');
        }
      } catch (error) {
        console.error('Error saving question:', error);
        setErrorMsg('Error saving question to database.');
      }
    }
  };

  const restartGame = () => {
    setIsRestarting(true);
    socketService.restartGame(roomCode);
  };

  const loadQuestionsFromSupabase = async () => {
    setIsLoadingQuestions(true);
    
    try {
      const options: {
        subject?: string;
        grade?: number;
        language?: string;
        limit?: number;
        sortByGrade?: boolean;
      } = {}; // No limit to get all available questions
      
      if (selectedSubject) {
        options.subject = selectedSubject;
      }
      
      if (selectedGrade !== '') {
        options.grade = Number(selectedGrade);
      }
      
      if (selectedLanguage) {
        options.language = selectedLanguage;
      }
      
      // Always sort by grade to ensure progression from lowest to highest
      options.sortByGrade = sortByGrade;
      
      const loadedQuestions = await supabaseService.getQuestions(options);
      
      if (loadedQuestions && loadedQuestions.length > 0) {
        setAvailableQuestions(loadedQuestions);
        setErrorMsg('');
      } else {
        setErrorMsg('No questions found with the selected filters');
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      setErrorMsg('Failed to load questions. Please try again.');
    } finally {
      setIsLoadingQuestions(false);
    }
  };
  
  const addQuestionToSelected = (question: Question) => {
    setSelectedQuestions(prev => [...prev, question]);
    setAvailableQuestions(prev => prev.filter(q => q.id !== question.id));
  };
  
  const removeSelectedQuestion = (questionId: number) => {
    const questionToRemove = selectedQuestions.find(q => q.id === questionId);
    if (questionToRemove) {
      setSelectedQuestions(prev => prev.filter(q => q.id !== questionId));
      setAvailableQuestions(prev => [...prev, questionToRemove].sort((a, b) => a.grade - b.grade));
    }
  };
  
  const organizeSelectedQuestions = () => {
    // Sort selected questions by grade (ascending)
    const organized = [...selectedQuestions].sort((a, b) => a.grade - b.grade);
    setSelectedQuestions(organized);
    setQuestions(organized);
  };

  // Format time remaining with smooth transitions
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add toggle function for board visibility
  const toggleBoardVisibility = (playerId: string) => {
    setVisibleBoards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // Helper to update transform state
  const updateBoardTransform = (playerId: string, update: (t: {scale: number, x: number, y: number}) => {scale: number, x: number, y: number}) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: update(prev[playerId] || {scale: 1, x: 0, y: 0})
    }));
  };

  const handleEndRoundEarly = () => {
    setShowEndRoundConfirm(true);
  };

  const confirmEndRoundEarly = () => {
    socketService.endRoundEarly(roomCode);
    setShowEndRoundConfirm(false);
  };

  const cancelEndRoundEarly = () => {
    setShowEndRoundConfirm(false);
  };

  const togglePreviewMode = () => {
    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) {
      setSelectedPreviewPlayer(null);
    }
  };

  const selectPreviewPlayer = (playerId: string) => {
    setSelectedPreviewPlayer(playerId);
  };

  const nextPreviewPlayer = () => {
    if (previewAnswers.length === 0) return;
    
    const currentIndex = selectedPreviewPlayer 
      ? previewAnswers.findIndex(a => a.playerId === selectedPreviewPlayer)
      : -1;
    
    const nextIndex = (currentIndex + 1) % previewAnswers.length;
    setSelectedPreviewPlayer(previewAnswers[nextIndex].playerId);
  };

  const prevPreviewPlayer = () => {
    if (previewAnswers.length === 0) return;
    
    const currentIndex = selectedPreviewPlayer 
      ? previewAnswers.findIndex(a => a.playerId === selectedPreviewPlayer)
      : -1;
    
    const prevIndex = (currentIndex - 1 + previewAnswers.length) % previewAnswers.length;
    setSelectedPreviewPlayer(previewAnswers[prevIndex].playerId);
  };

  const handleAutofillQuestions = async () => {
    setIsLoadingAutofill(true);
    try {
      const response = await fetch('/api/questions/autofill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(autofillSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }

      const questions: Question[] = await response.json();
      setQuestions(questions);
      setShowAutofillPopup(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Failed to fetch questions. Please try again.');
    } finally {
      setIsLoadingAutofill(false);
    }
  };

  const handleLanguageChange = async (language: string) => {
    setAutofillSettings(prev => ({ ...prev, language }));
    try {
      const response = await fetch(`/api/questions/metadata?language=${language}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metadata');
      }
      const metadata = await response.json();
      setAvailableSubjects(metadata.subjects);
      setAvailableGrades(metadata.grades);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const handleSubjectToggle = (subject: string) => {
    setAutofillSettings(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleGradeToggle = (grade: number) => {
    setAutofillSettings(prev => ({
      ...prev,
      grades: prev.grades.includes(grade)
        ? prev.grades.filter(g => g !== grade)
        : [...prev.grades, grade]
    }));
  };

  const handleMarkAllSubjects = () => {
    setAutofillSettings(prev => ({
      ...prev,
      subjects: availableSubjects
    }));
  };

  const handleMarkAllGrades = () => {
    setAutofillSettings(prev => ({
      ...prev,
      grades: availableGrades
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Questions</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAutofillPopup(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Autofill Questions
              </button>
              <button
                onClick={addCustomQuestion}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Add Question
              </button>
            </div>
          </div>
          {/* ... existing questions list ... */}
        </div>
      </div>

      {/* Autofill Popup */}
      {showAutofillPopup && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Autofill Questions</h3>
            
            {/* Language Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <select
                value={autofillSettings.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="de">German</option>
                <option value="en">English</option>
                <option value="fr">French</option>
              </select>
            </div>

            {/* Subjects Selection */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Subjects</label>
                <button
                  onClick={handleMarkAllSubjects}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Mark All
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {availableSubjects.map((subject) => (
                  <label key={subject} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={autofillSettings.subjects.includes(subject)}
                      onChange={() => handleSubjectToggle(subject)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{subject}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Grades Selection */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Grades</label>
                <button
                  onClick={handleMarkAllGrades}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Mark All
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {availableGrades.map((grade) => (
                  <label key={grade} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={autofillSettings.grades.includes(grade)}
                      onChange={() => handleGradeToggle(grade)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Grade {grade}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Questions per Grade */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Questions per Grade Level
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={autofillSettings.questionsPerGrade}
                onChange={(e) => setAutofillSettings(prev => ({
                  ...prev,
                  questionsPerGrade: Math.min(10, Math.max(1, parseInt(e.target.value) || 1))
                }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAutofillPopup(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={handleAutofillQuestions}
                disabled={isLoadingAutofill || autofillSettings.subjects.length === 0 || autofillSettings.grades.length === 0}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingAutofill ? 'Loading...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameMaster; 
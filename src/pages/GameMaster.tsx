import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { supabaseService } from '../services/supabaseService';
import audioService from '../services/audioService';

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
}

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
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
  const [enlargedPlayerId, setEnlargedPlayerId] = useState<string | null>(null);
  const [evaluatedAnswers, setEvaluatedAnswers] = useState<{[playerId: string]: boolean | null}>({});
  const [allAnswersThisRound, setAllAnswersThisRound] = useState<{[playerId: string]: AnswerSubmission}>({});
  const [isMuted, setIsMuted] = useState(audioService.isMusicMuted());
  const [volume, setVolume] = useState(audioService.getVolume());
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({
    isActive: false,
    focusedPlayerId: null
  });

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
        setAllAnswersThisRound({});
        
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
      
      setAllAnswersThisRound(prev => ({ ...prev, [submission.playerId]: submission }));
      setPendingAnswers(prev => {
        const existingIndex = prev.findIndex(a => a.playerId === submission.playerId);
        if (existingIndex >= 0) {
          const updatedAnswers = [...prev];
          updatedAnswers[existingIndex] = submission;
          return updatedAnswers;
        } else {
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
      setAllAnswersThisRound({});
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

    // Add preview mode event listeners
    socketService.on('focus_submission', (data: { playerId: string }) => {
      setPreviewMode(prev => ({ ...prev, focusedPlayerId: data.playerId }));
    });

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
      socketService.off('focus_submission');
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
    // Start playing background music when component mounts
    audioService.playBackgroundMusic();

    // Cleanup when component unmounts
    return () => {
      audioService.pauseBackgroundMusic();
    };
  }, []);

  const handleToggleMute = () => {
    const newMuteState = audioService.toggleMute();
    setIsMuted(newMuteState);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    audioService.setVolume(newVolume);
    setVolume(newVolume);
  };

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
    setEvaluatedAnswers(prev => ({ ...prev, [playerId]: isCorrect }));
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

  // Fit to screen handler
  const fitToScreen = (playerId: string) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: {scale: 1, x: 0, y: 0}
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

  // Add a function to check if all answers are in
  const allAnswersIn = players.length > 0 && pendingAnswers.length === 0 && gameStarted;

  // Set initial scale to 0.4 for each board
  useEffect(() => {
    const initialTransforms: {[playerId: string]: {scale: number, x: number, y: number}} = {};
    players.forEach(player => {
      initialTransforms[player.id] = { scale: 0.4, x: 0, y: 0 };
    });
    setBoardTransforms(initialTransforms);
  }, [players]);

  // Add toggle scale on click
  const toggleBoardScale = (playerId: string) => {
    setBoardTransforms(prev => {
      const current = prev[playerId] || { scale: 0.4, x: 0, y: 0 };
      const newScale = current.scale === 0.4 ? 1.0 : 0.4;
      return {
        ...prev,
        [playerId]: { ...current, scale: newScale }
      };
    });
  };

  const handleStartPreviewMode = () => {
    socketService.startPreviewMode(roomCode);
    setPreviewMode(prev => ({ ...prev, isActive: true }));
  };

  const handleStopPreviewMode = () => {
    socketService.stopPreviewMode(roomCode);
    setPreviewMode({ isActive: false, focusedPlayerId: null });
  };

  const handleFocusSubmission = (playerId: string) => {
    socketService.focusSubmission(roomCode, playerId);
  };

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="text-center mb-0">Game Master Dashboard</h1>
        <div className="d-flex align-items-center gap-2">
          <input
            type="range"
            className="form-range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            style={{ width: '100px' }}
            title="Volume"
          />
          <button
            className="btn btn-outline-secondary"
            onClick={handleToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <i className="bi bi-volume-mute-fill"></i>
            ) : (
              <i className="bi bi-volume-up-fill"></i>
            )}
          </button>
        </div>
      </div>
      
      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          {errorMsg}
          <button 
            type="button" 
            className="btn-close float-end" 
            onClick={() => setErrorMsg('')}
            aria-label="Close"
          ></button>
        </div>
      )}
      
      {showEndRoundConfirm && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">End Round Early?</h5>
                <button type="button" className="btn-close" onClick={cancelEndRoundEarly}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to end this round early? All players' current answers will be submitted automatically.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cancelEndRoundEarly}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmEndRoundEarly}>End Round</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!roomCode ? (
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card p-4 text-center">
              <h3>Create a New Game Room</h3>
              <p>As the Game Master, you'll manage questions and evaluate answers.</p>
              <div className="form-group mb-3">
                <label htmlFor="roomCodeInput" className="form-label">Room Code (optional):</label>
                <input
                  type="text"
                  id="roomCodeInput"
                  className="form-control"
                  placeholder="Leave blank for random code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                />
                <small className="text-muted">You can specify a custom room code or leave it blank for a random one.</small>
              </div>
              <button 
                className="btn btn-primary btn-lg mt-3"
                onClick={createRoom}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Room'}
              </button>
              <button 
                className="btn btn-outline-secondary mt-3"
                onClick={() => navigate('/')}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="game-master-container" style={{ 
          backgroundImage: 'linear-gradient(to bottom right, #8B4513, #A0522D)', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat'
        }}>
          <div className="row">
            <div className="col-md-4">
              <div className="card mb-4">
                <div className="card-header">
                  <h3 className="mb-0">Room Information</h3>
                </div>
                <div className="card-body text-center">
                  <h5>Room Code:</h5>
                  <div className="room-code">{roomCode}</div>
                  <p className="mb-3">Share this code with players to join</p>
                  
                  {!gameStarted && (
                    <>
                      <div className="mb-3">
                        <label htmlFor="timeLimit" className="form-label">Time Limit (seconds):</label>
                        <input 
                          type="number"
                          id="timeLimit"
                          className="form-control mb-2"
                          min="0"
                          value={timeLimit || ''}
                          onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value, 10) : null)}
                          placeholder="No time limit"
                        />
                        <small className="text-muted">Leave empty for no time limit</small>
                      </div>
                      <button 
                        className="btn btn-success btn-lg w-100"
                        onClick={startGame}
                        disabled={players.length < 2}
                      >
                        Start Game ({players.length}/2 players)
                      </button>
                    </>
                  )}
                  
                  {gameStarted && (
                    <button 
                      className="btn btn-warning btn-lg w-100"
                      onClick={restartGame}
                      disabled={isRestarting}
                    >
                      {isRestarting ? 'Restarting...' : 'Restart Game'}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="card mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h3 className="mb-0">Players</h3>
                  <span className="badge bg-primary">{players.length}</span>
                </div>
                <div className="card-body p-0">
                  <ul className="list-group list-group-flush player-list">
                    {players.map(player => (
                      <li 
                        key={player.id} 
                        className={`list-group-item d-flex justify-content-between align-items-center ${!player.isActive ? 'text-muted' : ''}`}
                      >
                        <div className="d-flex align-items-center">
                          <span>{player.name} {!player.isActive && '(Eliminated)'}</span>
                          <button
                            className={`btn btn-sm ms-2 ${visibleBoards.has(player.id) ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => toggleBoardVisibility(player.id)}
                            title={visibleBoards.has(player.id) ? "Hide board" : "Show board"}
                          >
                            {visibleBoards.has(player.id) ? 'Hide Board' : 'Show Board'}
                          </button>
                        </div>
                        <div>
                          {Array.from({length: player.lives}, (_, i) => (
                            <span key={i} className="text-danger me-1">❤</span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {gameStarted && (
                <div className="card mb-4">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h3 className="mb-0">Questions</h3>
                    <button 
                      className="btn btn-sm btn-outline-primary"
                      onClick={addCustomQuestion}
                    >
                      Add Question
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="mb-3 text-center">
                      {timeLimit !== null && timeLimit < 99999 && (
                        <>
                          <h5>Time Remaining:</h5>
                          <div className={`timer ${(timeRemaining !== null && timeRemaining < 10) ? 'text-danger' : ''}`}>
                            {formatTime(timeRemaining)}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <h5>Current Question ({currentQuestionIndex + 1}/{questions.length}):</h5>
                      <div className="question-container">
                        <p className="mb-1">{currentQuestion?.text}</p>
                        <small>Grade: {currentQuestion?.grade} | Subject: {currentQuestion?.subject} | Language: {currentQuestion?.language || 'de'}</small>
                        {currentQuestion?.answer && (
                          <div className="mt-2 correct-answer">
                            <strong>Correct Answer:</strong> {currentQuestion.answer}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button 
                      className="btn btn-primary w-100"
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex >= questions.length - 1 || pendingAnswers.length > 0}
                    >
                      Next Question
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="col-md-8">
              {gameStarted ? (
                <>
                  <div className="card mb-4">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <h3 className="mb-0">Pending Answers</h3>
                      <button 
                        className="btn btn-warning"
                        onClick={handleEndRoundEarly}
                        disabled={!(gameStarted && currentQuestion)}
                      >
                        End Round Early
                      </button>
                    </div>
                    <div className="card-body">
                      {pendingAnswers.length === 0 ? (
                        <p className="text-center">No pending answers</p>
                      ) : (
                        <ul className="list-group">
                          {pendingAnswers.map((submission, index) => (
                            <li key={index} className="list-group-item">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <h5 className="mb-0">{submission.playerName}</h5>
                                <div>
                                  <button 
                                    className="btn btn-success me-2"
                                    onClick={() => evaluateAnswer(submission.playerId, true)}
                                  >
                                    Correct
                                  </button>
                                  <button 
                                    className="btn btn-danger"
                                    onClick={() => evaluateAnswer(submission.playerId, false)}
                                  >
                                    Incorrect
                                  </button>
                                </div>
                              </div>
                              <div className="answer-container">
                                <p className="mb-1"><strong>Player's Answer:</strong> {submission.answer}</p>
                                {currentQuestion?.answer && (
                                  <p className="mb-0 text-success small">
                                    <strong>Correct Answer:</strong> {currentQuestion.answer}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  
                  <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <h3 className="mb-0">Player Boards</h3>
                      <div>
                        <button 
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => setVisibleBoards(new Set())}
                        >
                          Hide All
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setVisibleBoards(new Set(players.map(p => p.id)))}
                        >
                          Show All
                        </button>
                      </div>
                    </div>
                    <div className="card-body">
                      {playerBoards.length === 0 ? (
                        <p className="text-center">No player boards available</p>
                      ) : (
                        <div className="row">
                          {playerBoards
                            .filter(board => visibleBoards.has(board.playerId))
                            .map((board) => {
                              const player = players.find(p => p.id === board.playerId);
                              return (
                                <div key={board.playerId} className="col-md-6 mb-4">
                                  <div className="card h-100">
                                    <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                                      <h5 className="mb-0">{board.playerName || 'Unknown Player'} {!player?.isActive && '(Eliminated)'}</h5>
                                      <button
                                        className="btn btn-sm btn-light"
                                        onClick={() => toggleBoardVisibility(board.playerId)}
                                      >
                                        Hide
                                      </button>
                                    </div>
                                    <div className="card-body p-0" style={{ minHeight: '350px', position: 'relative' }}>
                                      <div
                                        className="drawing-board-panzoom"
                                        style={{
                                          width: '100%',
                                          height: '320px',
                                          position: 'relative',
                                          overflow: 'hidden',
                                          cursor: 'grab',
                                          background: '#0C6A35',
                                          zIndex: 1
                                        }}
                                        onWheel={e => {
                                          if (!e.altKey) return;
                                          e.preventDefault();
                                          const playerId = board.playerId;
                                          const delta = e.deltaY < 0 ? 0.1 : -0.1;
                                          updateBoardTransform(playerId, t => {
                                            let newScale = Math.max(0.2, Math.min(3, t.scale + delta));
                                            return { ...t, scale: newScale };
                                          });
                                        }}
                                        onMouseDown={e => {
                                          if (!e.altKey) return;
                                          e.preventDefault();
                                          const playerId = board.playerId;
                                          panState.current[playerId] = { panning: true, lastX: e.clientX, lastY: e.clientY };
                                        }}
                                        onMouseMove={e => {
                                          const playerId = board.playerId;
                                          if (panState.current[playerId]?.panning) {
                                            e.preventDefault();
                                            const dx = e.clientX - panState.current[playerId].lastX;
                                            const dy = e.clientY - panState.current[playerId].lastY;
                                            panState.current[playerId].lastX = e.clientX;
                                            panState.current[playerId].lastY = e.clientY;
                                            updateBoardTransform(playerId, t => ({ ...t, x: t.x + dx, y: t.y + dy }));
                                          }
                                        }}
                                        onMouseUp={e => {
                                          const playerId = board.playerId;
                                          if (panState.current[playerId]) panState.current[playerId].panning = false;
                                        }}
                                        onMouseLeave={e => {
                                          const playerId = board.playerId;
                                          if (panState.current[playerId]) panState.current[playerId].panning = false;
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: 400,
                                            height: 200,
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            transformOrigin: 'center center',
                                            transform: `translate(${(boardTransforms[board.playerId]?.x||0)}px, ${(boardTransforms[board.playerId]?.y||0)}px) scale(${boardTransforms[board.playerId]?.scale||1})`,
                                            transition: 'transform 0.2s ease-out',
                                            pointerEvents: 'none',
                                          }}
                                          className="drawing-board"
                                          dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
                                        />
                                      </div>
                                    </div>
                                    <div className="card-footer d-flex justify-content-between align-items-center">
                                      <span>
                                        {Array.from({length: player?.lives || 0}, (_, i) => (
                                          <span key={i} className="text-danger me-1" role="img" aria-label="heart">❤</span>
                                        ))}
                                      </span>
                                      {pendingAnswers.find(a => a.playerId === board.playerId) && (
                                        <div>
                                          <button 
                                            className="btn btn-sm btn-success me-2"
                                            onClick={() => evaluateAnswer(board.playerId, true)}
                                          >
                                            Correct
                                          </button>
                                          <button 
                                            className="btn btn-sm btn-danger"
                                            onClick={() => evaluateAnswer(board.playerId, false)}
                                          >
                                            Incorrect
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <h3 className="mb-0">Getting Started</h3>
                  </div>
                  <div className="card-body">
                    <p className="mb-4">
                      Welcome to the Game Master dashboard! Share the room code with your players and prepare your questions. When everyone is ready, start the game!
                    </p>
                    
                    <div className="mb-4">
                      <h5>Current Players:</h5>
                      {players.length === 0 ? (
                        <p className="text-center text-muted">No players have joined yet</p>
                      ) : (
                        <ul className="list-group">
                          {players.map(player => (
                            <li key={player.id} className="list-group-item">
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <h5>Room Settings:</h5>
                      <div className="mb-3">
                        <label htmlFor="timeLimitInput" className="form-label">Time Limit per Question (seconds):</label>
                        <input
                          type="number"
                          id="timeLimitInput"
                          className="form-control"
                          placeholder="No time limit"
                          min="5"
                          max="300"
                          value={timeLimit === null ? '' : timeLimit}
                          onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <h5>Load Questions from Database:</h5>
                      <div className="row g-3 mb-3">
                        <div className="col-md-3">
                          <label htmlFor="languageSelect" className="form-label">Language</label>
                          <select 
                            id="languageSelect" 
                            className="form-select"
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                          >
                            {languages.length > 0 ? (
                              languages.map((language, index) => (
                                <option key={index} value={language}>{language}</option>
                              ))
                            ) : (
                              <option value="de">de</option>
                            )}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="subjectSelect" className="form-label">Subject</label>
                          <select 
                            id="subjectSelect" 
                            className="form-select"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                          >
                            <option value="">All Subjects</option>
                            {subjects.map((subject, index) => (
                              <option key={index} value={subject}>{subject}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="gradeSelect" className="form-label">Grade</label>
                          <select 
                            id="gradeSelect" 
                            className="form-select"
                            value={selectedGrade}
                            onChange={(e) => setSelectedGrade(e.target.value ? Number(e.target.value) : '')}
                          >
                            <option value="">All Grades</option>
                            {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">&nbsp;</label>
                          <button 
                            className="btn btn-primary d-block w-100"
                            onClick={loadQuestionsFromSupabase}
                            disabled={isLoadingQuestions}
                          >
                            {isLoadingQuestions ? 'Loading...' : 'Search Questions'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="sortByGradeCheckbox"
                            checked={sortByGrade}
                            onChange={(e) => setSortByGrade(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="sortByGradeCheckbox">
                            Sort questions by grade (lowest to highest)
                          </label>
                        </div>
                      </div>
                      
                      <div className="row">
                        <div className="col-md-6">
                          <div className="card mb-3">
                            <div className="card-header bg-light">
                              <h6 className="mb-0">Available Questions ({availableQuestions.length})</h6>
                            </div>
                            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
                              {availableQuestions.length === 0 ? (
                                <p className="text-center text-muted">No questions available. Use the filters above to search for questions.</p>
                              ) : (
                                <div className="list-group">
                                  {availableQuestions.map((question) => (
                                    <div key={question.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                      <div>
                                        <p className="mb-1 fw-bold">{question.text}</p>
                                        <small>
                                          Grade: {question.grade} | {question.subject} | {question.language || 'de'}
                                          {question.answer && <span> | Answer: {question.answer}</span>}
                                        </small>
                                      </div>
                                      <button 
                                        className="btn btn-sm btn-success" 
                                        onClick={() => addQuestionToSelected(question)}
                                        title="Add to selected questions"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="col-md-6">
                          <div className="card mb-3">
                            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">Selected Questions ({selectedQuestions.length})</h6>
                              <button 
                                className="btn btn-sm btn-outline-primary" 
                                onClick={organizeSelectedQuestions}
                                disabled={selectedQuestions.length < 2}
                                title="Sort by grade (lowest to highest)"
                              >
                                Sort by Grade
                              </button>
                            </div>
                            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
                              {selectedQuestions.length === 0 ? (
                                <p className="text-center text-muted">No questions selected yet. Add questions from the left panel.</p>
                              ) : (
                                <div className="list-group">
                                  {selectedQuestions.map((question, index) => (
                                    <div key={question.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                      <div>
                                        <div className="d-flex align-items-center mb-1">
                                          <span className="badge bg-primary me-2">{index + 1}</span>
                                          <span className="fw-bold">{question.text}</span>
                                        </div>
                                        <small>
                                          Grade: {question.grade} | {question.subject} | {question.language || 'de'}
                                          {question.answer && <span> | Answer: {question.answer}</span>}
                                        </small>
                                      </div>
                                      <button 
                                        className="btn btn-sm btn-danger" 
                                        onClick={() => removeSelectedQuestion(question.id)}
                                        title="Remove from selected questions"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <h6>Selected Question Summary:</h6>
                        {selectedQuestions.length > 0 ? (
                          <>
                            <p>Total questions: {selectedQuestions.length}</p>
                            <p>Grade range: {Math.min(...selectedQuestions.map(q => q.grade))} - {Math.max(...selectedQuestions.map(q => q.grade))}</p>
                            <p>Subjects: {Array.from(new Set(selectedQuestions.map(q => q.subject))).join(', ')}</p>
                          </>
                        ) : (
                          <p className="text-muted">No questions selected yet</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <button 
                        className="btn btn-success btn-lg w-100"
                        onClick={addCustomQuestion}
                      >
                        Add Custom Question
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Preview Mode Controls */}
      <div className="preview-mode-controls mt-3" style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '10px 20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        {!previewMode.isActive ? (
          <button
            className="btn btn-primary"
            onClick={handleStartPreviewMode}
            disabled={!allAnswersIn}
          >
            Start Preview Mode
          </button>
        ) : (
          <>
            <button
              className="btn btn-secondary"
              onClick={handleStopPreviewMode}
            >
              Stop Preview Mode
            </button>
            {previewMode.focusedPlayerId && (
              <button
                className="btn btn-outline-primary"
                onClick={() => handleFocusSubmission('')}
              >
                Back to Gallery
              </button>
            )}
          </>
        )}
      </div>

      {/* Preview Mode Overlay */}
      {previewMode.isActive && (
        <div className="preview-mode-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="preview-content" style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            {/* Close button */}
            <button
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'transparent',
                border: 'none',
                fontSize: 32,
                cursor: 'pointer',
                zIndex: 10001
              }}
              aria-label="Close Preview Mode"
              onClick={handleStopPreviewMode}
            >
              ×
            </button>
            <h2 className="text-center mb-4">Round Preview</h2>
            {previewMode.focusedPlayerId ? (
              // Focused view
              <div className="focused-submission">
                {(() => {
                  const focusedPlayer = players.find(p => p.id === previewMode.focusedPlayerId);
                  const focusedAnswer = allAnswersThisRound[previewMode.focusedPlayerId];
                  const focusedBoard = playerBoards.find(b => b.playerId === previewMode.focusedPlayerId);
                  const evalStatus = evaluatedAnswers?.[previewMode.focusedPlayerId];
                  return (
                    <>
                      <h3 className="text-center mb-3">{focusedPlayer?.name}</h3>
                      <div className="board-container" style={{
                        width: '100%',
                        maxWidth: '800px',
                        margin: '0 auto',
                        background: '#0C6A35',
                        border: '8px solid #8B4513',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        {focusedBoard?.boardData ? (
                          <div dangerouslySetInnerHTML={{ __html: focusedBoard.boardData }} />
                        ) : (
                          <div className="text-center text-white p-4">No drawing submitted</div>
                        )}
                      </div>
                      <div className="answer-container mt-3 text-center">
                        <h4>Answer:</h4>
                        <p>{focusedAnswer?.answer || 'No answer submitted'}{' '}
                          {evalStatus === true && <span title="Correct" style={{fontSize: '1.5em', color: 'green'}}>👍</span>}
                          {evalStatus === false && <span title="Incorrect" style={{fontSize: '1.5em', color: 'red'}}>👎</span>}
                        </p>
                      </div>
                      <div className="navigation-controls mt-4" style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '10px'
                      }}>
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => {
                            const currentIndex = players.findIndex(p => p.id === previewMode.focusedPlayerId);
                            const prevIndex = (currentIndex - 1 + players.length) % players.length;
                            handleFocusSubmission(players[prevIndex].id);
                          }}
                        >
                          Previous
                        </button>
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => {
                            const currentIndex = players.findIndex(p => p.id === previewMode.focusedPlayerId);
                            const nextIndex = (currentIndex + 1) % players.length;
                            handleFocusSubmission(players[nextIndex].id);
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              // Gallery view
              <div className="submissions-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                padding: '20px'
              }}>
                {players.map(player => {
                  const answer = allAnswersThisRound[player.id];
                  const board = playerBoards.find(b => b.playerId === player.id);
                  const evalStatus = evaluatedAnswers?.[player.id];
                  return (
                    <div 
                      key={player.id} 
                      className="submission-card" 
                      style={{
                        background: '#fff',
                        borderRadius: '8px',
                        padding: '15px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleFocusSubmission(player.id)}
                    >
                      <h4 className="text-center mb-3">{player.name}</h4>
                      <div className="board-preview" style={{
                        width: '100%',
                        aspectRatio: '2/1',
                        background: '#0C6A35',
                        border: '4px solid #8B4513',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '10px'
                      }}>
                        {board?.boardData ? (
                          <div 
                            style={{
                              transform: 'scale(0.5)',
                              transformOrigin: 'top left',
                              width: '200%',
                              height: '200%'
                            }}
                            dangerouslySetInnerHTML={{ __html: board.boardData }} 
                          />
                        ) : (
                          <div className="text-center text-white p-4">No drawing submitted</div>
                        )}
                      </div>
                      <div className="answer-preview text-center">
                        <p className="mb-0">{answer?.answer || 'No answer submitted'}{' '}
                          {evalStatus === true && <span title="Correct" style={{fontSize: '1.5em', color: 'green'}}>👍</span>}
                          {evalStatus === false && <span title="Incorrect" style={{fontSize: '1.5em', color: 'red'}}>👎</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameMaster; 
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { supabaseService } from '../services/supabaseService';
import audioService from '../services/audioService';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import QuestionSelector from '../components/game-master/QuestionSelector';
import GameControls from '../components/game-master/GameControls';
import QuestionDisplay from '../components/game-master/QuestionDisplay';
import AnswerList from '../components/game-master/AnswerList';
import Timer from '../components/shared/Timer';
import PlayerBoardDisplay from '../components/game-master/PlayerBoardDisplay';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
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
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const handleToggleMute = useCallback(() => {
    const newMuteState = audioService.toggleMute();
    setIsMuted(newMuteState);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    audioService.setVolume(newVolume);
    setVolume(newVolume);
  }, []);

  const createRoom = useCallback(() => {
    console.log('Creating new room...');
    setIsLoading(true);
    socketService.createRoom(roomCodeInput);
  }, [roomCodeInput]);

  const startGame = useCallback(() => {
    if (!roomCode) {
      setErrorMsg('Please enter a room code!');
      return;
    }
    
    if (questions.length === 0) {
      setErrorMsg('Please select at least one question!');
      return;
    }

    if (players.length === 0) {
      setErrorMsg('Please wait for at least one player to join before starting the game!');
      return;
    }
    
    // Sort questions by grade before starting the game
    const gradeSortedQuestions = [...questions].sort((a, b) => a.grade - b.grade);
    setQuestions(gradeSortedQuestions);
    setCurrentQuestion(gradeSortedQuestions[0]);
    setCurrentQuestionIndex(0);
    
    // Start the game with the existing room
    setIsLoading(true);
    // If timeLimit is null or blank, set it to 99999 internally but don't show it
    const effectiveTimeLimit = timeLimit === null ? 99999 : timeLimit;
    socketService.startGame(roomCode, gradeSortedQuestions, effectiveTimeLimit);
    setGameStarted(true);
  }, [roomCode, questions, timeLimit, players]);

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      // Do NOT update currentQuestionIndex or currentQuestion here!
      setPendingAnswers([]);
      setTimeRemaining(null);
      setIsTimerRunning(false);
      socketService.nextQuestion(roomCode);
    } else {
      alert('No more questions available!');
    }
  }, [currentQuestionIndex, questions.length, roomCode]);

  const evaluateAnswer = useCallback((playerId: string, isCorrect: boolean) => {
    socketService.evaluateAnswer(roomCode, playerId, isCorrect);
    setPendingAnswers(prev => prev.filter(a => a.playerId !== playerId));
    setEvaluatedAnswers(prev => ({ ...prev, [playerId]: isCorrect }));
  }, [roomCode]);

  const restartGame = useCallback(() => {
    setIsRestarting(true);
    socketService.restartGame(roomCode);
  }, [roomCode]);

  const handleEndRoundEarly = useCallback(() => {
    setShowEndRoundConfirm(true);
  }, []);

  const confirmEndRoundEarly = useCallback(() => {
    socketService.endRoundEarly(roomCode);
    setShowEndRoundConfirm(false);
  }, [roomCode]);

  const cancelEndRoundEarly = useCallback(() => {
    setShowEndRoundConfirm(false);
  }, []);

  const toggleBoardVisibility = useCallback((playerId: string) => {
    setVisibleBoards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
        // Initialize transform for this board if it doesn't exist
        setBoardTransforms(prevTransforms => ({
          ...prevTransforms,
          [playerId]: prevTransforms[playerId] || { scale: 0.4, x: 0, y: 0 }
        }));
      }
      return newSet;
    });
  }, []);

  const updateBoardTransform = useCallback((playerId: string, update: (t: {scale: number, x: number, y: number}) => {scale: number, x: number, y: number}) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: update(prev[playerId] || {scale: 1, x: 0, y: 0})
    }));
  }, []);

  const fitToScreen = useCallback((playerId: string) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: {scale: 1, x: 0, y: 0}
    }));
  }, []);

  const handleStartPreviewMode = useCallback(() => {
    socketService.startPreviewMode(roomCode);
    setPreviewMode(prev => ({ ...prev, isActive: true }));
  }, [roomCode]);

  const handleStopPreviewMode = useCallback(() => {
    socketService.stopPreviewMode(roomCode);
    setPreviewMode({ isActive: false, focusedPlayerId: null });
  }, [roomCode]);

  const handleFocusSubmission = useCallback((playerId: string) => {
    socketService.focusSubmission(roomCode, playerId);
  }, [roomCode]);

  const handleBoardScale = useCallback((playerId: string, scale: number) => {
    updateBoardTransform(playerId, transform => ({
      ...transform,
      scale: scale
    }));
  }, [updateBoardTransform]);

  const handleBoardPan = useCallback((playerId: string, x: number, y: number) => {
    updateBoardTransform(playerId, transform => ({
      ...transform,
      x: transform.x + x,
      y: transform.y + y
    }));
  }, [updateBoardTransform]);

  const handleBoardReset = useCallback((playerId: string) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: { scale: 1, x: 0, y: 0 }
    }));
  }, []);

  const handlePlayerSelect = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    toggleBoardVisibility(playerId);
  }, []);

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

    // Listen for board_update events (broadcast to all clients)
    socketService.on('board_update', (data: PlayerBoard) => {
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
      setEvaluatedAnswers({});
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
      socketService.off('board_update');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [questions, timeLimit]);

  useEffect(() => {
    // Start playing background music when component mounts
    audioService.playBackgroundMusic();

    // Cleanup when component unmounts
    return () => {
      audioService.pauseBackgroundMusic();
    };
  }, []);

  // Format time remaining with smooth transitions
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
  const toggleBoardScale = useCallback((playerId: string) => {
    setBoardTransforms(prev => {
      const current = prev[playerId] || { scale: 0.4, x: 0, y: 0 };
      const newScale = current.scale === 0.4 ? 1.0 : 0.4;
      return {
        ...prev,
        [playerId]: { ...current, scale: newScale }
      };
    });
  }, []);

  // Initialize visibleBoards when players join
  useEffect(() => {
    const newVisibleBoards = new Set<string>();
    players.forEach(player => {
      if (visibleBoards.has(player.id)) {
        newVisibleBoards.add(player.id);
      }
    });
    setVisibleBoards(newVisibleBoards);
  }, [players]);

  // Reset visibleBoards when game restarts
  useEffect(() => {
    if (isRestarting) {
      setVisibleBoards(new Set());
    }
  }, [isRestarting]);

  // Add a function to check if preview can be started
  const canStartPreview = gameStarted && (
    (players.length > 0 && pendingAnswers.length === 0) ||
    (timeLimit !== null && timeRemaining === 0 && pendingAnswers.length > 0)
  );

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
          Game Master Dashboard
        </div>
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
          <div className="col-12 col-md-6">
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
          padding: '15px', 
          borderRadius: '12px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat'
        }}>
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <RoomCode roomCode={roomCode} />
              {!previewMode.isActive && (
                <div className="mb-3">
                  <button
                    className="btn btn-primary w-100"
                    onClick={handleStartPreviewMode}
                    disabled={!canStartPreview}
                  >
                    Start Preview Mode
                  </button>
                </div>
              )}
              <PlayerList 
                players={players}
                onPlayerSelect={handlePlayerSelect}
                selectedPlayerId={selectedPlayerId}
                title="Players"
              />
            </div>
            
            <div className="col-12 col-md-8">
              <GameControls
                gameStarted={gameStarted}
                currentQuestionIndex={currentQuestionIndex}
                totalQuestions={questions.length}
                onStartGame={startGame}
                onNextQuestion={nextQuestion}
                onRestartGame={restartGame}
                onEndRoundEarly={handleEndRoundEarly}
                isRestarting={isRestarting}
                showEndRoundConfirm={showEndRoundConfirm}
                onConfirmEndRound={confirmEndRoundEarly}
                onCancelEndRound={cancelEndRoundEarly}
                hasPendingAnswers={pendingAnswers.length > 0}
              />
              
              {gameStarted ? (
                <>
                  {currentQuestion && (
                    <div className="card mb-4">
                      <div className="card-body">
                        <QuestionDisplay
                          question={currentQuestion}
                        />
                        <Timer
                          timeLimit={timeLimit}
                          timeRemaining={timeRemaining}
                          isActive={isTimerRunning}
                        />
                      </div>
                    </div>
                  )}

                  <div className="card mb-4">
                    <div className="card-header bg-light">
                      <h5 className="mb-0">Player Boards</h5>
                    </div>
                    <div className="card-body">
                      <div className="d-flex flex-wrap justify-content-center gap-3 board-row">
                        {playerBoards.map(board => (
                          <PlayerBoardDisplay
                            key={board.playerId}
                            board={board}
                            isVisible={visibleBoards.has(board.playerId)}
                            onToggleVisibility={toggleBoardVisibility}
                            transform={boardTransforms[board.playerId] || { scale: 1, x: 0, y: 0 }}
                            onScale={handleBoardScale}
                            onReset={handleBoardReset}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <AnswerList
                    answers={pendingAnswers}
                    onEvaluate={evaluateAnswer}
                    evaluatedAnswers={evaluatedAnswers}
                  />
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
                    
                    <QuestionSelector
                      onQuestionsSelected={setQuestions}
                      selectedQuestions={questions}
                      onSelectedQuestionsChange={setQuestions}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewMode.isActive && (
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
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          width: '90%',
          maxWidth: '500px'
        }}>
          <button
            className="btn btn-secondary w-100"
            onClick={handleStopPreviewMode}
          >
            Stop Preview Mode
          </button>
          {previewMode.focusedPlayerId && (
            <button
              className="btn btn-outline-primary w-100"
              onClick={() => handleFocusSubmission('')}
            >
              Back to Gallery
            </button>
          )}
        </div>
      )}

      {/* Preview Mode Overlay */}
      <PreviewOverlay
        players={players}
        playerBoards={playerBoards}
        allAnswersThisRound={allAnswersThisRound}
        evaluatedAnswers={evaluatedAnswers}
        previewMode={previewMode}
        onFocus={handleFocusSubmission}
        onClose={handleStopPreviewMode}
        isGameMaster={true}
      />
    </div>
  );
};

export default GameMaster; 
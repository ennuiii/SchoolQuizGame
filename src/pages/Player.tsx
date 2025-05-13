import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import socketService from '../services/socketService';
import { throttle } from '../utils/throttle';
import audioService from '../services/audioService';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import QuestionCard from '../components/player/QuestionCard';
import Timer from '../components/shared/Timer';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

interface ReviewNotification {
  isCorrect: boolean;
  message: string;
  timestamp: number;
}

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
  timestamp?: number;
}

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

const Player: React.FC = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [lives, setLives] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const submittedAnswerRef = useRef(submittedAnswer);
  const [canvasKey, setCanvasKey] = useState(0); // For canvas reset
  const [errorMsg, setErrorMsg] = useState('');
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const [reviewNotification, setReviewNotification] = useState<ReviewNotification | null>(null);
  const [isMuted, setIsMuted] = useState(audioService.isMusicMuted());
  const [volume, setVolume] = useState(audioService.getVolume());
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const answerRef = useRef(answer);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerBoards, setPlayerBoards] = useState<PlayerBoard[]>([]);
  const [allAnswersThisRound, setAllAnswersThisRound] = useState<Record<string, AnswerSubmission>>({});
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({
    isActive: false,
    focusedPlayerId: null
  });
  const [evaluatedAnswers, setEvaluatedAnswers] = useState<Record<string, boolean | null>>({});
  const [visibleBoards, setVisibleBoards] = useState(new Set<string>());
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [showSpectatorConfirm, setShowSpectatorConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  console.log('[DEBUG] Player component MOUNTED');

  // Create a throttled version of the update function
  const sendBoardUpdate = useCallback(
    throttle((roomCode: string, svgData: string) => {
      socketService.updateBoard(roomCode, svgData);
      console.log('Sent throttled board update');
    }, 50), // Throttle to max once per 50ms for smoother drawing
    []
  );

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      if (boardContainerRef.current) {
        const rect = boardContainerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setCanvasSize({
            width: Math.floor(rect.width),
            height: Math.floor(rect.height)
          });
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 800,
        height: 400,
        backgroundColor: '#0C6A35' // School green board color
      });
      
      // Set up drawing brush
      if (fabricCanvasRef.current.freeDrawingBrush) {
        fabricCanvasRef.current.freeDrawingBrush.color = '#FFFFFF'; // White chalk color
        fabricCanvasRef.current.freeDrawingBrush.width = 3;
      }
      
      // Function to send canvas updates to gamemaster
      const sendBoardToGamemaster = () => {
        if (fabricCanvasRef.current && roomCode && !submittedAnswerRef.current) {
          // Generate SVG with specific attributes via a format that works with the fabric typings
          const svgData = fabricCanvasRef.current.toSVG();
          
          // Send to server
          socketService.updateBoard(roomCode, svgData);
          console.log('Sent board update to gamemaster');
        }
      };
      
      // Send canvas updates to gamemaster
      fabricCanvasRef.current.on('path:created', sendBoardToGamemaster);

      // Also send updates during mouse movement for real-time drawing
      fabricCanvasRef.current.on('mouse:move', () => {
        if (fabricCanvasRef.current && roomCode && fabricCanvasRef.current.isDrawingMode && !submittedAnswerRef.current) {
          const svgData = fabricCanvasRef.current.toSVG();
          sendBoardUpdate(roomCode, svgData);
        }
      });
      
      // Initial board update
      if (roomCode) {
        setTimeout(sendBoardToGamemaster, 1000);
      }
    }
    
    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, [canvasKey, roomCode, sendBoardUpdate]);

  // Add effect to disable canvas interaction after submission
  useEffect(() => {
    if (fabricCanvasRef.current) {
      if (submittedAnswer) {
        // Disable all interactions
        fabricCanvasRef.current.isDrawingMode = false;
        (fabricCanvasRef.current as any).selection = false;
        (fabricCanvasRef.current as any).forEachObject((obj: any) => {
          obj.selectable = false;
          obj.evented = false;
        });
        fabricCanvasRef.current.renderAll();
      } else {
        // Enable drawing mode if not submitted
        fabricCanvasRef.current.isDrawingMode = true;
      }
    }
  }, [submittedAnswer]);

  // Setup socket connection
  useEffect(() => {
    // Get room code and player name from sessionStorage
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const savedPlayerName = sessionStorage.getItem('playerName');
    
    if (!savedRoomCode || !savedPlayerName) {
      navigate('/');
      return;
    }
    
    setRoomCode(savedRoomCode);
    setPlayerName(savedPlayerName);
    
    // Connect to socket server
    socketService.connect();
    
    // Join the room
    socketService.joinRoom(savedRoomCode, savedPlayerName);
    
    // Set up event listeners
    socketService.on('error', (msg: string) => {
      setErrorMsg(msg);
    });
    
    socketService.on('become_spectator', () => {
      setIsSpectator(true);
      showFlashMessage('You have become a spectator', 'info');
    });

    socketService.on('question', (question: Question) => {
      setCurrentQuestion(question);
      setAnswer('');
    });

    socketService.on('game_started', (data: { question: Question, timeLimit?: number }) => {
      setGameStarted(true);
      setCurrentQuestion(data.question);
      resetCanvas();
      
      // Set time limit if present
      if (data.timeLimit) {
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeLimit);
        
        // Start countdown
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
        
        // Clean up timer
        return () => clearInterval(timer);
      } else {
        setTimeLimit(null);
        setTimeRemaining(null);
      }
    });
    
    socketService.on('new_question', (data: { question: Question, timeLimit?: number }) => {
      setCurrentQuestion(data.question);
      setSubmittedAnswer(false);
      setAnswer('');
      resetCanvas();
      setErrorMsg('');
      setReviewNotification(null);
      
      // Set time limit if present
      if (data.timeLimit) {
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeLimit);
        setIsTimerRunning(true);
      } else {
        setTimeLimit(null);
        setTimeRemaining(null);
        setIsTimerRunning(false);
      }
    });
    
    socketService.on('answer_evaluation', (data: { isCorrect: boolean, lives: number, playerId: string }) => {
      setLives(data.lives);
      // Set review notification
      setReviewNotification({
        isCorrect: data.isCorrect,
        message: 'Reviewed by Game Master',
        timestamp: Date.now()
      });
      // Update evaluatedAnswers for preview mode
      setEvaluatedAnswers(prev => ({
        ...prev,
        [data.playerId]: data.isCorrect  // Use the playerId from the data
      }));
      // Clear the notification after 5 seconds
      setTimeout(() => {
        setReviewNotification(null);
      }, 5000);
    });
    
    socketService.on('game_over', () => {
      setGameOver(true);
    });
    
    socketService.on('game_winner', (data: { playerId: string, playerName: string }) => {
      if (socketService.connect().id === data.playerId) {
        setIsWinner(true);
      }
    });
    
    socketService.on('gamemaster_left', () => {
      setErrorMsg('The Game Master has left the game. Redirecting to home...');
      setTimeout(() => navigate('/'), 3000);
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
        
        // Auto-submit answer if not already submitted
        if (!submittedAnswerRef.current && currentQuestion) {
          handleSubmitAnswer();
        }
      });
    });

    socketService.on('end_round_early', () => {
      // Clear any existing animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Immediately update state
      setTimeRemaining(0);
      setIsTimerRunning(false);
      timerUpdateRef.current = performance.now();
      
      if (!submittedAnswerRef.current && currentQuestion) {
        handleSubmitAnswer(true);
      }
      showFlashMessage('Round ended early by Game Master', 'warning');
    });
    
    // Add listener for answer received confirmation
    socketService.on('answer_received', (data: { status: string, message: string }) => {
      console.log('Answer received confirmation:', data);
      if (data.status === 'success') {
        showFlashMessage(data.message, 'success');
      }
    });
    
    // Add preview mode event listeners
    socketService.on('start_preview_mode', () => {
      console.log('Preview mode started');
      setPreviewMode(prev => ({ ...prev, isActive: true }));
    });

    socketService.on('stop_preview_mode', () => {
      console.log('Preview mode stopped');
      setPreviewMode({ isActive: false, focusedPlayerId: null });
    });

    socketService.on('focus_submission', (data: { playerId: string }) => {
      console.log('Focus submission:', data);
      setPreviewMode(prev => ({ ...prev, focusedPlayerId: data.playerId }));
    });

    // Add player list and board updates
    socketService.on('players_update', (updatedPlayers: Player[]) => {
      console.log('Players updated:', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    socketService.on('board_update', (data: PlayerBoard) => {
      console.log('Board update received:', data);
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
      console.log('Answer submitted:', submission);
      setAllAnswersThisRound(prev => ({
        ...prev,
        [submission.playerId]: {
          ...submission,
          timestamp: Date.now()
        }
      }));
    });

    return () => {
      console.log('[DEBUG] Player component UNMOUNTED or useEffect cleanup');
      // Clean up listeners
      socketService.off('question');
      socketService.off('error');
      socketService.off('game_started');
      socketService.off('new_question');
      socketService.off('answer_evaluation');
      socketService.off('game_over');
      socketService.off('game_winner');
      socketService.off('gamemaster_left');
      socketService.off('timer_update');
      socketService.off('time_up');
      socketService.off('end_round_early');
      socketService.off('game_restarted');
      socketService.off('answer_received');
      socketService.off('start_preview_mode');
      socketService.off('stop_preview_mode');
      socketService.off('focus_submission');
      socketService.off('players_update');
      socketService.off('board_update');
      socketService.off('answer_submitted');
      
      // Disconnect
      socketService.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    submittedAnswerRef.current = submittedAnswer;
  }, [submittedAnswer]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  // Memoize event handlers
  const handleSubmitAnswer = useCallback((force = false) => {
    if (!currentQuestion || submittedAnswerRef.current) return;
  
    const room = roomCode || sessionStorage.getItem('roomCode')!;
    const hasDrawing = fabricCanvasRef.current ? (fabricCanvasRef.current as any).getObjects().length > 0 : false;
    const text = answerRef.current?.trim() || '';
  
    // Only check for empty submission if not forced (i.e., not ending round early)
    if (!force && !text && !hasDrawing) {
      showFlashMessage('Please enter an answer or draw something', 'warning');
      return;
    }
  
    // Build the payload: if forced & empty, send empty string
    let finalAnswer = '';
    if (text) {
      finalAnswer = hasDrawing ? `${text} (with drawing)` : text;
    } else if (hasDrawing) {
      finalAnswer = 'Drawing submitted';
    }
  
    socketService.submitAnswer(room, finalAnswer, hasDrawing);
    setSubmittedAnswer(true);
    showFlashMessage(force ? 'Answer submitted automatically' : 'Answer submitted!', 'info');
  }, [currentQuestion, roomCode]);

  const showFlashMessage = useCallback((message: string, type: 'success' | 'danger' | 'warning' | 'info') => {
    setErrorMsg(message);
    document.getElementById('flash-message')?.classList.add(`alert-${type}`);
    
    setTimeout(() => {
      setErrorMsg('');
      document.getElementById('flash-message')?.classList.remove(`alert-${type}`);
    }, 3000);
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && timeLimit !== null && timeRemaining !== null) {
      // When tab becomes visible, check if we need to submit
      if (timeRemaining <= 0 && !submittedAnswerRef.current && currentQuestion) {
        handleSubmitAnswer();
      }
    }
  }, [timeRemaining, timeLimit, currentQuestion, handleSubmitAnswer]);

  const handleToggleMute = useCallback(() => {
    const newMuteState = audioService.toggleMute();
    setIsMuted(newMuteState);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    audioService.setVolume(newVolume);
    setVolume(newVolume);
  }, []);

  const handleClosePreviewMode = useCallback(() => {
    socketService.stopPreviewMode(roomCode);
    setPreviewMode({ isActive: false, focusedPlayerId: null });
  }, [roomCode]);

  const handleFocusSubmission = useCallback((playerId: string) => {
    socketService.focusSubmission(roomCode, playerId);
    setPreviewMode(prev => ({ ...prev, focusedPlayerId: playerId }));
  }, [roomCode]);

  const resetCanvas = useCallback(() => {
    setCanvasKey(prev => prev + 1);
  }, []);

  const clearCanvas = useCallback(() => {
    if (fabricCanvasRef.current && !submittedAnswer) {
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.backgroundColor = '#0C6A35'; // School green board color
      fabricCanvasRef.current.renderAll();
      
      // Send empty canvas to gamemaster
      const svgData = fabricCanvasRef.current.toSVG();
      socketService.updateBoard(roomCode, svgData);
    }
  }, [roomCode, submittedAnswer]);

  const handleAnswerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value);
    // Store current answer in socket for auto-submission
    const socket = socketService.connect();
    (socket as any).currentAnswer = e.target.value;
  }, []);

  // Update useEffect dependencies
  useEffect(() => {
    if (
      !submittedAnswerRef.current &&
      currentQuestion &&
      timeLimit !== null &&
      timeRemaining !== null &&
      timeRemaining <= 0
    ) {
      handleSubmitAnswer();
    }
  }, [timeRemaining, currentQuestion, timeLimit, handleSubmitAnswer]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Move formatTime outside component since it doesn't depend on any component state
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Start playing background music when component mounts
    audioService.playBackgroundMusic();

    // Cleanup when component unmounts
    return () => {
      audioService.pauseBackgroundMusic();
    };
  }, []);

  useEffect(() => {
    if (gameStarted) {
      // Show all boards of active players (non-spectators) when game starts
      setVisibleBoards(new Set(playerBoards.filter(b => {
        const player = players.find(p => p.id === b.playerId);
        return player && !player.isSpectator;
      }).map(b => b.playerId)));
    }
  }, [gameStarted, playerBoards, players]);

  useEffect(() => {
    if (isSpectator) {
      // Only show boards of active players (non-spectators)
      setVisibleBoards(new Set(playerBoards.filter(b => {
        const player = players.find(p => p.id === b.playerId);
        return player && !player.isSpectator;
      }).map(b => b.playerId)));
    }
  }, [isSpectator, playerBoards, players]);

  const handleJoinRoom = useCallback(() => {
    if (!roomCodeInput || !playerNameInput) {
      setErrorMsg('Please enter both room code and player name');
      return;
    }
    setIsLoading(true);
    socketService.joinRoom(roomCodeInput, playerNameInput, isSpectator);
  }, [roomCodeInput, playerNameInput, isSpectator]);

  const handleSwitchToSpectator = useCallback(() => {
    setShowSpectatorConfirm(true);
  }, []);

  const confirmSwitchToSpectator = useCallback(() => {
    const roomCode = sessionStorage.getItem('roomCode');
    const playerId = sessionStorage.getItem('playerId');
    if (roomCode && playerId) {
      socketService.switchToSpectator(roomCode, playerId);
    }
    setShowSpectatorConfirm(false);
  }, []);

  const cancelSwitchToSpectator = useCallback(() => {
    setShowSpectatorConfirm(false);
  }, []);

  if (gameOver && !isWinner) {
    return (
      <div className="container text-center">
        <div className="card p-5 mt-5">
          <h1 className="mb-4">Game Over!</h1>
          <p className="lead mb-4">You've lost all your lives!</p>
          <button 
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  
  if (isWinner) {
    return (
      <div className="container text-center">
        <div className="card p-5 mt-5 bg-success text-white">
          <h1 className="mb-4"><span role="img" aria-label="trophy">🏆</span> You Win! <span role="img" aria-label="trophy">🏆</span></h1>
          <p className="lead mb-4">Congratulations! You're the last one standing!</p>
          <button 
            className="btn btn-light btn-lg"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (isSpectator) {
    const showAllBoards = () => setVisibleBoards(new Set(playerBoards.filter(b => {
      const player = players.find(p => p.id === b.playerId);
      return player && !player.isSpectator;
    }).map(b => b.playerId)));
    const hideAllBoards = () => setVisibleBoards(new Set());
    return (
      <div className="container-fluid px-2 px-md-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
          <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
            <span className="bi bi-eye section-icon" aria-label="Spectator"></span>
            Spectator View
          </div>
        </div>
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <PlayerList
              players={players}
              title="Players"
            />
            <div className="d-grid gap-2 mt-3">
              <button
                className="btn btn-outline-secondary"
                onClick={() => navigate('/')}
              >
                Leave Game
              </button>
            </div>
          </div>
          <div className="col-12 col-md-8">
            {currentQuestion && (
              <div className="card mb-4">
                <div className="card-body">
                  <h3>Current Question:</h3>
                  <p className="lead">{currentQuestion.text}</p>
                </div>
              </div>
            )}
            <div className="card mb-4">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Player Boards</h5>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={showAllBoards}>Show All</button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={hideAllBoards}>Hide All</button>
                </div>
              </div>
              <div className="card-body">
                <div
                  className="board-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '20px',
                    width: '100%',
                    overflowX: 'auto',
                    alignItems: 'stretch',
                  }}
                >
                  {playerBoards.filter(board => {
                    const player = players.find(p => p.id === board.playerId);
                    return player && !player.isSpectator;
                  }).map(board => (
                    <PlayerBoardDisplay
                      key={board.playerId}
                      board={board}
                      isVisible={visibleBoards.has(board.playerId)}
                      onToggleVisibility={id => setVisibleBoards(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                        return newSet;
                      })}
                      transform={{ scale: 1, x: 0, y: 0 }}
                      onScale={() => {}}
                      onPan={() => {}}
                      onReset={() => {}}
                    />
                  ))}
                </div>
              </div>
            </div>
            {/* Preview Overlay for Spectators */}
            <PreviewOverlay
              players={players}
              playerBoards={playerBoards}
              allAnswersThisRound={allAnswersThisRound}
              evaluatedAnswers={evaluatedAnswers}
              previewMode={previewMode}
              onFocus={() => {}}
              onClose={() => {}}
              isGameMaster={false}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-person section-icon" aria-label="Player"></span>
          Player Dashboard
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
      <div className="row g-3">
        <div className="col-12 col-md-8">
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6 d-flex flex-column gap-2 align-items-start">
              <div className="lives-display">
                <span className="me-2">Lives:</span>
                {[...Array(lives)].map((_, i) => (
                  <span key={i} className="life" role="img" aria-label="heart">❤</span>
                ))}
              </div>
            </div>
            <div className="col-6 col-md-3">
              {timeLimit !== null && timeRemaining !== null && timeLimit < 99999 && (
                <div className={`timer-display ${timeRemaining <= 10 ? 'text-danger' : ''}`}>
                  <h3 className="h5">
                    <span className="me-2">Time:</span>
                    <span>{timeRemaining}</span>
                    <span className="ms-1">sec</span>
                  </h3>
                </div>
              )}
            </div>
          </div>
          
          {errorMsg && (
            <div id="flash-message" className="alert mb-4" role="alert">
              {errorMsg}
            </div>
          )}

          {reviewNotification && (
            <div className={`alert ${reviewNotification.isCorrect ? 'alert-success' : 'alert-danger'} mb-4 d-flex align-items-center`} role="alert">
              <div className="me-3">
                {reviewNotification.isCorrect ? (
                  <span role="img" aria-label="thumbs up" style={{ fontSize: '1.5rem' }}>👍</span>
                ) : (
                  <span role="img" aria-label="thumbs down" style={{ fontSize: '1.5rem' }}>👎</span>
                )}
              </div>
              <div>
                <strong>{reviewNotification.message}</strong>
                <div className="small">
                  {reviewNotification.isCorrect ? 'Your answer was correct!' : 'Your answer was incorrect.'}
                </div>
              </div>
            </div>
          )}
          
          {!gameStarted ? (
            <div className="card p-4 text-center">
              <h2 className="h4 mb-3">Waiting for Game Master to start the game</h2>
              <p>Get ready! The game will begin soon.</p>
              <div className="spinner-border text-primary mx-auto mt-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <>
              <QuestionCard currentQuestion={currentQuestion} />
              
              {timeLimit !== null && timeRemaining !== null && (
                <Timer
                  timeLimit={timeLimit}
                  timeRemaining={timeRemaining}
                  isActive={isTimerRunning}
                  showSeconds={true}
                />
              )}
              
              <div className="card mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h3 className="h5 mb-0">Your Answer</h3>
                  <div>
                    <button 
                      className="btn btn-outline-light"
                      onClick={clearCanvas}
                      style={{ backgroundColor: '#8B4513', border: 'none' }}
                    >
                      Erase Board
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="mb-4 drawing-board-container" style={{ 
                    width: '100%',
                    maxWidth: '800px',
                    height: 'auto',
                    minHeight: '250px',
                    border: '12px solid #8B4513', 
                    borderRadius: '4px',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    position: 'relative',
                    overflow: 'hidden',
                    margin: '0 auto',
                    background: '#0C6A35',
                  }}>
                    <canvas ref={canvasRef} id={`canvas-${canvasKey}`} width="800" height="400" style={{ display: 'block', width: '100%', height: '100%' }} />
                  </div>
                  
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Type your answer here..."
                      value={answer}
                      onChange={handleAnswerChange}
                      disabled={submittedAnswer || !!(timeLimit && (!timeRemaining || timeRemaining <= 0))}
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => handleSubmitAnswer()}
                      disabled={submittedAnswer || !!(timeLimit && (!timeRemaining || timeRemaining <= 0))}
                    >
                      Submit Answer
                    </button>
                  </div>
                  
                  {submittedAnswer && (
                    <div className="alert alert-info">
                      Your answer has been submitted. Wait for the Game Master to evaluate it.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          <PreviewOverlay
            players={players}
            playerBoards={playerBoards}
            allAnswersThisRound={allAnswersThisRound}
            evaluatedAnswers={evaluatedAnswers}
            previewMode={previewMode}
            onFocus={handleFocusSubmission}
            onClose={handleClosePreviewMode}
            isGameMaster={false}
          />
        </div>
        <div className="col-12 col-md-4">
          <RoomCode roomCode={roomCode} />
          <PlayerList 
            players={players} 
            currentPlayerId={socketService.connect().id || ''}
            title="Other Players"
          />
        </div>
      </div>
      {showSpectatorConfirm && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Switch to Spectator Mode?</h5>
                <button type="button" className="btn-close" onClick={cancelSwitchToSpectator}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to switch to spectator mode? You will no longer be able to participate in the game.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cancelSwitchToSpectator}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={confirmSwitchToSpectator}>Switch to Spectator</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player; 
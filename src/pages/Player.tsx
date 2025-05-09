import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import socketService from '../services/socketService';
import { throttle } from '../utils/throttle';

interface Question {
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

const Player: React.FC = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
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
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const answerRef = useRef(answer);

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
        if (fabricCanvasRef.current && roomCode) {
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
        if (fabricCanvasRef.current && roomCode && fabricCanvasRef.current.isDrawingMode) {
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

  // Setup socket connection
  useEffect(() => {
    // Get data from session
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const savedPlayerName = sessionStorage.getItem('playerName');
    
    if (!savedRoomCode || !savedPlayerName) {
      navigate('/join');
      return;
    }
    
    setRoomCode(savedRoomCode);
    setPlayerName(savedPlayerName);
    
    // Connect to socket
    const socket = socketService.connect();
    console.log('Player connected with socket ID:', socket.id);
    
    // Add a custom property to store room code with the socket object
    // This will be available on the server side
    (socket as any).roomCode = savedRoomCode;
    
    // Explicitly re-join the room when reconnecting
    socketService.joinRoom(savedRoomCode, savedPlayerName);
    
    // Setup listeners
    socketService.on('joined_room', (joinedRoomCode: string) => {
      console.log('Confirmed joined room:', joinedRoomCode);
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
      }
    });
    
    socketService.on('new_question', (data: { question: Question, timeLimit?: number }) => {
      setCurrentQuestion(data.question);
      setSubmittedAnswer(false);
      setAnswer('');
      resetCanvas();
      
      // Reset timer for new question if time limit is set
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
    
    socketService.on('answer_evaluation', (data: { isCorrect: boolean, lives: number }) => {
      setLives(data.lives);
      
      // Flash the result
      if (data.isCorrect) {
        showFlashMessage('Correct!', 'success');
      } else {
        showFlashMessage('Incorrect!', 'danger');
      }
      
      setSubmittedAnswer(false);
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
    
    socketService.on('error', (msg: string) => {
      setErrorMsg(msg);
      if (msg === 'Room does not exist') {
        // If room doesn't exist anymore, redirect to join page
        setTimeout(() => {
          sessionStorage.removeItem('roomCode');
          sessionStorage.removeItem('playerName');
          navigate('/join');
        }, 3000);
      }
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
        
        // Show notification
        showFlashMessage('Round ended early by Game Master', 'warning');
      });
    });
    
    // Add listener for answer received confirmation
    socketService.on('answer_received', (data: { status: string, message: string }) => {
      console.log('Answer received confirmation:', data);
      if (data.status === 'success') {
        showFlashMessage(data.message, 'success');
      }
    });
    
    socketService.on('game_restarted', () => {
      // Reset game state
      setGameStarted(false);
      setGameOver(false);
      setIsWinner(false);
      setCurrentQuestion(null);
      setAnswer('');
      setSubmittedAnswer(false);
      setLives(3);
      setTimeLimit(null);
      setTimeRemaining(null);
      resetCanvas();
      
      // Show a message about game restart
      showFlashMessage('Game has been restarted. Waiting for game master to start a new round.', 'info');
    });
    
    return () => {
      console.log('[DEBUG] Player component UNMOUNTED or useEffect cleanup');
      // Clean up listeners
      socketService.off('game_started');
      socketService.off('new_question');
      socketService.off('answer_evaluation');
      socketService.off('game_over');
      socketService.off('game_winner');
      socketService.off('gamemaster_left');
      socketService.off('error');
      socketService.off('timer_update');
      socketService.off('time_up');
      socketService.off('end_round_early');
      socketService.off('game_restarted');
      socketService.off('answer_received');
      
      // Disconnect
      socketService.disconnect();
    };
  }, [navigate, roomCode]);

  useEffect(() => {
    submittedAnswerRef.current = submittedAnswer;
  }, [submittedAnswer]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  // Only call resetCanvas on explicit actions
  const resetCanvas = () => {
    setCanvasKey(prev => prev + 1);
  };

  const clearCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.backgroundColor = '#0C6A35'; // School green board color
      fabricCanvasRef.current.renderAll();
      
      // Send empty canvas to gamemaster
      const svgData = fabricCanvasRef.current.toSVG();
      socketService.updateBoard(roomCode, svgData);
    }
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value);
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || submittedAnswerRef.current) return;
    const currentRoomCode = roomCode || sessionStorage.getItem('roomCode');
    if (!currentRoomCode) {
      console.error('No room code available for submission!');
      showFlashMessage('Error: Unable to submit answer - missing room code', 'danger');
      return;
    }
    try {
      const hasDrawing = fabricCanvasRef.current && fabricCanvasRef.current.toSVG().length > 100;
      const currentAnswer = answerRef.current;
      if ((currentAnswer && currentAnswer.trim()) || hasDrawing) {
        let finalAnswer = '';
        if (currentAnswer && currentAnswer.trim()) {
          finalAnswer = currentAnswer.trim();
          if (hasDrawing) {
            finalAnswer += ' (with drawing)';
          }
        } else if (hasDrawing) {
          finalAnswer = 'Drawing submitted';
        }
        socketService.submitAnswer(currentRoomCode, finalAnswer, Boolean(hasDrawing));
        setSubmittedAnswer(true);
        showFlashMessage('Answer submitted!', 'info');
      } else {
        showFlashMessage('Please enter an answer or draw something', 'warning');
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      showFlashMessage('Error submitting your answer. Please try again.', 'danger');
    }
  };

  const showFlashMessage = (message: string, type: 'success' | 'danger' | 'warning' | 'info') => {
    setErrorMsg(message);
    document.getElementById('flash-message')?.classList.add(`alert-${type}`);
    
    setTimeout(() => {
      setErrorMsg('');
      document.getElementById('flash-message')?.classList.remove(`alert-${type}`);
    }, 3000);
  };

  useEffect(() => {
    if (!submittedAnswerRef.current && currentQuestion && (!timeRemaining || timeRemaining <= 0)) {
      handleSubmitAnswer();
    }
    // eslint-disable-next-line
  }, [timeRemaining]);

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

  return (
    <div className="container">
      <div className="row mb-4">
        <div className="col-md-6">
          <h1>Player: {playerName}</h1>
          <div className="mb-3">Room Code: <strong>{roomCode}</strong></div>
        </div>
        <div className="col-md-3">
          {timeLimit !== null && timeRemaining !== null && (
            <div className={`timer-display ${timeRemaining <= 10 ? 'text-danger' : ''}`}>
              <h3>
                <span className="me-2">Time:</span>
                <span>{timeRemaining}</span>
                <span className="ms-1">sec</span>
              </h3>
            </div>
          )}
        </div>
        <div className="col-md-3 text-end">
          <div className="lives-display">
            <span className="me-2">Lives:</span>
            {[...Array(lives)].map((_, i) => (
              <span key={i} className="life" role="img" aria-label="heart">❤</span>
            ))}
          </div>
        </div>
      </div>
      
      {errorMsg && (
        <div id="flash-message" className="alert mb-4" role="alert">
          {errorMsg}
        </div>
      )}
      
      {!gameStarted ? (
        <div className="card p-4 text-center">
          <h2 className="mb-3">Waiting for Game Master to start the game</h2>
          <p>Get ready! The game will begin soon.</p>
          <div className="spinner-border text-primary mx-auto mt-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="mb-0">Question</h3>
            </div>
            <div className="card-body">
              <div className="question-container">
                <p className="lead mb-1">{currentQuestion?.text}</p>
                <small>Grade: {currentQuestion?.grade} | Subject: {currentQuestion?.subject} 
                {currentQuestion?.language && ` | Language: ${currentQuestion.language}`}</small>
              </div>
            </div>
          </div>
          
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="mb-0">Your Answer</h3>
              <div>
                <button 
                  className="btn btn-outline-light me-2"
                  onClick={clearCanvas}
                  style={{ backgroundColor: '#8B4513', border: 'none' }}
                >
                  Erase Board
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="mb-4 drawing-board-container" style={{ 
                width: '800px',
                height: '400px',
                border: '12px solid #8B4513', 
                borderRadius: '4px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                margin: '0 auto',
                background: '#0C6A35', // fallback in case canvas doesn't fill
              }}>
                <canvas ref={canvasRef} id={`canvas-${canvasKey}`} width="800" height="400" style={{ display: 'block' }} />
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
                  onClick={handleSubmitAnswer}
                  disabled={submittedAnswer || !!(timeLimit && (!timeRemaining || timeRemaining <= 0))}
                >
                  Submit Answer
                </button>
              </div>
              
              {timeLimit !== null && timeRemaining !== null && (
                <div className={`text-center ${timeRemaining <= 10 ? 'text-danger fw-bold' : ''}`}>
                  Time remaining: {formatTime(timeRemaining)}
                  {timeRemaining <= 10 && <span className="ms-1">- Answer will be auto-submitted when time is up!</span>}
                </div>
              )}
              
              {submittedAnswer && (
                <div className="alert alert-info">
                  Your answer has been submitted. Wait for the Game Master to evaluate it.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds: number | null): string => {
  if (seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default Player; 
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import { throttle } from 'lodash';
import socketService from '../services/socketService';
import { useGame } from '../context/GameContext';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import ReviewNotification from '../components/shared/ReviewNotification';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import type { PreviewModeState, ReviewNotificationProps, Player, PlayerBoard } from '../types/game';

const PlayerComponent: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [canvasKey, setCanvasKey] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [showReviewNotification, setShowReviewNotification] = useState<ReviewNotificationProps | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [playerId, setPlayerId] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({
    isActive: false,
    focusedPlayerId: null
  });
  const [visibleBoards, setVisibleBoards] = useState(new Set<string>());
  const submittedAnswerRef = useRef(false);
  const answerRef = useRef<string>('');
  const timerUpdateRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create a throttled version of the update function
  const sendBoardUpdate = useCallback(
    throttle((roomCode: string, svgData: string) => {
      socketService.updateBoard(roomCode, svgData);
      console.log('Sent throttled board update');
    }, 50),
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
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: '#0C6A35'
      });
      
      if (fabricCanvasRef.current.freeDrawingBrush) {
        fabricCanvasRef.current.freeDrawingBrush.color = '#FFFFFF';
        fabricCanvasRef.current.freeDrawingBrush.width = 3;
      }
      
      const sendBoardToGamemaster = () => {
        if (fabricCanvasRef.current && roomCode && !submittedAnswerRef.current) {
          const svgData = fabricCanvasRef.current.toSVG();
          socketService.updateBoard(roomCode, svgData);
          console.log('Sent board update to gamemaster');
        }
      };
      
      fabricCanvasRef.current.on('path:created', sendBoardToGamemaster);
      fabricCanvasRef.current.on('mouse:move', () => {
        if (fabricCanvasRef.current && roomCode && fabricCanvasRef.current.isDrawingMode && !submittedAnswerRef.current) {
          const svgData = fabricCanvasRef.current.toSVG();
          sendBoardUpdate(roomCode, svgData);
        }
      });
      
      if (roomCode) {
        setTimeout(sendBoardToGamemaster, 1000);
      }
    }
    
    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, [canvasKey, roomCode, sendBoardUpdate, canvasSize]);

  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }

    // Connect to socket first
    const socket = socketService.connect();
    
    // Set up error handler
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setErrorMsg('Connection error. Please try again.');
      setIsLoading(false);
    });

    // Join room as player
    socketService.joinRoom(roomCode, state.playerName || 'Player');

    // Set up socket listeners
    socketService.on('players_update', (players: Player[]) => {
      console.log('Players update received:', players);
      dispatch({ type: 'SET_PLAYERS', payload: players });
    });

    socketService.on('player_joined', (player: Player) => {
      console.log('Player joined:', player);
      dispatch({ type: 'ADD_PLAYER', payload: player });
    });

    socketService.on('board_update', (playerBoards: PlayerBoard[]) => {
      console.log('Board update received:', playerBoards);
      dispatch({ type: 'SET_PLAYER_BOARDS', payload: playerBoards });
    });

    socketService.on('question_update', (question: string) => {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: question });
    });

    socketService.on('timer_update', (timeLeft: number) => {
      dispatch({ type: 'SET_TIME_LEFT', payload: timeLeft });
    });

    socketService.on('game_started', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: true });
      // Reset answer state when game starts
      setAnswer('');
      setSubmittedAnswer(false);
      submittedAnswerRef.current = false;
      answerRef.current = '';
    });

    socketService.on('game_ended', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: false });
    });

    socketService.on('preview_mode_started', () => {
      dispatch({ type: 'SET_PREVIEW_MODE', payload: { isActive: true, focusedPlayerId: null } });
      setPreviewMode(prev => ({ ...prev, isActive: true }));
    });

    socketService.on('preview_mode_ended', () => {
      dispatch({ type: 'SET_PREVIEW_MODE', payload: { isActive: false, focusedPlayerId: null } });
      setPreviewMode(prev => ({ ...prev, isActive: false }));
    });

    socketService.on('submission_focused', (playerId: string) => {
      dispatch({ type: 'SET_FOCUSED_SUBMISSION', payload: playerId });
      setPreviewMode(prev => ({ ...prev, focusedPlayerId: playerId }));
    });

    socketService.on('answer_evaluation', ({ isCorrect, lives, playerId }) => {
      if (playerId === socket.id) {
        setShowReviewNotification({
          answer: answerRef.current,
          isCorrect,
          timestamp: Date.now(),
          onClose: () => setShowReviewNotification(null),
          message: isCorrect ? 'Correct!' : 'Incorrect!'
        });
      }
    });

    // Request current game state
    socketService.getGameState(roomCode);

    return () => {
      socketService.disconnect();
    };
  }, [roomCode, navigate, dispatch, state.playerName]);

  useEffect(() => {
    submittedAnswerRef.current = submittedAnswer;
  }, [submittedAnswer]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const handleSubmitAnswer = useCallback((answer: string) => {
    if (!roomCode) return;
    answerRef.current = answer;
    socketService.submitAnswer(roomCode, answer);
  }, [roomCode]);

  const handleSwitchToSpectator = useCallback(() => {
    setShowSwitchModal(true);
  }, []);

  const confirmSwitchToSpectator = useCallback(() => {
    if (!roomCode || !playerId) return;
    socketService.switchToSpectator(roomCode, playerId);
    dispatch({ type: 'SET_SPECTATOR', payload: true });
    setShowSwitchModal(false);
  }, [roomCode, playerId, dispatch]);

  const handleJoinAsPlayer = useCallback((playerName: string) => {
    if (!roomCode) return;
    socketService.switchToPlayer(roomCode, playerName);
    dispatch({ type: 'SET_SPECTATOR', payload: false });
    dispatch({ type: 'SET_PLAYER_NAME', payload: playerName });
  }, [roomCode, dispatch]);

  const showAllBoards = useCallback(() => {
    setVisibleBoards(new Set(state.players.filter(p => !p.isSpectator).map(p => p.id)));
  }, [state.players]);

  const hideAllBoards = useCallback(() => {
    setVisibleBoards(new Set());
  }, []);

  if (!roomCode) return null;

  return (
    <div className="player-container">
      <div className="row">
        <div className="col-md-8">
          <div className="card">
            {state.gameStarted ? (
              <>
                <div className="card-header">
                  <h2 className="mb-0">Current Question</h2>
                </div>
                <div className="card-body">
                  <div className="question-display">
                    <h2>{state.currentQuestion}</h2>
                  </div>
                  <div className="board-container" ref={boardContainerRef}>
                    <canvas
                      key={canvasKey}
                      ref={canvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                    />
                  </div>
                  <div className="answer-section">
                    <input
                      type="text"
                      className="form-control"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer..."
                      disabled={submittedAnswer}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSubmitAnswer(answer)}
                      disabled={submittedAnswer || !answer.trim()}
                    >
                      Submit Answer
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="card-body">
                <div className="waiting-message">
                  <h2>Waiting for Game Master to start the game...</h2>
                </div>
              </div>
            )}
          </div>
          {previewMode.isActive && (
            <PreviewOverlay
              players={state.players}
              playerBoards={state.playerBoards}
              allAnswersThisRound={{}}
              evaluatedAnswers={state.evaluatedAnswers}
              previewMode={previewMode}
              onFocus={(playerId) => setPreviewMode(prev => ({ ...prev, focusedPlayerId: playerId }))}
              onClose={() => setPreviewMode(prev => ({ ...prev, isActive: false }))}
            />
          )}
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h3 className="mb-0">Players</h3>
            </div>
            <div className="card-body">
              <PlayerList
                players={state.players}
                onPlayerClick={(playerId) => {
                  setVisibleBoards(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(playerId)) {
                      newSet.delete(playerId);
                    } else {
                      newSet.add(playerId);
                    }
                    return newSet;
                  });
                }}
                selectedPlayerId={previewMode.focusedPlayerId}
                title="Players"
              />
              <div className="mt-3">
                <button
                  className="btn btn-outline-secondary w-100"
                  onClick={handleSwitchToSpectator}
                >
                  Switch to Spectator Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showReviewNotification && (
        <ReviewNotification
          answer={showReviewNotification.answer}
          isCorrect={showReviewNotification.isCorrect}
          timestamp={showReviewNotification.timestamp}
          onClose={showReviewNotification.onClose}
          message={showReviewNotification.message || 'Answer evaluated'}
        />
      )}
      <ConfirmationModal
        show={showSwitchModal}
        onHide={() => setShowSwitchModal(false)}
        onConfirm={confirmSwitchToSpectator}
        title="Switch to Spectator Mode"
        message="Are you sure you want to switch to spectator mode? You won't be able to participate in the game anymore."
      />
    </div>
  );
};

export default PlayerComponent; 
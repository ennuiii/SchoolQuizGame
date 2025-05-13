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
import { PreviewModeState, ReviewNotificationProps } from '../types/game';

const Player: React.FC = () => {
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

    const socket = socketService.connect();
    const socketId = socket.id;
    if (socketId) {
      setPlayerId(socketId);
    }

    socket.on('question', (question) => {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: question });
      dispatch({ type: 'SET_TIME_LEFT', payload: question.timeLimit });
      dispatch({ type: 'SET_TIMER_RUNNING', payload: true });
    });

    socket.on('answer_evaluation', ({ isCorrect, message }) => {
      setShowReviewNotification({
        answer: answerRef.current || '',
        isCorrect,
        timestamp: Date.now(),
        onClose: () => setShowReviewNotification(null),
        message: message || 'Answer evaluated'
      });
    });

    socket.on('game_winner', ({ winner }) => {
      dispatch({ type: 'SET_GAME_STARTED', payload: false });
      // Handle game winner notification
    });

    socket.on('game_over', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: false });
      // Handle game over notification
    });

    return () => {
      socket.off('question');
      socket.off('answer_evaluation');
      socket.off('game_winner');
      socket.off('game_over');
    };
  }, [roomCode, navigate, dispatch]);

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
          <div className="game-board">
            {state.gameStarted ? (
              <>
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
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    disabled={submittedAnswer}
                  />
                  <button
                    onClick={() => handleSubmitAnswer(answer)}
                    disabled={submittedAnswer || !answer.trim()}
                  >
                    Submit Answer
                  </button>
                </div>
              </>
            ) : (
              <div className="waiting-message">
                <h2>Waiting for Game Master to start the game...</h2>
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
          <div className="player-list-container">
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

export default Player; 
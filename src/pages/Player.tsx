import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import { throttle } from 'lodash';
import socketService from '../services/socketService';
import { useGame } from '../context/GameContext';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import ReviewNotification from '../components/player/ReviewNotification';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { PreviewModeState, ReviewNotificationProps } from '../types/game';
import './Player.css';

const Player: React.FC = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [canvasKey, setCanvasKey] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [reviewNotification, setReviewNotification] = useState<ReviewNotificationProps | null>(null);
  const [showSpectatorConfirm, setShowSpectatorConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({
    isActive: false,
    focusedPlayerId: null
  });
  const [visibleBoards, setVisibleBoards] = useState(new Set<string>());
  const submittedAnswerRef = useRef(false);
  const answerRef = useRef('');
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
        if (fabricCanvasRef.current && state.roomCode && !submittedAnswerRef.current) {
          const svgData = fabricCanvasRef.current.toSVG();
          socketService.updateBoard(state.roomCode, svgData);
          console.log('Sent board update to gamemaster');
        }
      };
      
      fabricCanvasRef.current.on('path:created', sendBoardToGamemaster);
      fabricCanvasRef.current.on('mouse:move', () => {
        if (fabricCanvasRef.current && state.roomCode && fabricCanvasRef.current.isDrawingMode && !submittedAnswerRef.current) {
          const svgData = fabricCanvasRef.current.toSVG();
          sendBoardUpdate(state.roomCode, svgData);
        }
      });
      
      if (state.roomCode) {
        setTimeout(sendBoardToGamemaster, 1000);
      }
    }
    
    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, [canvasKey, state.roomCode, sendBoardUpdate, canvasSize]);

  useEffect(() => {
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const savedPlayerName = sessionStorage.getItem('playerName');
    const savedIsSpectator = sessionStorage.getItem('isSpectator') === 'true';

    if (!savedRoomCode || !savedPlayerName) {
      navigate('/join');
      return;
    }

    dispatch({ type: 'SET_ROOM_CODE', payload: savedRoomCode });
    dispatch({ type: 'SET_PLAYER_NAME', payload: savedPlayerName });
    dispatch({ type: 'SET_SPECTATOR', payload: savedIsSpectator });

    socketService.connect();

    socketService.on('question', (question: { text: string }) => {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: question.text });
      setSubmittedAnswer(false);
      setAnswer('');
      setReviewNotification(null);
    });

    socketService.on('answer_evaluation', (data: { isCorrect: boolean, lives: number, playerId: string }) => {
      if (data.playerId === socketService.connect().id) {
        setReviewNotification({
          isCorrect: data.isCorrect,
          message: data.isCorrect ? 'Correct!' : 'Incorrect!',
          timestamp: Date.now()
        });
        setTimeout(() => setReviewNotification(null), 3000);
      }
    });

    socketService.on('focus_submission', (data: { playerId: string }) => {
      setPreviewMode(prev => ({ ...prev, focusedPlayerId: data.playerId }));
    });

    socketService.on('start_preview_mode', () => {
      setPreviewMode(prev => ({ ...prev, isActive: true }));
    });

    socketService.on('stop_preview_mode', () => {
      setPreviewMode({ isActive: false, focusedPlayerId: null });
    });

    socketService.on('become_spectator', () => {
      dispatch({ type: 'SET_SPECTATOR', payload: true });
      sessionStorage.setItem('isSpectator', 'true');
      navigate('/spectator');
    });

    socketService.on('gamemaster_left', () => {
      setErrorMsg('Game Master has left the game');
      setTimeout(() => navigate('/join'), 3000);
    });

    socketService.on('game_winner', (data: { playerId: string, playerName: string }) => {
      if (data.playerId === socketService.connect().id) {
        setReviewNotification({
          isCorrect: true,
          message: 'You won the game!',
          timestamp: Date.now()
        });
      } else {
        setReviewNotification({
          isCorrect: false,
          message: `${data.playerName} won the game!`,
          timestamp: Date.now()
        });
      }
      setTimeout(() => navigate('/join'), 5000);
    });

    return () => {
      socketService.off('question');
      socketService.off('answer_evaluation');
      socketService.off('focus_submission');
      socketService.off('start_preview_mode');
      socketService.off('stop_preview_mode');
      socketService.off('become_spectator');
      socketService.off('gamemaster_left');
      socketService.off('game_winner');
      socketService.disconnect();
    };
  }, [navigate, dispatch]);

  useEffect(() => {
    submittedAnswerRef.current = submittedAnswer;
  }, [submittedAnswer]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const handleSubmitAnswer = () => {
    if (!state.roomCode || !answer.trim()) return;

    const hasDrawing = fabricCanvasRef.current?.toSVG() !== '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="800" height="400" xml:space="preserve"><desc>Created with Fabric.js 5.3.1</desc><defs></defs><rect x="0" y="0" width="100%" height="100%" fill="#0C6A35"/></svg>';

    socketService.submitAnswer(state.roomCode, answer, hasDrawing);
    setSubmittedAnswer(true);
  };

  const handleSwitchToSpectator = () => {
    setShowSpectatorConfirm(true);
  };

  const confirmSwitchToSpectator = () => {
    if (!state.roomCode) return;
    
    socketService.switchToSpectator(state.roomCode, socketService.connect().id);
    dispatch({ type: 'SET_SPECTATOR', payload: true });
    sessionStorage.setItem('isSpectator', 'true');
    
    // Clean up socket listeners
    socketService.off('question');
    socketService.off('answer_evaluation');
    socketService.off('focus_submission');
    socketService.off('start_preview_mode');
    socketService.off('stop_preview_mode');
    socketService.off('become_spectator');
    socketService.off('gamemaster_left');
    socketService.off('game_winner');
    
    navigate('/spectator');
    setShowSpectatorConfirm(false);
  };

  const handleJoinAsPlayer = () => {
    if (!state.roomCode || !state.playerName) return;
    
    dispatch({ type: 'SET_SPECTATOR', payload: false });
    sessionStorage.setItem('isSpectator', 'false');
    socketService.switchToPlayer(state.roomCode, state.playerName);
    navigate('/player');
  };

  const showAllBoards = useCallback(() => {
    setVisibleBoards(new Set(state.players.filter(p => !p.isSpectator).map(p => p.id)));
  }, [state.players]);

  const hideAllBoards = useCallback(() => {
    setVisibleBoards(new Set());
  }, []);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (errorMsg) {
    return <div className="error">{errorMsg}</div>;
  }

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
                    onClick={handleSubmitAnswer}
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
              allAnswersThisRound={state.allAnswersThisRound}
              evaluatedAnswers={state.evaluatedAnswers}
              focusedPlayerId={previewMode.focusedPlayerId}
              onClose={() => setPreviewMode(prev => ({ ...prev, isActive: false }))}
            />
          )}
        </div>
        <div className="col-md-4">
          <div className="player-list-container">
            <PlayerList
              players={state.players}
              onPlayerSelect={(playerId) => {
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
              showAllBoards={showAllBoards}
              hideAllBoards={hideAllBoards}
              visibleBoards={visibleBoards}
              onSwitchToSpectator={handleSwitchToSpectator}
              onJoinAsPlayer={handleJoinAsPlayer}
              isSpectator={state.isSpectator}
            />
          </div>
        </div>
      </div>
      {reviewNotification && (
        <ReviewNotification
          isCorrect={reviewNotification.isCorrect}
          message={reviewNotification.message}
        />
      )}
      <ConfirmationModal
        show={showSpectatorConfirm}
        onHide={() => setShowSpectatorConfirm(false)}
        onConfirm={confirmSwitchToSpectator}
        title="Switch to Spectator Mode"
        message="Are you sure you want to switch to spectator mode? You won't be able to participate in the game anymore."
      />
    </div>
  );
};

export default Player; 
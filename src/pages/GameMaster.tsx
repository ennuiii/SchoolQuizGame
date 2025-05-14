import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import QuestionSelector from '../components/game-master/QuestionSelector';
import QuestionDisplay from '../components/game-master/QuestionDisplay';
import GameControls from '../components/game-master/GameControls';
import AnswerList from '../components/game-master/AnswerList';
import Timer from '../components/shared/Timer';
import RoomCode from '../components/shared/RoomCode';
import { useGame } from '../contexts/GameContext';
import { useRoom } from '../contexts/RoomContext';
import { useAudio } from '../contexts/AudioContext';
import RoomSettings from '../components/game-master/RoomSettings';
import RecapModal from '../components/shared/RecapModal';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import { ConnectionStatus } from '../components/shared/ConnectionStatus';
import type { Question } from '../contexts/GameContext';

interface Round {
  roundNumber: number;
  question: {
    text: string;
    answer: string;
    grade: string;
    subject: string;
    type: 'text' | 'drawing';
  };
  correctAnswers: number;
  totalAnswers: number;
  submissions: Array<{
    playerId: string;
    answer: string;
    isCorrect: boolean;
  }>;
}

interface GameRecap {
  roomCode: string;
  startTime: Date;
  endTime: Date;
  players: Array<{
    id: string;
    name: string;
    score: number;
    finalLives: number;
    isSpectator: boolean;
    isWinner: boolean;
  }>;
  rounds: Round[];
  correctAnswers: number;
  totalQuestions: number;
  score: number;
}

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined);
  const [boardTransforms, setBoardTransforms] = useState<{[playerId: string]: {scale: number, x: number, y: number}}>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [customTimeLimit, setCustomTimeLimit] = useState<number | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<GameRecap | null>(null);
  const [timeLimit, setTimeLimit] = useState(30);
  const [inputRoomCode, setInputRoomCode] = useState('');
  
  // Get context values
  const {
    roomCode,
    isLoading,
    createRoom,
    leaveRoom,
    players
  } = useRoom();

  const {
    gameStarted,
    currentQuestion,
    playerBoards,
    visibleBoards,
    allAnswersThisRound,
    evaluatedAnswers,
    previewMode,
    questions,
    setQuestions,
    startGame,
    nextQuestion,
    evaluateAnswer,
    restartGame,
    endRoundEarly,
    toggleBoardVisibility,
    startPreviewMode,
    stopPreviewMode,
    focusSubmission,
    timeLimit: gameTimeLimit,
    timeRemaining,
    isTimerRunning,
    questionErrorMsg
  } = useGame();

  const {
    isMuted,
    toggleMute,
    setVolume,
    volume
  } = useAudio();

  // Create a room if one doesn't exist
  useEffect(() => {
    // Only connect to socket, don't auto-create room
    if (!socketService.getConnectionState()) {
      socketService.connect();
      
      socketService.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
        setIsConnecting(false);
        navigate('/');
      });

      return () => {
        socketService.off('connect_error');
      };
    }
  }, [navigate]);

  const handleJoinRoom = useCallback(() => {
    const newRoomCode = inputRoomCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    createRoom(newRoomCode);
  }, [createRoom, inputRoomCode]);

  useEffect(() => {
    socketService.on('game_recap', (recap: GameRecap) => {
      setRecapData(recap);
      setShowRecap(true);
    });

    return () => {
      socketService.off('game_recap');
    };
  }, []);

  // Effect for handling game state changes
  useEffect(() => {
    console.log('[GameMaster] Game state changed:', {
      started: gameStarted,
      questionIndex: currentQuestion,
      timeRemaining,
      playerCount: players.length,
      timestamp: new Date().toISOString()
    });
  }, [gameStarted, currentQuestion, timeRemaining, players]);

  // Handle game start
  const handleStartGame = async () => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot start game - No room code found');
      return;
    }

    try {
      console.log('[GameMaster] Starting game:', {
        roomCode,
        questionCount: questions.length,
        timeLimit,
        timestamp: new Date().toISOString()
      });

      await startGame(roomCode, questions, customTimeLimit ?? 30);
      console.log('[GameMaster] Game started successfully');
    } catch (error) {
      console.error('[GameMaster] Failed to start game:', error);
      toast.error('Failed to start game. Please try again.');
    }
  };

  // Handle next question
  const handleNextQuestion = async () => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot proceed to next question - No room code found');
      return;
    }

    try {
      console.log('[GameMaster] Moving to next question:', {
        roomCode,
        currentIndex: currentQuestion,
        timestamp: new Date().toISOString()
      });

      await nextQuestion(roomCode);
      console.log('[GameMaster] Moved to next question successfully');
    } catch (error) {
      console.error('[GameMaster] Failed to move to next question:', error);
      toast.error('Failed to proceed to next question. Please try again.');
    }
  };

  // Handle preview mode
  const handleStartPreview = () => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot start preview - No room code found');
      return;
    }

    console.log('[GameMaster] Starting preview mode:', {
      roomCode,
      timestamp: new Date().toISOString()
    });
    socketService.startPreviewMode(roomCode);
  };

  const handleStopPreview = () => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot stop preview - No room code found');
      return;
    }

    console.log('[GameMaster] Stopping preview mode:', {
      roomCode,
      timestamp: new Date().toISOString()
    });
    socketService.stopPreviewMode(roomCode);
  };

  // Handle answer evaluation
  const handleEvaluateAnswer = async (playerId: string, isCorrect: boolean) => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot evaluate answer - No room code found');
      return;
    }

    try {
      console.log('[GameMaster] Evaluating answer:', {
        roomCode,
        playerId,
        isCorrect,
        timestamp: new Date().toISOString()
      });

      await evaluateAnswer(roomCode, playerId, isCorrect);
      console.log('[GameMaster] Answer evaluated successfully');
    } catch (error) {
      console.error('[GameMaster] Failed to evaluate answer:', error);
      toast.error('Failed to evaluate answer. Please try again.');
    }
  };

  // Handle end game
  const handleEndGame = async () => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot end game - No room code found');
      return;
    }

    try {
      console.log('[GameMaster] Ending game:', {
        roomCode,
        timestamp: new Date().toISOString()
      });

      await socketService.endGame(roomCode);
      console.log('[GameMaster] Game ended successfully');
    } catch (error) {
      console.error('[GameMaster] Failed to end game:', error);
      toast.error('Failed to end game. Please try again.');
    }
  };

  const handleEndRoundEarly = useCallback(() => {
    setShowEndRoundConfirm(true);
  }, []);

  const confirmEndRoundEarly = useCallback(() => {
    if (!roomCode) return;
    endRoundEarly(roomCode);
    setShowEndRoundConfirm(false);
  }, [roomCode, endRoundEarly]);

  const cancelEndRoundEarly = useCallback(() => {
    setShowEndRoundConfirm(false);
  }, []);

  const handleFocusSubmission = useCallback((playerId: string) => {
    if (!roomCode) return;
    focusSubmission(roomCode, playerId);
  }, [roomCode, focusSubmission]);

  const handlePlayerSelect = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    toggleBoardVisibility(playerId);
  }, [toggleBoardVisibility]);

  const handleBoardScale = useCallback((playerId: string, scale: number) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], scale }
    }));
  }, []);

  const handleBoardPan = useCallback((playerId: string, dx: number, dy: number) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        x: (prev[playerId]?.x || 0) + dx,
        y: (prev[playerId]?.y || 0) + dy
      }
    }));
  }, []);

  const handleBoardReset = useCallback((playerId: string) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: { scale: 1, x: 0, y: 0 }
    }));
  }, []);

  const showAllBoards = useCallback(() => {
    toggleBoardVisibility(new Set(playerBoards.filter(b => {
      const player = players.find(p => p.id === b.playerId);
      return player && !player.isSpectator;
    }).map(b => b.playerId)));
  }, [playerBoards, players, toggleBoardVisibility]);

  const hideAllBoards = useCallback(() => {
    toggleBoardVisibility(new Set());
  }, [toggleBoardVisibility]);

  // Initialize board transforms
  useEffect(() => {
    const initialTransforms: {[playerId: string]: {scale: number, x: number, y: number}} = {};
    players.forEach(player => {
      initialTransforms[player.id] = { scale: 1, x: 0, y: 0 };
    });
    setBoardTransforms(initialTransforms);
  }, [players]);

  // Handle game recap
  const handleGameRecap = (recap: GameRecap) => {
    console.log('[GameMaster] Received game recap:', recap);
    setRecapData(recap);
    setShowRecap(true);
  };

  // Show room code entry if no room code exists
  if (!roomCode) {
    return (
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
                value={inputRoomCode}
                onChange={e => setInputRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              <small className="text-muted">
                You can specify a custom room code or leave it blank for a random one.
              </small>
            </div>
            <button
              className="btn btn-primary btn-lg mt-3"
              onClick={handleJoinRoom}
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
    );
  }

  // Show loading state while socket is connecting
  if (!socketService.getConnectionState() || socketService.getConnectionState() === 'connecting') {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <h2>Connecting to Game Server...</h2>
          <div className="spinner-border text-primary mt-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-person-workspace section-icon" aria-label="Game Master"></span>
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
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: '100px' }}
            title="Volume"
          />
          <button
            className="btn btn-outline-secondary"
            onClick={toggleMute}
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

      {questionErrorMsg && (
        <div className="alert alert-info mb-4" role="alert">
          {questionErrorMsg}
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

      <div className="row g-3">
        <div className="col-12 col-md-4">
          <RoomSettings timeLimit={customTimeLimit} onTimeLimitChange={setCustomTimeLimit} />
          <RoomCode />
          {!previewMode.isActive && (
            <div className="mb-3">
              <button
                className="btn btn-primary w-100"
                onClick={handleStartPreview}
                disabled={!gameStarted}
              >
                Start Preview Mode
              </button>
            </div>
          )}
          <PlayerList 
            title="Players"
            onPlayerSelect={handlePlayerSelect}
            selectedPlayerId={selectedPlayerId}
          />
          <div className="d-grid gap-2 mt-3">
            <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>Leave Game</button>
            {!gameStarted && (
              <button 
                className="btn btn-success" 
                onClick={handleStartGame}
                disabled={isConnecting || questions.length === 0 || players.filter(p => !p.isSpectator).length < 2}
                title={
                  isConnecting ? "Connecting to server..." :
                  players.filter(p => !p.isSpectator).length < 2 ? "Need at least 2 active players to start" : 
                  questions.length === 0 ? "Please select questions first" : ""
                }
              >
                {isConnecting ? "Connecting..." : `Start Game (${players.filter(p => !p.isSpectator).length} players, ${questions.length} questions)`}
              </button>
            )}
            {gameStarted && (
              <>
                <button className="btn btn-primary" onClick={handleNextQuestion}>Next Question</button>
                <button className="btn btn-warning" onClick={handleEndRoundEarly}>End Round Early</button>
                <button className="btn btn-danger" onClick={handleEndGame}>End Game</button>
              </>
            )}
          </div>
        </div>
        <div className="col-12 col-md-8">
          {!gameStarted ? (
            <QuestionSelector
              onQuestionsSelected={setQuestions}
              selectedQuestions={questions}
              onSelectedQuestionsChange={setQuestions}
            />
          ) : (
            <>
              <QuestionDisplay question={currentQuestion} />
              {timeLimit !== null && timeRemaining !== null && (
                <Timer
                  isActive={isTimerRunning}
                  showSeconds={true}
                />
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
                        onToggleVisibility={id => toggleBoardVisibility(id)}
                        transform={boardTransforms[board.playerId] || { scale: 1, x: 0, y: 0 }}
                        onScale={handleBoardScale}
                        onPan={handleBoardPan}
                        onReset={handleBoardReset}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <AnswerList
                onEvaluate={handleEvaluateAnswer}
              />
              <PreviewOverlay
                onFocus={handleFocusSubmission}
                onClose={handleStopPreview}
                isGameMaster={true}
              />
            </>
          )}
        </div>
      </div>

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
            onClick={handleStopPreview}
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

      <RecapModal
        show={showRecap}
        onHide={() => setShowRecap(false)}
        recap={recapData}
      />
    </div>
  );
};

export default GameMaster; 
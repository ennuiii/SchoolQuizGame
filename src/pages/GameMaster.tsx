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

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined);
  const [boardTransforms, setBoardTransforms] = useState<{[playerId: string]: {scale: number, x: number, y: number}}>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [customTimeLimit, setCustomTimeLimit] = useState<number | null>(null);
  const [timeLimit, setTimeLimit] = useState(99999);
  const [inputRoomCode, setInputRoomCode] = useState('');
  
  const {
    roomCode,
    isLoading: isRoomLoading,
    setIsLoading: setIsRoomLoading,
    createRoom,
    players
  } = useRoom();

  const {
    gameStarted,
    currentQuestion,
    playerBoards,
    visibleBoards,
    previewMode,
    questions,
    setQuestions,
    startGame,
    nextQuestion,
    evaluateAnswer,
    restartGame,
    endRoundEarly,
    toggleBoardVisibility,
    focusSubmission,
    timeLimit: gameTimeLimit,
    timeRemaining,
    isTimerRunning,
    isGameConcluded,
    gmShowRecapToAll,
    gmEndGameRequest,
    gameRecapData,
    recapSelectedRoundIndex,
    recapSelectedTabKey,
    gmNavigateRecapRound,
    gmNavigateRecapTab,
    hideRecap
  } = useGame();

  const {
  } = useAudio();

  useEffect(() => {
    if (!socketService.getConnectionState()) {
      socketService.connect();
      socketService.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
        navigate('/');
      });
      return () => {
        socketService.off('connect_error');
      };
    }
  }, [navigate]);

  const handleCreateRoom = useCallback(() => {
    const newRoomCode = inputRoomCode.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log('[GameMaster] Attempting to create room:', newRoomCode);
    
    const socket = socketService.connect();
    if (!socket) {
      console.error('[GameMaster] Failed to connect socket');
      toast.error('Failed to connect to server. Please try again.');
      return;
    }

    setIsRoomLoading(true);
    createRoom(newRoomCode);
  }, [createRoom, inputRoomCode, setIsRoomLoading]);

  useEffect(() => {
    console.log('[GameMaster] Game state changed:', {
      started: gameStarted,
      hasCurrentQuestion: !!currentQuestion,
      questionIndex: currentQuestion?.id,
      timeRemaining,
      playerCount: players.length,
      gameRecapAvailable: !!gameRecapData,
      timestamp: new Date().toISOString()
    });
  }, [gameStarted, currentQuestion, timeRemaining, players, gameRecapData]);

  const handleStartGame = async () => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot start game - No room code found');
      toast.error('Room not found. Please create a room first.');
      return;
    }
    if (!questions || questions.length === 0) {
      console.error('[GameMaster] Cannot start game - No questions selected');
      toast.error('Please select questions before starting the game');
      return;
    }
    try {
      const effectiveTimeLimit = customTimeLimit === null || customTimeLimit === 0 ? 99999 : customTimeLimit;
      console.log('[GameMaster] Starting game:', {
        roomCode,
        questionCount: questions.length,
        timeLimit: effectiveTimeLimit,
        socketId: socketService.getSocketId()
      });
      await startGame(roomCode, questions, effectiveTimeLimit);
      console.log('[GameMaster] Game start request sent successfully');
    } catch (error) {
      console.error('[GameMaster] Failed to start game:', error);
      toast.error('Failed to start game. Please try again.');
    }
  };

  const handleNextQuestion = async () => {
    if (!roomCode) return toast.error('Room code not found.');
    try {
      await nextQuestion(roomCode);
    } catch (error) {
      console.error('[GameMaster] Failed to move to next question:', error);
      toast.error('Failed to proceed to next question.');
    }
  };

  const handleStartPreview = () => {
    if (!roomCode) return toast.error('Room code not found.');
    socketService.startPreviewMode(roomCode);
  };

  const handleStopPreview = () => {
    if (!roomCode) return toast.error('Room code not found.');
    socketService.stopPreviewMode(roomCode);
  };

  const handleEvaluateAnswer = async (playerId: string, isCorrect: boolean) => {
    if (!roomCode) return toast.error('Room code not found.');
    try {
      await evaluateAnswer(roomCode, playerId, isCorrect);
    } catch (error) {
      console.error('[GameMaster] Failed to evaluate answer:', error);
      toast.error('Failed to evaluate answer.');
    }
  };

  const handleEndGameRequest = async () => {
    if (!roomCode) return toast.error('Room code not found.');
    try {
      gmEndGameRequest(roomCode);
    } catch (error) {
      console.error('[GameMaster] Failed to request end game:', error);
      toast.error('Failed to request end game.');
    }
  };

  const handleShowRecapButtonClick = () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (!isGameConcluded) {
      toast.warn('Game must be concluded before showing recap.');
      return;
    }
    gmShowRecapToAll(roomCode);
    toast.info('Broadcasting game recap to all players.');
  };

  const handleRestartGame = async () => {
    if (!roomCode) return toast.error("No room code found to restart the game.");
    setIsRestarting(true);
    try {
      await restartGame(roomCode);
      toast.success("Game is restarting!");
    } catch (error) {
      console.error("[GameMaster] Failed to restart game:", error);
      toast.error("Failed to restart game. Please try again.");
    } finally {
      setIsRestarting(false);
    }
  };

  const handleEndRoundEarlyAction = useCallback(() => {
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

  const handleFocusSubmissionInternal = useCallback((playerId: string) => {
    if (!roomCode) return;
    focusSubmission(roomCode, playerId);
  }, [roomCode, focusSubmission]);

  const handlePlayerSelect = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    toggleBoardVisibility(playerId);
  }, [toggleBoardVisibility]);

  const handleBoardScale = useCallback((playerId: string, scale: number) => {
    setBoardTransforms(prev => ({ ...prev, [playerId]: { ...(prev[playerId] || { scale: 1, x: 0, y: 0 }), scale } }));
  }, []);

  const handleBoardPan = useCallback((playerId: string, dx: number, dy: number) => {
    setBoardTransforms(prev => ({ ...prev, [playerId]: { scale: prev[playerId]?.scale || 1, x: (prev[playerId]?.x || 0) + dx, y: (prev[playerId]?.y || 0) + dy } }));
  }, []);

  const handleBoardReset = useCallback((playerId: string) => {
    setBoardTransforms(prev => ({ ...prev, [playerId]: { scale: 1, x: 0, y: 0 } }));
  }, []);

  const showAllBoards = useCallback(() => {
    const activePlayerBoardIds = playerBoards
      .filter(b => players.find(p => p.id === b.playerId && !p.isSpectator))
      .map(b => b.playerId);
    toggleBoardVisibility(new Set(activePlayerBoardIds));
  }, [playerBoards, players, toggleBoardVisibility]);

  const hideAllBoards = useCallback(() => {
    toggleBoardVisibility(new Set());
  }, [toggleBoardVisibility]);

  useEffect(() => {
    const initialTransforms: {[playerId: string]: {scale: number, x: number, y: number}} = {};
    players.forEach(player => {
      initialTransforms[player.id] = { scale: 1, x: 0, y: 0 };
    });
    setBoardTransforms(initialTransforms);
  }, [players]);

  if (!roomCode) {
    return (
      <div className="container mt-5">
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
                onClick={handleCreateRoom}
                disabled={isRoomLoading}
              >
                {isRoomLoading ? 'Creating...' : 'Create Room'}
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
      </div>
    );
  }

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
    <div className="container-fluid py-4">
      <LoadingOverlay isVisible={isRoomLoading} />
      <ConnectionStatus />

      {showEndRoundConfirm && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">End Round Early?</h5>
                <button type="button" className="btn-close" onClick={cancelEndRoundEarly}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to end this round early? All players who haven't submitted will receive no points.</p>
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
          {gameStarted && !previewMode.isActive && (
            <div className="mb-3">
              <button className="btn btn-primary w-100" onClick={handleStartPreview}>
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
            {!gameStarted ? (
              <button 
                className="btn btn-success" 
                onClick={handleStartGame}
                disabled={isConnecting || questions.length === 0 || players.filter(p => !p.isSpectator).length < 1}
                title={
                  isConnecting ? "Connecting to server..." :
                  players.filter(p => !p.isSpectator).length < 1 ? "Need at least 1 active player to start" :
                  questions.length === 0 ? "Please select questions first" : ""
                }
              >
                {isConnecting ? "Connecting..." : `Start Game (${players.filter(p => !p.isSpectator).length} players, ${questions.length} questions)`}
              </button>
            ) : (
              <>
                <button 
                  className="btn btn-primary" 
                  onClick={handleNextQuestion}
                  disabled={!currentQuestion || isRestarting || isGameConcluded}
                >
                  Next Question
                </button>
                <button 
                  className="btn btn-warning" 
                  onClick={handleEndRoundEarlyAction}
                  disabled={!currentQuestion || isRestarting || isGameConcluded}
                >
                  End Round Early
                </button>
                <button 
                  className="btn btn-info"
                  onClick={handleRestartGame}
                  disabled={isRestarting || !gameStarted}
                >
                  {isRestarting ? 'Restarting...' : 'Restart Game'}
                </button>
                {!isGameConcluded && (
                  <button 
                    className="btn btn-danger" 
                    onClick={handleEndGameRequest}
                    disabled={isRestarting || !gameStarted}
                  >
                    End Game
                  </button>
                )}
                {isGameConcluded && (
                  <button
                    className="btn btn-success"
                    onClick={handleShowRecapButtonClick}
                    disabled={isRestarting}
                  >
                    Show Game Recap For All
                  </button>
                )}
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
              <div className="card mb-3">
                <div className="card-body">
                  <QuestionDisplay question={currentQuestion} />
                  {gameTimeLimit !== null && gameTimeLimit < 99999 && (
                    <div className="mt-3">
                      <Timer isActive={isTimerRunning} showSeconds={true} />
                    </div>
                  )}
                </div>
              </div>

              <AnswerList onEvaluate={handleEvaluateAnswer} />
              
              <div className="card mb-3">
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
                    {players.filter(player => !player.isSpectator).map(player => {
                      const boardEntry = playerBoards.find(b => b.playerId === player.id);
                      const boardForDisplay = {
                        playerId: player.id,
                        playerName: player.name,
                        boardData: boardEntry ? boardEntry.boardData : ''
                      };
                      return (
                        <PlayerBoardDisplay
                          key={player.id}
                          board={boardForDisplay}
                          isVisible={visibleBoards.has(player.id)}
                          onToggleVisibility={id => toggleBoardVisibility(id)}
                          transform={boardTransforms[player.id] || { scale: 1, x: 0, y: 0 }}
                          onScale={handleBoardScale}
                          onPan={handleBoardPan}
                          onReset={handleBoardReset}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {previewMode.isActive && (
        <PreviewOverlay
          onFocus={handleFocusSubmissionInternal}
          onClose={handleStopPreview}
          isGameMaster={true}
        />
      )}

      {gameRecapData && roomCode && (
        <RecapModal
          show={!!gameRecapData}
          onHide={() => hideRecap()}
          recap={gameRecapData}
          selectedRoundIndex={recapSelectedRoundIndex ?? 0}
          onRoundChange={(index) => gmNavigateRecapRound(roomCode, index)}
          isControllable={true}
          activeTabKey={recapSelectedTabKey}
          onTabChange={(tabKey) => gmNavigateRecapTab(roomCode, tabKey)}
        />
      )}
    </div>
  );
};

export default GameMaster; 
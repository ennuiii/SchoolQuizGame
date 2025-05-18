import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlayV2 from '../components/shared/PreviewOverlayV2';
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
import type { Player } from '../types/game';
import MusicControl from '../components/shared/MusicControl';

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
    players,
    setRoomCode,
    kickPlayer,
    connectionStatus,
    isGameMaster
  } = useRoom();

  // DEBUG: Log players from useRoom to understand the button's player count
  useEffect(() => {
    console.log('[GameMaster] Debug: useRoom().players updated:', JSON.stringify(players, null, 2));
    const nonSpectators = players.filter(p => !p.isSpectator);
    console.log(
      '[GameMaster] Debug: Non-spectators from useRoom():', 
      nonSpectators.length, 
      nonSpectators.map(p => ({ id: p.id, name: p.name, isSpectator: p.isSpectator }))
    );
  }, [players]);

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
    hideRecap,
    allAnswersThisRound,
    evaluatedAnswers,
    previewOverlayVersion,
    setPreviewOverlayVersion,
    players: gamePlayers
  } = useGame();

  const {
    playBackgroundMusic
  } = useAudio();

  const handleKickPlayer = useCallback((playerId: string) => {
    if (!roomCode) {
      toast.error("Room code not found. Cannot kick player.");
      return;
    }
    if (!kickPlayer) {
      toast.error("Kick player function not available.");
      return;
    }
    console.log(`[GameMaster] Request to kick player ${playerId} from room ${roomCode}`);
    kickPlayer(playerId);
    toast.info(`Kicking player ${playerId}...`);
  }, [roomCode, kickPlayer]);

  const allAnswersEvaluated = Object.keys(allAnswersThisRound).length > 0 && 
                              Object.keys(allAnswersThisRound).every(playerId => evaluatedAnswers.hasOwnProperty(playerId));

  // Always attempt to connect to socket server on component mount
  useEffect(() => {
    console.log('[GameMaster] Attempting to establish socket connection...');
    
    // Set GameMaster authentication details
    socketService.setPlayerDetails('GameMaster');
    socketService.setGMConnectionDetails(true);
    
    // Always attempt to connect, even if getConnectionState reports a connection
    // This ensures we have a fresh connection attempt whenever this component mounts
    socketService.connect()
      .then(socket => {
        console.log('[GameMaster] Socket connection successful:', socket?.id);
      })
      .catch(error => {
        console.error('[GameMaster] Socket connection failed:', error);
        toast.error('Failed to connect to game server. Please refresh and try again.');
      });
    
    // Set up error handler
    socketService.on('connect_error', (error: Error) => {
      console.error('[GameMaster] Socket connection error:', error);
      toast.error(`Connection error: ${error.message}`);
    });
    
    return () => {
      socketService.off('connect_error');
      // We don't disconnect here as other components might still need the connection
    };
  }, [navigate]);

  useEffect(() => {
    playBackgroundMusic();
  }, [playBackgroundMusic]);

  // Request game state update upon reconnection if we already have a roomCode
  useEffect(() => {
    if (connectionStatus === 'connected' && roomCode) {
      console.log('[GameMaster] Connected with room code, requesting game state update...');
      socketService.requestGameState(roomCode);
      
      // Also explicitly request current player list
      socketService.requestPlayers(roomCode);
    }
  }, [connectionStatus, roomCode]);

  // Explicitly listen for player updates
  useEffect(() => {
    const handlePlayersUpdate = (updatedPlayers: Player[]) => {
      console.log('[GameMaster] Received players_update with', updatedPlayers.length, 'players');
    };

    if (connectionStatus === 'connected') {
      socketService.on('players_update', handlePlayersUpdate);
    }

    return () => {
      socketService.off('players_update', handlePlayersUpdate);
    };
  }, [connectionStatus]);

  const handleCreateRoom = useCallback(() => {
    // Check connection state before trying to create a room
    if (connectionStatus !== 'connected') {
      toast.error('Cannot create room: You are disconnected from the server. Please wait for reconnection.');
      return;
    }

    const newRoomCode = inputRoomCode.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log('[GameMaster] Attempting to create room:', newRoomCode);
    
    setIsRoomLoading(true);
    createRoom(newRoomCode);
  }, [createRoom, inputRoomCode, setIsRoomLoading, connectionStatus]);

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
    if (connectionStatus !== 'connected') {
      toast.error('Cannot start game: You are disconnected from the server. Please wait for reconnection.');
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
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot proceed: You are disconnected from the server. Please wait for reconnection.');
    }
    try {
      await nextQuestion(roomCode);
    } catch (error) {
      console.error('[GameMaster] Failed to move to next question:', error);
      toast.error('Failed to proceed to next question.');
    }
  };

  const handleStartPreview = () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot start preview: You are disconnected from the server. Please wait for reconnection.');
    }
    socketService.startPreviewMode(roomCode);
  };

  const handleStopPreview = () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot stop preview: You are disconnected from the server. Please wait for reconnection.');
    }
    socketService.stopPreviewMode(roomCode);
  };

  const handleEvaluateAnswer = async (playerId: string, isCorrect: boolean) => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot evaluate answer: You are disconnected from the server. Please wait for reconnection.');
    }
    try {
      await evaluateAnswer(roomCode, playerId, isCorrect);
    } catch (error) {
      console.error('[GameMaster] Failed to evaluate answer:', error);
      toast.error('Failed to evaluate answer.');
    }
  };

  const handleEndGameRequest = async () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot end game: You are disconnected from the server. Please wait for reconnection.');
    }
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
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot show recap: You are disconnected from the server. Please wait for reconnection.');
    }
    gmShowRecapToAll(roomCode);
    toast.info('Broadcasting game recap to all players.');
  };

  const handleRestartGame = async () => {
    if (!roomCode) return toast.error("No room code found to restart the game.");
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot restart game: You are disconnected from the server. Please wait for reconnection.');
    }
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
    if (connectionStatus !== 'connected') {
      toast.error('Cannot end round: You are disconnected from the server. Please wait for reconnection.');
      return;
    }
    setShowEndRoundConfirm(true);
  }, [connectionStatus]);

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

  useEffect(() => {
    if (!roomCode) {
      const storedRoomCode = sessionStorage.getItem('roomCode');
      if (storedRoomCode) {
        setRoomCode(storedRoomCode);
      }
    }
  }, [roomCode, setRoomCode]);

  // Show loading overlay if trying to connect or reconnect
  if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
    return (
      <LoadingOverlay 
        isVisible={true} 
        message={connectionStatus === 'connecting' ? 'Connecting to server...' : 'Reconnecting to server...'} 
      />
    );
  }

  // Show error if connection failed completely
  if (connectionStatus === 'reconnect_failed' || connectionStatus === 'error') {
    return (
      <div className="container text-center mt-5">
        <div className="alert alert-danger">
          <h4>Connection Error</h4>
          <p>Could not connect to the game server. Please refresh the page to try again.</p>
          <button className="btn btn-primary mt-3" onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

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
                disabled={isRoomLoading || connectionStatus !== 'connected'}
              >
                {isRoomLoading ? 'Creating...' : connectionStatus !== 'connected' ? 'Waiting for connection...' : 'Create Room'}
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
    <>
      <MusicControl />
      <div className="container-fluid py-4">
        <LoadingOverlay isVisible={isRoomLoading} />
        <ConnectionStatus showDetails={true} />
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
        {connectionStatus === 'disconnected' && (
          <div className="alert alert-warning">
            <strong>Disconnected from server.</strong> Attempting to reconnect... Game controls are disabled until reconnection.
          </div>
        )}
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <RoomSettings timeLimit={customTimeLimit} onTimeLimitChange={setCustomTimeLimit} />
            <RoomCode />
            {gameStarted && !previewMode.isActive && (
              <div className="mb-3">
                <button className="btn btn-primary w-100" 
                  onClick={handleStartPreview}
                  disabled={connectionStatus !== 'connected'}>
                  Start Preview Mode
                </button>
              </div>
            )}
            <PlayerList 
              title="Players"
              onPlayerSelect={handlePlayerSelect}
              selectedPlayerId={selectedPlayerId}
              isGameMasterView={true}
              onKickPlayer={handleKickPlayer}
            />
            <div className="d-grid gap-2 mt-3">
              <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>Leave Game</button>
              {!gameStarted ? (
                <button 
                  className="btn btn-success" 
                  onClick={handleStartGame}
                  disabled={isConnecting || questions.length === 0 || gamePlayers.filter(p => !p.isSpectator).length < 1 || connectionStatus !== 'connected'}
                  title={
                    isConnecting ? "Connecting to server..." :
                    connectionStatus !== 'connected' ? "Not connected to server" :
                    gamePlayers.filter(p => !p.isSpectator).length < 1 ? "Need at least 1 active player to start" :
                    questions.length === 0 ? "Please select questions first" : ""
                  }
                >
                  {isConnecting ? "Connecting..." : 
                   connectionStatus !== 'connected' ? "Waiting for connection..." :
                   `Start Game (${gamePlayers.filter(p => !p.isSpectator).length} players, ${questions.length} questions)`}
                </button>
              ) : (
                <>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleNextQuestion}
                    disabled={!currentQuestion || isRestarting || isGameConcluded || !allAnswersEvaluated || connectionStatus !== 'connected'}
                    title={
                      connectionStatus !== 'connected' ? "Not connected to server" :
                      currentQuestion && !isRestarting && !isGameConcluded && !allAnswersEvaluated ? 
                        (Object.keys(allAnswersThisRound).length === 0 ? 
                          "Waiting for players to submit answers for this round." : 
                          "All submitted answers must be evaluated before proceeding.") : 
                        ""
                    }
                  >
                    Next Question
                  </button>
                  <button 
                    className="btn btn-warning" 
                    onClick={handleEndRoundEarlyAction}
                    disabled={!currentQuestion || isRestarting || isGameConcluded || connectionStatus !== 'connected'}
                  >
                    End Round Early
                  </button>
                  <button 
                    className="btn btn-info"
                    onClick={handleRestartGame}
                    disabled={isRestarting || !gameStarted || connectionStatus !== 'connected'}
                  >
                    {isRestarting ? 'Restarting...' : 'Restart Game'}
                  </button>
                  {!isGameConcluded && (
                    <button 
                      className="btn btn-danger" 
                      onClick={() => {
                        console.log('[GameMaster] End Game button clicked. Attempting to emit gmEndGameRequest. Room:', roomCode);
                        handleEndGameRequest();
                      }}
                      disabled={isRestarting || connectionStatus !== 'connected'}
                    >
                      End Game
                    </button>
                  )}
                  {isGameConcluded && (
                    <button
                      className="btn btn-success"
                      onClick={handleShowRecapButtonClick}
                      disabled={isRestarting || connectionStatus !== 'connected'}
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
                      <button className="btn btn-sm btn-outline-primary" 
                        onClick={showAllBoards}
                        disabled={connectionStatus !== 'connected'}>
                        Show All
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" 
                        onClick={hideAllBoards}
                        disabled={connectionStatus !== 'connected'}>
                        Hide All
                      </button>
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
                      {gamePlayers.filter(player => !player.isSpectator).map(player => {
                        const boardEntry = playerBoards.find(b => b.playerId === player.id);
                        const boardForDisplay = {
                          playerId: player.id,
                          persistentPlayerId: player.persistentPlayerId,
                          playerName: player.name,
                          boardData: boardEntry ? boardEntry.boardData : ''
                        };
                        return (
                          <PlayerBoardDisplay
                            key={player.id}
                            board={boardForDisplay}
                            isVisible={visibleBoards.has(player.id)}
                            onToggleVisibility={toggleBoardVisibility}
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
          <PreviewOverlayV2
            onFocus={handleFocusSubmissionInternal}
            onClose={handleStopPreview}
            isGameMaster={true}
            onEvaluate={handleEvaluateAnswer}
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
    </>
  );
};

export default GameMaster; 
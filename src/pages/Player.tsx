import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PreviewOverlayV2 from '../components/shared/PreviewOverlayV2';
import QuestionCard from '../components/shared/QuestionCard';
import Timer from '../components/shared/Timer';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';
import { useGame } from '../contexts/GameContext';
import { useAudio } from '../contexts/AudioContext';
import { useRoom } from '../contexts/RoomContext';
import { useCanvas } from '../contexts/CanvasContext';
import DrawingBoard from '../components/player/DrawingBoard';
import RecapModal from '../components/shared/RecapModal';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import { ConnectionStatus } from '../components/shared/ConnectionStatus';
import ReviewNotification from '../components/player/ReviewNotification';
import MusicControl from '../components/shared/MusicControl';

// Import Question and PlayerBoard types from GameContext
import type { PlayerBoard } from '../contexts/GameContext';

// TODO: Move BoardData to a shared types file if used elsewhere or becomes complex.
interface BoardData {
  data: string;
  timestamp: number;
}

const Player: React.FC = () => {
  const navigate = useNavigate();
  const [submittedAnswerLocal, setSubmittedAnswerLocal] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [answer, setAnswer] = useState('');
  
  // Get context values
  const {
    gameStarted,
    currentQuestion,
    timeLimit,
    timeRemaining,
    isTimerRunning,
    previewMode,
    previewOverlayVersion,
    toggleBoardVisibility,
    currentQuestionIndex,
    submittedAnswer,
    isGameConcluded,
    gameRecapData,
    recapSelectedRoundIndex,
    recapSelectedTabKey,
    hideRecap,
    allAnswersThisRound,
    players
  } = useGame();

  const {
    playBackgroundMusic,
    pauseBackgroundMusic
  } = useAudio();

  const {
    roomCode,
    playerName,
    isSpectator: amISpectator,
    isLoading: isRoomLoading,
    errorMsg,
    connectionStatus,
    persistentPlayerId
  } = useRoom();

  const { getCurrentCanvasSVG } = useCanvas();

  // Determine if player has already submitted answer from server state
  // This solves the issue where player can submit again after page refresh
  const hasSubmittedToServer = useMemo(() => {
    if (!persistentPlayerId || !allAnswersThisRound) return false;
    
    // Check if this player has an answer in the current round
    return Object.entries(allAnswersThisRound).some(([pid, _]) => 
      pid === persistentPlayerId
    );
  }, [persistentPlayerId, allAnswersThisRound]);

  // Sync local submission state with server state
  useEffect(() => {
    if (hasSubmittedToServer) {
      setSubmittedAnswerLocal(true);
    }
  }, [hasSubmittedToServer]);

  // Clear canvas and reset state when new question starts
  useEffect(() => {
    if (currentQuestion) {
      // Only reset submission state if not already submitted to this question
      if (!hasSubmittedToServer) {
        setSubmittedAnswerLocal(false);
        setCanvasKey(prev => prev + 1);
        setAnswer(''); // Clear text answer field on new question
      }
    }
  }, [currentQuestion?.id, currentQuestionIndex, hasSubmittedToServer]);

  // Effect for handling game state changes
  useEffect(() => {
    console.log('[Player] Game state changed:', {
      started: gameStarted,
      questionIndex: currentQuestionIndex,
      timeRemaining,
      contextSubmittedAnswer: submittedAnswer,
      localSubmissionLock: submittedAnswerLocal,
      hasSubmittedToServer,
      gameRecapAvailable: !!gameRecapData,
      timestamp: new Date().toISOString()
    });
  }, [gameStarted, currentQuestionIndex, timeRemaining, submittedAnswer, submittedAnswerLocal, gameRecapData, hasSubmittedToServer]);

  // Handle answer submission
  const handleAnswerSubmit = useCallback(async (textAnswer: string) => {
    if (!roomCode || !currentQuestion || submittedAnswerLocal || hasSubmittedToServer) {
      console.error('[Player] Cannot submit answer:', {
        hasRoomCode: !!roomCode,
        hasQuestion: !!currentQuestion,
        alreadySubmitted: submittedAnswerLocal || hasSubmittedToServer
      });
      return;
    }

    // Check connection before submitting
    if (connectionStatus !== 'connected') {
      toast.error('Cannot submit answer: You are disconnected from the server. Please wait for reconnection.');
      return;
    }

    try {
      let finalAnswer = textAnswer.trim();
      let drawingData: string | null = getCurrentCanvasSVG();
      const finalHasDrawing = !!(drawingData && drawingData.trim() !== '' && drawingData.includes('<svg'));

      // If there's no text answer AND no drawing, it's a truly empty submission.
      // If there IS a drawing OR some text, then proceed.
      if (!finalAnswer && !finalHasDrawing) {
        toast.error('Please enter an answer or submit a drawing');
        return;
      }

      // If text answer is empty BUT there is a drawing, or for any submission,
      // ensure empty text answers are sent as "-".
      if (finalAnswer === '') {
        finalAnswer = '-';
      }

      if (!finalHasDrawing) {
        drawingData = null;
      }

      console.log('[Player] Submitting answer:', {
        roomCode,
        answer: finalAnswer,
        hasDrawing: finalHasDrawing,
        drawingDataLength: drawingData?.length || 0,
        timestamp: new Date().toISOString()
      });

      await socketService.submitAnswer(roomCode, finalAnswer, finalHasDrawing, drawingData);
      setSubmittedAnswerLocal(true);
      toast.success('Answer submitted!');
    } catch (error) {
      console.error('[Player] Failed to submit answer:', error);
      toast.error('Failed to submit answer. Please try again.');
    }
  }, [roomCode, currentQuestion, submittedAnswerLocal, hasSubmittedToServer, getCurrentCanvasSVG, connectionStatus]);

  // Handle board updates
  const handleBoardUpdate = async (boardData: BoardData) => {
    if (!roomCode) {
      console.error('[Player] Cannot update board - No room code found');
      return;
    }
    
    // Skip updates if player has already submitted their answer
    if (submittedAnswerLocal || hasSubmittedToServer) {
      return;
    }
    
    // For board updates, we'll use the updateBoard method which uses volatile emissions
    // If not connected, these will be silently dropped
    try {
      socketService.updateBoard(roomCode, boardData.data);
    } catch (error) {
      // This should rarely happen as updateBoard uses volatile.emit
      console.error('[Player] Failed to update board:', error);
    }
  };

  // Auto-submit when time runs out
  useEffect(() => {
    if (
      gameStarted &&
      currentQuestion &&
      timeLimit !== null &&
      timeRemaining !== null &&
      timeRemaining <= 0 &&
      !submittedAnswerLocal &&
      !hasSubmittedToServer &&
      connectionStatus === 'connected' // Only try to submit if connected
    ) {
      console.log(`[Player.tsx] Auto-submitting due to timer. Answer: "${answer}"`);
      handleAnswerSubmit(answer);
    }
  }, [
    gameStarted,
    currentQuestion,
    timeLimit,
    timeRemaining,
    submittedAnswerLocal,
    hasSubmittedToServer,
    answer,
    handleAnswerSubmit,
    connectionStatus
  ]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (amISpectator) return; // Do nothing if spectator

    if (
      document.visibilityState === 'visible' &&
      gameStarted &&
      currentQuestion &&
      timeLimit !== null &&
      timeRemaining !== null &&
      timeRemaining <= 0 &&
      !submittedAnswerLocal &&
      !hasSubmittedToServer &&
      connectionStatus === 'connected' // Only try to submit if connected
    ) {
      console.log(`[Player.tsx] Auto-submitting due to visibility change + timer. Answer: "${answer}"`);
      handleAnswerSubmit(answer); // Submit current text answer
    }
  }, [
    amISpectator,
    gameStarted,
    currentQuestion,
    timeLimit,
    timeRemaining,
    submittedAnswerLocal,
    hasSubmittedToServer,
    answer,
    handleAnswerSubmit,
    connectionStatus
  ]);

  // Handle answer change
  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submittedAnswerLocal || hasSubmittedToServer) return;
    setAnswer(e.target.value);
  };

  // Handle visibility change
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Handle background music
  useEffect(() => {
    playBackgroundMusic();
    return () => {
      pauseBackgroundMusic();
    };
  }, [playBackgroundMusic, pauseBackgroundMusic]);

  useEffect(() => {
    if (amISpectator) {
      toast.info("You are a spectator. Redirecting to spectator view.");
      navigate('/spectator');
    }
  }, [amISpectator, navigate]);

  // If we have a stored roomCode but connection is lost, request game state update upon reconnection
  useEffect(() => {
    if (connectionStatus === 'connected' && roomCode) {
      // Attempt to rejoin the room
      console.log('[Player] Connected with room code, attempting to rejoin:', roomCode);
      
      if (!isRoomLoading) {
        socketService.rejoinRoom(roomCode, false); // false = not GM
      }
      
      // Request the latest state
      socketService.requestGameState(roomCode);
      socketService.requestPlayers(roomCode);
    }
  }, [connectionStatus, roomCode, isRoomLoading]);

  // Add a connection effect that initializes when component mounts
  useEffect(() => {
    if (playerName) {
      console.log('[Player] Attempting to establish socket connection with player name:', playerName);
      
      // Set Player authentication details
      socketService.setPlayerDetails(playerName);
      socketService.setGMConnectionDetails(false);
      
      // Always attempt to connect
      socketService.connect()
        .then(socket => {
          console.log('[Player] Socket connection successful:', socket?.id);
        })
        .catch(error => {
          console.error('[Player] Socket connection failed:', error);
          toast.error('Failed to connect to game server. Please refresh and try again.');
        });
      
      // Set up error handler
      socketService.on('connect_error', (error: Error) => {
        console.error('[Player] Socket connection error:', error);
        toast.error(`Connection error: ${error.message}`);
      });
      
      return () => {
        socketService.off('connect_error');
      };
    } else {
      console.log('[Player] No player name available yet for socket connection.');
    }
  }, [playerName, navigate]);

  if (!roomCode) {
    console.log('[Player] No room code found, redirecting to home');
    navigate('/');
    return null;
  }

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

  if (isRoomLoading) return <LoadingOverlay isVisible={true} />;
  if (errorMsg) return <div className="alert alert-danger">{errorMsg}</div>;
  
  // If game is concluded AND recap data is NOT YET available, show waiting message.
  // This covers the brief period after game_over_pending_recap and before game_recap is received.
  if (isGameConcluded && !gameRecapData) {
    return (
      <div className="container text-center mt-5">
        <div className="card p-5">
          <h2 className="h4 mb-3">Game Over!</h2>
          <p>Waiting for the game recap to be generated...</p>
          <div className="spinner-border text-primary mx-auto mt-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <button className="btn btn-outline-secondary mt-4" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }
  
  if (!playerName || amISpectator) {
    // This condition might need adjustment based on the new isGameConcluded flow
    // For now, it primarily catches initial loading/redirect issues.
    return (
      <div className="container text-center mt-5">
        <h2>Loading Player View...</h2>
        {amISpectator && <p>You are a spectator. You should be redirected shortly.</p>}
        {!playerName && <p>Missing player information.</p>}
        <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  if (previewMode.isActive) {
    return <PreviewOverlayV2 onClose={() => socketService.stopPreviewMode(roomCode)} onFocus={(pid) => socketService.focusSubmission(roomCode, pid)} isGameMaster={false} />;
  }

  // If recap data is available, show recap modal. This takes precedence over game view.
  if (gameRecapData && roomCode && hideRecap) {
    return (
      <RecapModal
        show={!!gameRecapData}
        onHide={() => hideRecap()} // Use hideRecap from context
        recap={gameRecapData} // From context
        selectedRoundIndex={recapSelectedRoundIndex ?? 0} // From context
        isControllable={false} // Player cannot control navigation
        activeTabKey={recapSelectedTabKey} // Pass activeTabKey from context
        // onRoundChange is not needed as isControllable is false
        // onTabChange is not needed as isControllable is false
      />
    );
  }

  // Helper: render controls for DrawingBoard
  const renderDrawingBoardControls = () => (
    <div className="d-flex align-items-center justify-content-end gap-3 w-100">
      <button
        className="btn btn-outline-light"
        onClick={() => setCanvasKey(prev => prev + 1)}
        disabled={submittedAnswerLocal || hasSubmittedToServer || amISpectator || connectionStatus !== 'connected'}
        style={{ backgroundColor: '#8B4513', borderColor: '#8B4513', color: 'white', minWidth: 120 }}
      >
        Clear Canvas
      </button>
      {/* Show ReviewNotification only if evaluated */}
      {(submittedAnswerLocal || hasSubmittedToServer) && socketService.getSocketId() && (
        <div style={{ minWidth: 180 }}>
          <ReviewNotification playerId={socketService.getSocketId()!} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <MusicControl />
      <div className="container py-4">
        <LoadingOverlay isVisible={isRoomLoading} />
        <ConnectionStatus showDetails={true} />
        {errorMsg && (
          <div className="alert alert-danger">{errorMsg}</div>
        )}
        {connectionStatus === 'disconnected' && (
          <div className="alert alert-warning">
            <strong>Disconnected from server.</strong> Attempting to reconnect...
          </div>
        )}
        <div className="row g-3">
          <div className="col-12 col-md-8">
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
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div style={{ flexGrow: 1, marginRight: '1rem' }}>
                    <QuestionCard
                      question={currentQuestion}
                      timeRemaining={timeRemaining}
                      onSubmit={handleAnswerSubmit}
                      submitted={submittedAnswerLocal || hasSubmittedToServer}
                    />
                  </div>
                  {timeLimit !== null && timeLimit < 99999 && (
                    <Timer isActive={isTimerRunning} showSeconds={true} />
                  )}
                </div>
                
                <DrawingBoard
                  key={canvasKey}
                  onUpdate={handleBoardUpdate}
                  disabled={submittedAnswerLocal || hasSubmittedToServer || amISpectator || connectionStatus !== 'connected'}
                  controls={renderDrawingBoardControls()}
                />
                
                <div className="input-group mb-3">
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Type your answer here..."
                    value={answer}
                    onChange={handleAnswerChange}
                    disabled={submittedAnswerLocal || hasSubmittedToServer || !gameStarted || !currentQuestion || amISpectator || connectionStatus !== 'connected'}
                  />
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => handleAnswerSubmit(answer)}
                    disabled={submittedAnswerLocal || hasSubmittedToServer || !gameStarted || !currentQuestion || amISpectator || connectionStatus !== 'connected'}
                  >
                    Submit Answer
                  </button>
                </div>
                
                {(submittedAnswerLocal || hasSubmittedToServer) && !currentQuestion?.answer && (
                  <div className="alert alert-info mt-3">
                    Your answer has been submitted. Waiting for the Game Master to evaluate it.
                  </div>
                )}
                {connectionStatus !== 'connected' && (
                  <div className="alert alert-warning mt-3">
                    You are currently disconnected. Your inputs are disabled until reconnection.
                  </div>
                )}
              </>
            )}
            <PreviewOverlayV2
              onFocus={() => {}}
              onClose={() => {}}
              isGameMaster={false}
            />
          </div>
          <div className="col-12 col-md-4">
            <RoomCode />
            <PlayerList title="Other Players" />
          </div>
        </div>
      </div>
    </>
  );
};

export default Player; 
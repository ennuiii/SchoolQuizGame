import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PreviewOverlay from '../components/shared/PreviewOverlay';
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
    toggleBoardVisibility,
    currentQuestionIndex,
    submittedAnswer,
    isGameConcluded,
    gameRecapData,
    recapSelectedRoundIndex,
    hideRecap
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
  } = useRoom();

  const { getCurrentCanvasSVG } = useCanvas();

  // Clear canvas and reset state when new question starts
  useEffect(() => {
    if (currentQuestion) {
      setSubmittedAnswerLocal(false);
      setCanvasKey(prev => prev + 1);
      setAnswer(''); // Clear text answer field on new question
    }
  }, [currentQuestion?.id, currentQuestionIndex]);

  // Effect for handling game state changes
  useEffect(() => {
    console.log('[Player] Game state changed:', {
      started: gameStarted,
      questionIndex: currentQuestionIndex,
      timeRemaining,
      contextSubmittedAnswer: submittedAnswer,
      localSubmissionLock: submittedAnswerLocal,
      gameRecapAvailable: !!gameRecapData,
      timestamp: new Date().toISOString()
    });
  }, [gameStarted, currentQuestionIndex, timeRemaining, submittedAnswer, submittedAnswerLocal, gameRecapData]);

  // Handle answer submission
  const handleAnswerSubmit = useCallback(async (textAnswer: string) => {
    const drawingBoardComponent = document.querySelector('.drawing-board canvas') as HTMLCanvasElement;
    // Check if fabric canvas exists and has objects, excluding a potential background image if any.
    const fabricCanvas = (drawingBoardComponent as any)?._fabricCanvas;
    const objects = fabricCanvas?.getObjects().filter((obj: any) => obj !== fabricCanvas.backgroundImage);
    const actualHasDrawing = objects?.length > 0;
    const finalHasDrawing = actualHasDrawing;

    if (!roomCode || !currentQuestion || submittedAnswerLocal) {
      console.error('[Player] Cannot submit answer:', {
        hasRoomCode: !!roomCode,
        hasQuestion: !!currentQuestion,
        alreadySubmitted: submittedAnswerLocal
      });
      return;
    }

    try {
      const finalAnswer = textAnswer.trim();
      if (!finalAnswer && !finalHasDrawing) {
        toast.error('Please enter an answer or submit a drawing');
        return;
      }
      
      let drawingData: string | null = null;
      if (finalHasDrawing) {
        drawingData = getCurrentCanvasSVG();
      }

      console.log('[Player] Submitting answer:', {
        roomCode,
        answerLength: finalAnswer.length,
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
  }, [roomCode, currentQuestion, submittedAnswerLocal, getCurrentCanvasSVG, toast]);

  // Handle board updates
  const handleBoardUpdate = async (boardData: BoardData) => {
    if (!roomCode) {
      console.error('[Player] Cannot update board - No room code found');
      return;
    }
    
    try {
      await socketService.updateBoard(roomCode, boardData.data);
    } catch (error) {
      console.error('[Player] Failed to update board:', error);
      toast.error('Failed to update drawing. Please try again.');
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
      !submittedAnswerLocal
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
    answer,
    handleAnswerSubmit,
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
      !submittedAnswerLocal
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
    answer,
    handleAnswerSubmit,
  ]);

  // Handle answer change
  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submittedAnswerLocal) return;
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

  if (!roomCode) {
    console.log('[Player] No room code found, redirecting to home');
    navigate('/');
    return null;
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
    return <PreviewOverlay onClose={() => socketService.stopPreviewMode(roomCode)} onFocus={(pid) => socketService.focusSubmission(roomCode, pid)} isGameMaster={false} />;
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
        // onRoundChange is not needed as isControllable is false
      />
    );
  }

  return (
    <div className="container py-4">
      <LoadingOverlay isVisible={isRoomLoading} />
      <ConnectionStatus />
      {errorMsg && (
        <div className="alert alert-danger">{errorMsg}</div>
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
                    submitted={submittedAnswerLocal}
                  />
                </div>
                {timeLimit !== null && timeLimit < 99999 && (
                  <Timer isActive={isTimerRunning} showSeconds={true} />
                )}
              </div>
              
              <DrawingBoard
                key={canvasKey}
                onUpdate={handleBoardUpdate}
                disabled={submittedAnswerLocal || amISpectator}
              />
              
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="Type your answer here..."
                  value={answer}
                  onChange={handleAnswerChange}
                  disabled={submittedAnswerLocal || !gameStarted || !currentQuestion || amISpectator}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => handleAnswerSubmit(answer)}
                  disabled={submittedAnswerLocal || !gameStarted || !currentQuestion || amISpectator}
                >
                  Submit Answer
                </button>
              </div>
              
              {submittedAnswerLocal && (
                <div className="alert alert-info">
                  Your answer has been submitted. Wait for the Game Master to evaluate it.
                </div>
              )}
            </>
          )}
          <PreviewOverlay
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
  );
};

export default Player; 
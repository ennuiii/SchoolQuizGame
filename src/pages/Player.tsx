import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import QuestionCard from '../components/shared/QuestionCard';
import Timer from '../components/shared/Timer';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import { useGame } from '../contexts/GameContext';
import { useAudio } from '../contexts/AudioContext';
import { useRoom } from '../contexts/RoomContext';
import DrawingBoard from '../components/player/DrawingBoard';
import RecapModal from '../components/shared/RecapModal';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import { ConnectionStatus } from '../components/shared/ConnectionStatus';

// Import Question and PlayerBoard types from GameContext
import type { Question, PlayerBoard } from '../contexts/GameContext';
import type { GameRecapData } from '../types/recap';

// TODO: Move BoardData to a shared types file if used elsewhere or becomes complex.
interface BoardData {
  data: string;
  timestamp: number;
}

const Player: React.FC = () => {
  const navigate = useNavigate();
  const [submittedAnswerLocal, setSubmittedAnswerLocal] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<GameRecapData | null>(null);
  const [answer, setAnswer] = useState('');
  
  // Get context values
  const {
    gameStarted,
    gameOver,
    isWinner,
    currentQuestion,
    timeLimit,
    timeRemaining,
    isTimerRunning,
    players,
    playerBoards,
    visibleBoards,
    allAnswersThisRound,
    evaluatedAnswers,
    previewMode,
    toggleBoardVisibility,
    currentQuestionIndex,
    submittedAnswer
  } = useGame();

  const {
    isMuted,
    volume,
    toggleMute,
    setVolume,
    playBackgroundMusic,
    pauseBackgroundMusic
  } = useAudio();

  const {
    roomCode,
    playerName,
    isSpectator: amISpectator,
    isLoading,
    errorMsg,
    setErrorMsg,
    leaveRoom
  } = useRoom();

  // Clear canvas and reset state when new question starts
  useEffect(() => {
    if (currentQuestion) {
      setSubmittedAnswerLocal(false);
      setCanvasKey(prev => prev + 1);
      setAnswer(''); // Clear text answer field on new question
    }
  }, [currentQuestion?.id]);

  // Effect for handling game state changes
  useEffect(() => {
    console.log('[Player] Game state changed:', {
      started: gameStarted,
      questionIndex: currentQuestionIndex,
      timeRemaining,
      contextSubmittedAnswer: submittedAnswer,
      localSubmissionLock: submittedAnswerLocal,
      timestamp: new Date().toISOString()
    });
  }, [gameStarted, currentQuestionIndex, timeRemaining, submittedAnswer, submittedAnswerLocal]);

  // Handle answer submission
  const handleAnswerSubmit = useCallback(async (textAnswer: string) => {
    const drawingBoardComponent = document.querySelector('.drawing-board canvas') as HTMLCanvasElement;
    const actualHasDrawing = drawingBoardComponent && (drawingBoardComponent as any)._fabricCanvas?.getObjects().length > 0;
    const finalHasDrawing = actualHasDrawing; // Always base on actual drawing content

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
      
      console.log('[Player] Submitting answer:', {
        roomCode,
        answerLength: finalAnswer.length,
        hasDrawing: finalHasDrawing,
        timestamp: new Date().toISOString()
      });

      await socketService.submitAnswer(roomCode, finalAnswer, finalHasDrawing);
      setSubmittedAnswerLocal(true);
      toast.success('Answer submitted!');
    } catch (error) {
      console.error('[Player] Failed to submit answer:', error);
      toast.error('Failed to submit answer. Please try again.');
    }
  }, [roomCode, currentQuestion, submittedAnswerLocal, toast]);

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

  // Handle game recap
  const handleGameRecap = (recap: GameRecapData) => {
    console.log('[Player] Received game recap:', recap);
    setRecapData(recap);
    setShowRecap(true);
  };

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (amISpectator) return; // Do nothing if spectator
    if (document.visibilityState === 'visible' && timeLimit !== null && timeRemaining !== null) {
      if (timeRemaining <= 0 && !submittedAnswerLocal && currentQuestion) {
        const drawingBoardComponent = document.querySelector('.drawing-board canvas') as HTMLCanvasElement;
        const actualHasDrawing = drawingBoardComponent && (drawingBoardComponent as any)._fabricCanvas?.getObjects().length > 0;
        if (actualHasDrawing && answer.trim() === '') {
             handleAnswerSubmit(''); // Submit empty text, drawing will be picked up by actualHasDrawing
        }
      }
    }
  }, [amISpectator, timeRemaining, timeLimit, currentQuestion, submittedAnswerLocal, answer, handleAnswerSubmit]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  }, [setVolume]);

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

  // Handle game start
  useEffect(() => {
    if (gameStarted) {
      // Show all boards by default
      toggleBoardVisibility(new Set(playerBoards.map((board: { playerId: string }) => board.playerId)));
    }
  }, [gameStarted, playerBoards, toggleBoardVisibility]);

  // Handle spectator mode
  useEffect(() => {
    if (amISpectator) {
      // Show all boards by default
      toggleBoardVisibility(new Set(playerBoards.map((board: { playerId: string }) => board.playerId)));
    }
  }, [amISpectator, playerBoards, toggleBoardVisibility]);

  useEffect(() => {
    // Listen for game recap
    socketService.on('game_recap', handleGameRecap);

    return () => {
      socketService.off('game_recap', handleGameRecap);
    };
  }, []);

  // Fix the board visibility handlers
  const handleShowAllBoards = () => {
    const nonSpectatorBoards = playerBoards.map((board: PlayerBoard) => board.playerId);
    toggleBoardVisibility(new Set(nonSpectatorBoards));
  };

  const handleHideAllBoards = () => {
    toggleBoardVisibility(new Set());
  };

  useEffect(() => {
    if (amISpectator) {
      toast.info("You are a spectator. Redirecting to spectator view.");
      navigate('/spectator');
    }
  }, [amISpectator, navigate]);

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

  if (!roomCode) {
    console.log('[Player] No room code found, redirecting to home');
    navigate('/');
    return null;
  }

  if (isLoading) return <LoadingOverlay isVisible={true} />;
  if (errorMsg) return <div className="alert alert-danger">{errorMsg}</div>;
  if (!roomCode || !playerName || amISpectator) {
    return (
      <div className="container text-center mt-5">
        <h2>Loading Player View...</h2>
        {amISpectator && <p>You are a spectator. You should be redirected shortly.</p>}
        {!roomCode || !playerName && <p>Missing room or player information.</p>}
        <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  if (previewMode.isActive) {
    return <PreviewOverlay onClose={() => socketService.stopPreviewMode(roomCode)} onFocus={(pid) => socketService.focusSubmission(roomCode, pid)} isGameMaster={false} />;
  }

  return (
    <div className="container py-4">
      <LoadingOverlay isVisible={isLoading} />
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
                <QuestionCard
                  question={currentQuestion}
                  timeRemaining={timeRemaining}
                  onSubmit={handleAnswerSubmit}
                  submitted={submittedAnswerLocal}
                />
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
      
      {showRecap && recapData && (
        <RecapModal
          show={showRecap}
          onHide={() => setShowRecap(false)}
          recap={recapData}
        />
      )}
    </div>
  );
};

export default Player; 
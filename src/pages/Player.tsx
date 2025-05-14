import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import QuestionCard from '../components/player/QuestionCard';
import Timer from '../components/shared/Timer';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import { useGame } from '../contexts/GameContext';
import { useAudio } from '../contexts/AudioContext';
import { useRoom } from '../contexts/RoomContext';
import DrawingBoard from '../components/player/DrawingBoard';
import RecapModal from '../components/shared/RecapModal';

const Player: React.FC = () => {
  const navigate = useNavigate();
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  const [gameRecap, setGameRecap] = useState(null);
  
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
    startPreviewMode,
    stopPreviewMode,
    focusSubmission
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
    isSpectator,
    isLoading,
    errorMsg,
    setErrorMsg,
    leaveRoom
  } = useRoom();

  // Clear canvas and reset state when new question starts
  useEffect(() => {
    if (currentQuestion) {
      setSubmittedAnswer(false);
      setCanvasKey(prev => prev + 1); // This will trigger canvas reinitialization
    }
  }, [currentQuestion]);

  // Handle answer submission
  const handleSubmitAnswer = useCallback((force = false) => {
    if (!currentQuestion || submittedAnswer) return;
  
    const answerInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    const text = answerInput?.value?.trim() || '';
    const canvas = document.querySelector('canvas');
    const hasDrawing = canvas && (canvas as any)._fabricCanvas?.getObjects().length > 0;
  
    // If not forced and no content, show error
    if (!force && !text && !hasDrawing) {
      setErrorMsg('Please enter an answer or draw something');
      return;
    }
  
    try {
      let finalAnswer = '';
      if (text) {
        finalAnswer = hasDrawing ? `${text} (with drawing)` : text;
      } else if (hasDrawing) {
        finalAnswer = 'Drawing submitted';
      } else if (force) {
        finalAnswer = ''; // Empty submission for forced/automatic submission
      }
    
      console.log('Submitting answer:', { roomCode, finalAnswer, hasDrawing });
      socketService.submitAnswer(roomCode, finalAnswer, hasDrawing || false);
      setSubmittedAnswer(true);
      setErrorMsg(force ? 'Answer submitted automatically' : 'Answer submitted!');
      
      // Clear the input after successful submission
      if (answerInput) {
        answerInput.value = '';
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      setErrorMsg('Failed to submit answer. Please try again.');
    }
  }, [currentQuestion, roomCode, submittedAnswer, setErrorMsg]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && timeLimit !== null && timeRemaining !== null) {
      if (timeRemaining <= 0 && !submittedAnswer && currentQuestion) {
        handleSubmitAnswer(true);
      }
    }
  }, [timeRemaining, timeLimit, currentQuestion, submittedAnswer, handleSubmitAnswer]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  }, [setVolume]);

  // Handle preview mode
  const handleClosePreviewMode = useCallback(() => {
    stopPreviewMode(roomCode);
  }, [roomCode, stopPreviewMode]);

  const handleFocusSubmission = useCallback((playerId: string) => {
    focusSubmission(roomCode, playerId);
  }, [roomCode, focusSubmission]);

  // Handle answer change
  const handleAnswerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (submittedAnswer) return; // Don't update if already submitted
    
    const socket = socketService.connect();
    if (socket) {
      (socket as any).currentAnswer = e.target.value;
    }
  }, [submittedAnswer]);

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
      toggleBoardVisibility(new Set(playerBoards.map(b => b.playerId)));
    }
  }, [gameStarted, playerBoards, toggleBoardVisibility]);

  // Handle spectator mode
  useEffect(() => {
    if (isSpectator) {
      // Show all boards by default
      toggleBoardVisibility(new Set(playerBoards.map(b => b.playerId)));
    }
  }, [isSpectator, playerBoards, toggleBoardVisibility]);

  useEffect(() => {
    // Listen for game recap
    socketService.on('game_recap', (recap) => {
      setGameRecap(recap);
      setShowRecap(true);
    });

    return () => {
      socketService.off('game_recap');
    };
  }, []);

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

  if (isSpectator) {
    return (
      <div className="container-fluid px-2 px-md-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
          <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
            <span className="bi bi-eye section-icon" aria-label="Spectator"></span>
            Spectator View
          </div>
        </div>
        <div className="row g-3">
          <div className="col-12 col-md-8">
            {currentQuestion && (
              <div className="card mb-4">
                <div className="card-body">
                  <h3>Current Question:</h3>
                  <p className="lead">{currentQuestion.text}</p>
                </div>
              </div>
            )}
            <div className="card mb-4">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Player Boards</h5>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => toggleBoardVisibility(new Set(playerBoards.map(b => b.playerId)))}>Show All</button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleBoardVisibility(new Set())}>Hide All</button>
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
                  {playerBoards.map(board => (
                    <PlayerBoardDisplay
                      key={board.playerId}
                      board={board}
                      isVisible={visibleBoards.has(board.playerId)}
                      onToggleVisibility={id => toggleBoardVisibility(id)}
                      transform={{ scale: 1, x: 0, y: 0 }}
                      onScale={(playerId, scale) => {}}
                      onPan={(playerId, dx, dy) => {}}
                      onReset={(playerId) => {}}
                    />
                  ))}
                </div>
              </div>
            </div>
            <PreviewOverlay
              onFocus={() => {}}
              onClose={() => {}}
              isGameMaster={false}
            />
          </div>
          <div className="col-12 col-md-4">
            <PlayerList title="Players" />
            <div className="d-grid gap-2 mt-3">
              <button
                className="btn btn-outline-secondary"
                onClick={() => navigate('/')}
              >
                Leave Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-person section-icon" aria-label="Player"></span>
          Player Dashboard
        </div>
        <div className="d-flex align-items-center gap-2">
          <input
            type="range"
            className="form-range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
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
      <div className="row g-3">
        <div className="col-12 col-md-8">
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6 d-flex flex-column gap-2 align-items-start">
              {/* Remove lives display from here */}
            </div>
            <div className="col-6 col-md-3">
              {/* Remove duplicate timer display */}
            </div>
          </div>
          
          {errorMsg && (
            <div id="flash-message" className="alert mb-4" role="alert">
              {errorMsg}
            </div>
          )}
          
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
              <QuestionCard />
              
              {timeLimit !== null && timeRemaining !== null && (
                <Timer
                  isActive={isTimerRunning}
                  showSeconds={true}
                />
              )}
              
              <DrawingBoard
                canvasKey={canvasKey}
                roomCode={roomCode}
                submittedAnswer={submittedAnswer}
                onBoardUpdate={(svgData) => {
                  if (roomCode && !submittedAnswer) {
                    socketService.updateBoard(roomCode, svgData);
                  }
                }}
              />
              
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="Type your answer here..."
                  onChange={handleAnswerChange}
                  disabled={submittedAnswer || !gameStarted || !currentQuestion}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => handleSubmitAnswer()}
                  disabled={submittedAnswer || !gameStarted || !currentQuestion}
                >
                  Submit Answer
                </button>
              </div>
              
              {submittedAnswer && (
                <div className="alert alert-info">
                  Your answer has been submitted. Wait for the Game Master to evaluate it.
                </div>
              )}
            </>
          )}
          <PreviewOverlay
            onFocus={handleFocusSubmission}
            onClose={handleClosePreviewMode}
            isGameMaster={false}
          />
        </div>
        <div className="col-12 col-md-4">
          <RoomCode />
          <PlayerList title="Players" />
        </div>
      </div>
      
      <RecapModal
        show={showRecap}
        onHide={() => setShowRecap(false)}
        recap={gameRecap}
      />
    </div>
  );
};

export default Player; 
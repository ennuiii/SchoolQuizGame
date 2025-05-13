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

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [boardTransforms, setBoardTransforms] = useState<{[playerId: string]: {scale: number, x: number, y: number}}>({});
  
  // Get context values
  const {
    gameStarted,
    currentQuestion,
    players,
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
    timeLimit,
    timeRemaining,
    isTimerRunning,
    questionErrorMsg
  } = useGame();

  const {
    roomCode,
    createRoom,
    leaveRoom
  } = useRoom();

  const {
    isMuted,
    toggleMute,
    setVolume,
    volume
  } = useAudio();

  // Create a room if one doesn't exist
  useEffect(() => {
    if (!roomCode) {
      const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      createRoom(newRoomCode);
    }
  }, [roomCode, createRoom]);

  const handleStartGame = useCallback(() => {
    if (!roomCode || questions.length === 0) return;
    startGame(roomCode, questions, 30);
  }, [roomCode, questions, startGame]);

  const handleNextQuestion = useCallback(() => {
    if (!roomCode) return;
    nextQuestion(roomCode);
  }, [roomCode, nextQuestion]);

  const handleEvaluateAnswer = useCallback((playerId: string, isCorrect: boolean) => {
    if (!roomCode) return;
    evaluateAnswer(roomCode, playerId, isCorrect);
  }, [roomCode, evaluateAnswer]);

  const handleRestartGame = useCallback(() => {
    if (!roomCode) return;
    restartGame(roomCode);
  }, [roomCode, restartGame]);

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

  const handleStartPreviewMode = useCallback(() => {
    if (!roomCode) return;
    startPreviewMode(roomCode);
  }, [roomCode, startPreviewMode]);

  const handleStopPreviewMode = useCallback(() => {
    if (!roomCode) return;
    stopPreviewMode(roomCode);
  }, [roomCode, stopPreviewMode]);

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
          <RoomCode />
          {questionErrorMsg && (
            <div className="alert alert-danger mb-3" role="alert">
              {questionErrorMsg}
            </div>
          )}
          {!previewMode.isActive && (
            <div className="mb-3">
              <button
                className="btn btn-primary w-100"
                onClick={handleStartPreviewMode}
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
                disabled={questions.length === 0 || players.filter(p => !p.isSpectator).length < 2}
                title={players.filter(p => !p.isSpectator).length < 2 ? "Need at least 2 active players to start" : ""}
              >
                Start Game
              </button>
            )}
            {gameStarted && (
              <>
                <button className="btn btn-primary" onClick={handleNextQuestion}>Next Question</button>
                <button className="btn btn-warning" onClick={handleEndRoundEarly}>End Round Early</button>
                <button className="btn btn-danger" onClick={handleRestartGame}>Restart Game</button>
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
                onClose={handleStopPreviewMode}
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
            onClick={handleStopPreviewMode}
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
    </div>
  );
};

export default GameMaster; 
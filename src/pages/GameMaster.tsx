import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import QuestionSelector from '../components/game-master/QuestionSelector';
import QuestionDisplay from '../components/game-master/QuestionDisplay';
import { useGame } from '../contexts/GameContext';
import { useRoom } from '../contexts/RoomContext';
import { useAudio } from '../contexts/AudioContext';

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  
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
    focusSubmission
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
    if (!roomCode) return;
    endRoundEarly(roomCode);
  }, [roomCode, endRoundEarly]);

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

  const showAllBoards = useCallback(() => {
    toggleBoardVisibility(new Set(playerBoards.filter(b => {
      const player = players.find(p => p.id === b.playerId);
      return player && !player.isSpectator;
    }).map(b => b.playerId)));
  }, [playerBoards, players, toggleBoardVisibility]);

  const hideAllBoards = useCallback(() => {
    toggleBoardVisibility(new Set());
  }, [toggleBoardVisibility]);

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-controller section-icon" aria-label="Game Master"></span>
          Game Master View
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <PlayerList title="Players" />
          <div className="d-grid gap-2 mt-3">
            <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>Leave Game</button>
            {!gameStarted && (
              <button 
                className="btn btn-success" 
                onClick={handleStartGame}
                disabled={questions.length === 0}
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
                onFocus={handleFocusSubmission}
                onClose={handleStopPreviewMode}
                isGameMaster={true}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameMaster; 
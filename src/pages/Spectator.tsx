import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import { useGame } from '../contexts/GameContext';
import { useRoom } from '../contexts/RoomContext';

const Spectator: React.FC = () => {
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
    toggleBoardVisibility
  } = useGame();

  const {
    roomCode,
    playerName,
    leaveRoom
  } = useRoom();

  const handleJoinAsPlayer = useCallback(() => {
    if (!roomCode || !playerName) return;
    sessionStorage.setItem('isSpectator', 'false');
    socketService.switchToPlayer(roomCode, playerName);
    navigate('/player');
  }, [roomCode, playerName, navigate]);

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
          <span className="bi bi-eye section-icon" aria-label="Spectator"></span>
          Spectator View
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <PlayerList players={players} title="Players" />
          <div className="d-grid gap-2 mt-3">
            <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>Leave Game</button>
            <button
              className="btn btn-success"
              onClick={handleJoinAsPlayer}
              disabled={gameStarted}
              title={gameStarted ? "You can only join as a player when a round is not in progress." : ""}
            >
              Join as Player
            </button>
            {gameStarted && (
              <div className="text-muted small mt-1">
                You can only join as a player when a round is not in progress.
              </div>
            )}
          </div>
        </div>
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
            players={players}
            playerBoards={playerBoards}
            allAnswersThisRound={allAnswersThisRound}
            evaluatedAnswers={evaluatedAnswers}
            previewMode={previewMode}
            onFocus={() => {}}
            onClose={() => {}}
            isGameMaster={false}
          />
        </div>
      </div>
    </div>
  );
};

export default Spectator; 
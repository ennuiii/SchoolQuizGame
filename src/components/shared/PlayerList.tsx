import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useRoom } from '../../contexts/RoomContext';

interface PlayerListProps {
  currentPlayerPersistentId?: string;
  onPlayerSelect?: (persistentPlayerId: string) => void;
  selectedPlayerPersistentId?: string;
  title?: string;
  onKickPlayer?: (persistentPlayerId: string) => void;
  isGameMasterView?: boolean;
}

const PlayerList: React.FC<PlayerListProps> = ({
  currentPlayerPersistentId: propCurrentPlayerPersistentId,
  onPlayerSelect,
  selectedPlayerPersistentId,
  title = "Players",
  onKickPlayer,
  isGameMasterView = false
}) => {
  const { players } = useGame();
  const { persistentPlayerId: contextCurrentPlayerPersistentId, isGameMaster } = useRoom();
  
  const actualCurrentPlayerPersistentId = propCurrentPlayerPersistentId || contextCurrentPlayerPersistentId;

  return (
    <div className="card mb-3 player-list-card">
      <div className="card-header bg-light">
        <h6 className="mb-0">{title}</h6>
      </div>
      <div className="card-body p-0">
        <div className="list-group list-group-flush player-list">
          {players.length === 0 ? (
            <div className="list-group-item text-center text-muted py-3">
              No players yet
            </div>
          ) : (
            players.map(player => (
              <div
                key={player.persistentPlayerId}
                className={`list-group-item d-flex justify-content-between align-items-center ${
                  player.persistentPlayerId === actualCurrentPlayerPersistentId ? 'bg-highlight' : ''
                } ${selectedPlayerPersistentId === player.persistentPlayerId ? 'active' : ''}`}
                onClick={() => onPlayerSelect?.(player.persistentPlayerId)}
                style={{
                  cursor: onPlayerSelect ? 'pointer' : 'default',
                  opacity: player.isActive ? 1 : 0.6,
                  transition: 'opacity 0.3s ease',
                }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2 player-name">{player.name}</span>
                  {player.persistentPlayerId === actualCurrentPlayerPersistentId && !isGameMasterView && (
                    <span className="badge bg-primary rounded-pill ms-1">You</span>
                  )}
                  {player.isSpectator && (
                    <span className="badge bg-secondary rounded-pill ms-1">Spectator</span>
                  )}
                  {!player.isActive && (
                    <span className="badge bg-warning text-dark rounded-pill ms-1">Disconnected</span>
                  )}
                </div>
                
                <div className="d-flex align-items-center">
                  {!player.isSpectator && player.isActive && (
                    <div className="lives-display me-2">
                      {[...Array(player.lives)].map((_, i) => (
                        <span key={i} className="life" role="img" aria-label="heart">❤</span>
                      ))}
                    </div>
                  )}
                  {isGameMasterView && isGameMaster && player.persistentPlayerId !== contextCurrentPlayerPersistentId && onKickPlayer && (
                    <button 
                      className="btn btn-danger btn-sm p-1 ms-2 kick-button"
                      onClick={(e) => { 
                        e.stopPropagation();
                        onKickPlayer(player.persistentPlayerId);
                      }}
                      disabled={!player.isActive}
                      title={`Kick ${player.name}`}
                    >
                      <i className="bi bi-person-dash-fill"></i>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerList; 
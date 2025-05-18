import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useRoom } from '../../contexts/RoomContext';

interface Player {
  id: string;
  persistentPlayerId: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator?: boolean;
}

interface PlayerListProps {
  persistentPlayerId?: string;
  onPlayerSelect?: (playerId: string) => void;
  selectedPlayerId?: string;
  title?: string;
  onKickPlayer?: (playerId: string) => void;
  isGameMasterView?: boolean;
}

const PlayerList: React.FC<PlayerListProps> = ({
  persistentPlayerId: propPersistentPlayerId,
  onPlayerSelect,
  selectedPlayerId,
  title = "Players",
  onKickPlayer,
  isGameMasterView = false
}) => {
  const { players } = useGame();
  const { persistentPlayerId: contextPersistentPlayerId } = useRoom();
  const actualPersistentPlayerId = propPersistentPlayerId || contextPersistentPlayerId;

  return (
    <div className="card mb-3">
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
                  player.persistentPlayerId === actualPersistentPlayerId ? 'bg-highlight' : ''
                } ${selectedPlayerId === player.persistentPlayerId ? 'active' : ''}`}
                onClick={() => onPlayerSelect?.(player.persistentPlayerId)}
                style={{ cursor: onPlayerSelect ? 'pointer' : 'default' }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2">{player.name}</span>
                  {player.persistentPlayerId === actualPersistentPlayerId && !isGameMasterView && (
                    <span className="badge bg-primary rounded-pill ms-1">You</span>
                  )}
                  {player.isSpectator && (
                    <span className="badge bg-secondary rounded-pill ms-1">Spectator</span>
                  )}
                  {!player.isActive && (
                    <span className="badge bg-warning rounded-pill ms-1">Disconnected</span>
                  )}
                </div>
                
                <div className="d-flex align-items-center">
                  {!player.isSpectator && (
                    <div className="lives-display me-2">
                      {[...Array(player.lives)].map((_, i) => (
                        <span key={i} className="life" role="img" aria-label="heart">❤</span>
                      ))}
                    </div>
                  )}
                  {isGameMasterView && player.persistentPlayerId !== actualPersistentPlayerId && onKickPlayer && (
                    <button 
                      className="btn btn-danger btn-sm p-1 ms-2" 
                      onClick={(e) => { 
                        e.stopPropagation();
                        onKickPlayer(player.persistentPlayerId); 
                      }}
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
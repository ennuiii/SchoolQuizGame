import React from 'react';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
}

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  onPlayerSelect?: (playerId: string) => void;
  selectedPlayerId?: string | null;
  title?: string;
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players, 
  currentPlayerId,
  onPlayerSelect,
  selectedPlayerId,
  title = 'Players'
}) => {
  // Filter out the current player if currentPlayerId is provided
  const displayPlayers = currentPlayerId 
    ? players.filter(player => player.id !== currentPlayerId)
    : players;

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">{title} ({displayPlayers.length})</h6>
      </div>
      <div className="card-body">
        {displayPlayers.length === 0 ? (
          <p className="text-center text-muted">No players in the room</p>
        ) : (
          <div className="list-group">
            {displayPlayers.map((player) => (
              <div
                key={player.id}
                className={`list-group-item d-flex justify-content-between align-items-center ${
                  onPlayerSelect ? 'list-group-item-action' : ''
                } ${selectedPlayerId === player.id ? 'active' : ''}`}
                onClick={() => onPlayerSelect?.(player.id)}
                style={{ cursor: onPlayerSelect ? 'pointer' : 'default' }}
              >
                <div>
                  <span className="fw-bold">{player.name}</span>
                  <div className="small">
                    Lives: {[...Array(player.lives)].map((_, i) => (
                      <span key={i} role="img" aria-label="heart">❤</span>
                    ))}
                  </div>
                </div>
                <span className={`badge ${player.isActive ? 'bg-success' : 'bg-secondary'}`}>
                  {player.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerList; 
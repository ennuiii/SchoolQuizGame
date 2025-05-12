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
  onPlayerSelect?: (playerId: string) => void;
  selectedPlayerId: string | null;
}

const PlayerList: React.FC<PlayerListProps> = ({ players, onPlayerSelect, selectedPlayerId }) => {
  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Players ({players.length})</h6>
      </div>
      <div className="card-body">
        {players.length === 0 ? (
          <p className="text-center text-muted">No players connected yet</p>
        ) : (
          <div className="list-group">
            {players.map((player) => (
              <div
                key={player.id}
                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                  selectedPlayerId === player.id ? 'active' : ''
                }`}
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
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
  title = "Players"
}) => {
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
                key={player.id}
                className={`list-group-item d-flex justify-content-between align-items-center ${
                  player.id === currentPlayerId ? 'bg-light' : ''
                } ${selectedPlayerId === player.id ? 'active' : ''}`}
                onClick={() => onPlayerSelect?.(player.id)}
                style={{ cursor: onPlayerSelect ? 'pointer' : 'default' }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2">{player.name}</span>
                  {player.id === currentPlayerId && (
                    <span className="badge bg-primary rounded-pill">You</span>
                  )}
                </div>
                <div className="lives-display">
                  {[...Array(player.lives)].map((_, i) => (
                    <span key={i} className="life" role="img" aria-label="heart">❤</span>
                  ))}
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
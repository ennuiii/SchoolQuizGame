import React from 'react';
import { PlayerListProps } from '../../types/game';

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  onPlayerClick,
  selectedPlayerId
}) => {
  return (
    <div className="player-list">
      <h3>Players</h3>
      <div className="player-list-content">
        {players.map(player => (
          <div
            key={player.id}
            className={`player-item ${selectedPlayerId === player.id ? 'selected' : ''}`}
            onClick={() => onPlayerClick(player.id)}
          >
            <span className="player-name">{player.name}</span>
            <div className="player-status">
              <span className="lives">
                {Array.from({ length: player.lives }, (_, i) => (
                  <span key={i} className="heart">❤</span>
                ))}
              </span>
              {player.isSpectator && <span className="spectator-badge">Spectator</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerList; 
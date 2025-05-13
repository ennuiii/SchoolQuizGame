import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useRoom } from '../../contexts/RoomContext';
import { useAudio } from '../../contexts/AudioContext';

interface PlayerHeaderProps {
  playerName: string;
  lives: number;
}

const PlayerHeader: React.FC<PlayerHeaderProps> = ({ playerName, lives }) => {
  const { timeLimit, timeRemaining } = useGame();
  const { roomCode } = useRoom();
  const { volume, isMuted, setVolume, toggleMute } = useAudio();

  return (
    <div className="row mb-4">
      <div className="col-md-6">
        <h1>Player: {playerName}</h1>
        <div className="mb-3">Room Code: <strong>{roomCode}</strong></div>
      </div>
      <div className="col-md-3">
        {timeLimit !== null && timeRemaining !== null && timeLimit < 99999 && (
          <div className={`timer-display ${timeRemaining <= 10 ? 'text-danger' : ''}`}>
            <h3>
              <span className="me-2">Time:</span>
              <span>{timeRemaining}</span>
              <span className="ms-1">sec</span>
            </h3>
          </div>
        )}
      </div>
      <div className="col-md-3 text-end">
        <div className="lives-display">
          <span className="me-2">Lives:</span>
          {[...Array(lives)].map((_, i) => (
            <span key={i} className="life" role="img" aria-label="heart">❤</span>
          ))}
        </div>
      </div>
      <div className="d-flex justify-content-end align-items-center gap-2">
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
  );
};

export default PlayerHeader; 
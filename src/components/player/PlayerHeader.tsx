import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useRoom } from '../../contexts/RoomContext';
import { useAudio } from '../../contexts/AudioContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface PlayerHeaderProps {
  playerName: string;
  lives: number;
}

const PlayerHeader: React.FC<PlayerHeaderProps> = ({ playerName, lives }) => {
  const { timeLimit, timeRemaining } = useGame();
  const { roomCode } = useRoom();
  const { volume, isMuted, setVolume, toggleMute } = useAudio();
  const { language } = useLanguage();

  return (
    <div className="row mb-4">
      <div className="col-md-6">
        <h1>{t('playerHeader.player', language)}: {playerName}</h1>
        <div className="mb-3">{t('playerHeader.roomCode', language)}: <strong>{roomCode}</strong></div>
      </div>
      <div className="col-md-3">
        <div className="lives-display">
          <span className="me-2">{t('playerHeader.lives', language)}:</span>
          {[...Array(lives)].map((_, i) => (
            <span key={i} className="life" role="img" aria-label="heart">❤</span>
          ))}
        </div>
      </div>
      <div className="col-md-3 text-end">
        <div className="d-flex justify-content-end align-items-center gap-2">
          <input
            type="range"
            className="form-control-range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: '100px' }}
            title={t('playerHeader.volume', language)}
          />
          <button
            className="btn btn-outline-secondary"
            onClick={toggleMute}
            title={isMuted ? t('playerHeader.unmute', language) : t('playerHeader.mute', language)}
          >
            {isMuted ? (
              <i className="bi bi-volume-mute-fill"></i>
            ) : (
              <i className="bi bi-volume-up-fill"></i>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerHeader; 
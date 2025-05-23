import React from 'react';
import { useAudio } from '../../contexts/AudioContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

const MusicControl: React.FC = () => {
  const { isMuted, volume, toggleMute, setVolume } = useAudio();
  const { language } = useLanguage();

  const handleToggleMute = async () => {
    try {
      toggleMute();
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setVolume(parseFloat(e.target.value));
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  };

  return (
    <div
      className="music-control d-flex align-items-center gap-2"
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 2000,
        background: 'rgba(255,255,255,0.85)',
        borderRadius: 16,
        boxShadow: '0 2px 8px #0002',
        padding: '6px 14px',
        minWidth: 90
      }}
    >
      <button
        className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
        style={{ minWidth: 36, minHeight: 36, borderRadius: '50%' }}
        onClick={handleToggleMute}
        title={isMuted ? t('unmuteMusic', language) : t('muteMusic', language)}
      >
        {isMuted ? (
          <i className="bi bi-volume-mute-fill" style={{ fontSize: 20 }}></i>
        ) : (
          <i className="bi bi-volume-up-fill" style={{ fontSize: 20 }}></i>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={handleVolumeChange}
        style={{ width: 70 }}
        aria-label={t('musicVolume', language)}
        disabled={isMuted}
      />
    </div>
  );
};

export default MusicControl; 
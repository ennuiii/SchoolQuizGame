import React, { useState } from 'react';
import { useAudio } from '../../contexts/AudioContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

const languageOptions = [
  { code: 'en', labelKey: 'english' },
  { code: 'de', labelKey: 'german' },
  { code: 'fr', labelKey: 'french' },
  { code: 'nl', labelKey: 'dutch' },
  { code: 'pl', labelKey: 'polish' },
  { code: 'zh', labelKey: 'chinese' },
];

const SettingsControl: React.FC = () => {
  const { isMuted, volume, toggleMute, setVolume } = useAudio();
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleToggleMute = async () => {
    try {
      if (volume === 0) {
        setVolume(0.5); // Restore to default
      } else {
        setVolume(0); // Mute
      }
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
    <div className="settings-control" style={{ position: 'relative' }}>
      <button
        className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          zIndex: 2000,
          minWidth: 36,
          minHeight: 36,
          borderRadius: '50%',
          background: 'var(--panel-bg)',
          boxShadow: 'var(--button-shadow)',
          color: 'var(--text-color)',
          border: '2px solid var(--border-color)',
        }}
        onClick={() => setIsOpen(!isOpen)}
        title={t('settings', language)}
      >
        <i className="bi bi-gear-fill" style={{ fontSize: 20 }}></i>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            right: 18,
            zIndex: 2000,
            background: '#fef9c3',
            border: '1px dashed #e5d78c',
            borderRadius: '10px',
            width: '320px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <h5 style={{ marginBottom: '20px', color: '#5c4f2a', fontWeight: 600 }}>
            {t('settings', language)}
          </h5>
          
          {/* Audio controls */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5c4f2a', fontWeight: 500 }}>
              <i className="bi bi-volume-up-fill"></i>
              {t('audio', language)}
            </label>
            <div className="d-flex align-items-center gap-2 mb-2">
              <button
                className="btn btn-sm"
                style={{
                  minWidth: 40,
                  minHeight: 40,
                  borderRadius: '50%',
                  background: volume === 0 ? '#57c4b8' : '#57c4b8',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
                onClick={handleToggleMute}
                title={volume === 0 ? t('unmuteMusic', language) : t('muteMusic', language)}
              >
                {volume === 0 ? (
                  <i className="bi bi-volume-mute-fill" style={{ fontSize: 20 }}></i>
                ) : (
                  <i className="bi bi-volume-up-fill" style={{ fontSize: 20 }}></i>
                )}
              </button>
            </div>
            <input
              type="range"
              className="form-range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              style={{ width: '100%' }}
              aria-label={t('musicVolume', language)}
            />
          </div>

          {/* Language selection */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5c4f2a', fontWeight: 500 }}>
              <i className="bi bi-translate"></i>
              {t('language', language)}
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                marginTop: '10px',
              }}
            >
              {languageOptions.map(opt => (
                <button
                  key={opt.code}
                  className="btn"
                  onClick={() => setLanguage(opt.code)}
                  aria-pressed={language === opt.code}
                  style={{
                    padding: '8px 12px',
                    background: language === opt.code ? '#57c4b8' : '#fffadb',
                    color: language === opt.code ? '#fff' : '#5c4f2a',
                    border: '1px solid #e5d78c',
                    borderRadius: '8px',
                    fontWeight: language === opt.code ? '600' : '400',
                    textAlign: 'center',
                    boxShadow: language === opt.code ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {t(opt.labelKey, language)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsControl; 
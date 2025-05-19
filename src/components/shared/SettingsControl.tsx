import React, { useState } from 'react';
import { useAudio } from '../../contexts/AudioContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  const { theme, toggleTheme } = useTheme();
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
          background: 'var(--settings-button-bg)',
          boxShadow: 'var(--settings-button-shadow)',
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
          className="settings-panel"
          style={{
            position: 'fixed',
            top: 70,
            right: 18,
            zIndex: 2000,
            background: 'var(--panel-bg)',
            borderRadius: 16,
            boxShadow: 'var(--panel-shadow)',
            padding: '20px 18px 18px 18px',
            minWidth: 220,
            border: '2px solid var(--accent-color)',
            color: 'var(--text-color)',
          }}
        >
          <h6 className="mb-3" style={{ color: 'var(--heading-color)', fontWeight: 700, letterSpacing: 0.5 }}>
            {t('settings', language)}
          </h6>
          
          <div className="mb-3">
            <label className="form-label d-flex align-items-center gap-2" style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              <i className="bi bi-palette-fill"></i>
              {t('theme', language)}
            </label>
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
                style={{
                  minWidth: 36,
                  minHeight: 36,
                  borderRadius: '50%',
                  background: theme === 'light' ? 'var(--accent-color)' : 'var(--button-bg)',
                  color: 'var(--text-color)',
                  border: '2px solid var(--border-color)',
                  boxShadow: 'var(--button-shadow)',
                }}
                onClick={toggleTheme}
                title={theme === 'light' ? t('darkMode', language) : t('lightMode', language)}
              >
                {theme === 'light' ? (
                  <i className="bi bi-moon-fill" style={{ fontSize: 20 }}></i>
                ) : (
                  <i className="bi bi-sun-fill" style={{ fontSize: 20 }}></i>
                )}
              </button>
              <span style={{ color: 'var(--text-color)' }}>
                {theme === 'light' ? t('lightMode', language) : t('darkMode', language)}
              </span>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label d-flex align-items-center gap-2" style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              <i className="bi bi-volume-up-fill"></i>
              {t('audio', language)}
            </label>
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
                style={{
                  minWidth: 36,
                  minHeight: 36,
                  borderRadius: '50%',
                  background: volume === 0 ? 'var(--accent-color)' : 'var(--button-bg)',
                  color: 'var(--text-color)',
                  border: '2px solid var(--border-color)',
                  boxShadow: 'var(--button-shadow)',
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
              <input
                type="range"
                className="form-range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
                style={{ flex: 1 }}
                aria-label={t('musicVolume', language)}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label d-flex align-items-center gap-2" style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              <i className="bi bi-translate"></i>
              {t('language', language)}
            </label>
            <div
              className="d-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 8,
                marginTop: 4,
                marginBottom: 4,
                gridAutoRows: '1fr',
                maxWidth: 260,
                minWidth: 220,
              }}
            >
              {languageOptions.map(opt => (
                <button
                  key={opt.code}
                  className={`btn btn-sm ${language === opt.code ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setLanguage(opt.code)}
                  aria-pressed={language === opt.code}
                  style={{
                    minWidth: 100,
                    background: language === opt.code ? 'var(--accent-color)' : 'var(--button-bg)',
                    color: 'var(--text-color)',
                    border: '2px solid var(--border-color)',
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
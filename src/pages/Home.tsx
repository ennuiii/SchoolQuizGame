import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsControl from '../components/shared/SettingsControl';
import { useAudio } from '../contexts/AudioContext';
import socketService from '../services/socketService';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from '../contexts/LanguageContext';
import { t, howToPlayList_en, howToPlayList_de } from '../i18n';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { playBackgroundMusic } = useAudio();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    playBackgroundMusic();
  }, [playBackgroundMusic]);

  const handleResetConnection = async () => {
    // Start by clearing persistent player ID
    socketService.clearPersistentPlayerId();
    
    // Generate a new ID
    const newPlayerId = `P-${uuidv4()}`;
    localStorage.setItem('persistentPlayerId', newPlayerId);
    
    // Use the new force reconnect method for a clean connection reset
    try {
      await socketService.forceReconnect();
      console.log(`[Home.tsx] Connection reset. New persistentPlayerId generated: ${newPlayerId}`);
      toast.success(t('home.resetConnectionMsg', language));
    } catch (error) {
      console.error("[Home.tsx] Error resetting connection:", error);
      toast.error(t('home.connectionResetError', language) || "Failed to reset connection. Please refresh the page.");
    }
  };

  // Use the correct howToPlayList array based on language
  const howToPlayList = language === 'de' ? howToPlayList_de : howToPlayList_en;

  return (
    <>
      <SettingsControl />
      <div className="home-container d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="card p-4 text-center" style={{ maxWidth: 500, width: '100%' }}>
          <h1 className="home-title mb-2 d-flex align-items-center justify-content-center gap-2">
            <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
            {t('home.title', language)}
          </h1>
          <p className="home-subtitle mb-4 d-flex align-items-center justify-content-center gap-2">
            <span className="bi bi-stars section-icon" aria-label="Stars"></span>
            {t('home.subtitle', language)}
          </p>
          <div className="card mb-4 p-3" style={{ background: '#ffe066', color: '#2d4739', border: '2px dashed #ffd166' }}>
            <h2 className="mb-3 d-flex align-items-center gap-2">
              <span className="bi bi-lightbulb section-icon" aria-label="How to Play"></span>
              {t('home.howToPlay', language)}
            </h2>
            <ul className="text-start" style={{ fontSize: '1.1rem' }}>
              {howToPlayList.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="home-buttons d-flex flex-column flex-md-row gap-3 justify-content-center mt-3">
            <button 
              className="btn btn-primary btn-lg d-flex align-items-center gap-2"
              onClick={() => navigate('/gamemaster')}
            >
              <span className="bi bi-person-gear"></span>
              {t('home.beGamemaster', language)}
            </button>
            <button 
              className="btn btn-success btn-lg d-flex align-items-center gap-2"
              onClick={() => navigate('/join')}
            >
              <span className="bi bi-emoji-smile"></span>
              {t('home.joinAsPlayer', language)}
            </button>
          </div>
          <div className="mt-5">
            <button 
              className="btn btn-link text-muted"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? t('home.hideAdvanced', language) : t('home.showAdvanced', language)}
            </button>
            {showAdvanced && (
              <div className="card p-3 mt-2 border-danger">
                <h6 className="mb-3">{t('home.advancedOptions', language)}</h6>
                <button 
                  className="btn btn-outline-danger"
                  onClick={handleResetConnection}
                >
                  <span className="bi bi-arrow-repeat me-2"></span>
                  {t('home.resetConnection', language)}
                </button>
                <small className="d-block mt-2 text-muted">
                  {t('home.resetConnectionHelp', language)}
                </small>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Home; 
import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';

interface GamemodesTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Gamemodes tab for configuring different game modes and variants
 */
const GamemodesTab: React.FC<GamemodesTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {

  return (
    <div className="gamemode-settings">
      <div className="row mb-4">
        <div className="col-12">
          <div className="text-center mb-4">
            <h3 className="fw-bold text-primary mb-2">
              <i className="bi bi-joystick me-2"></i>
              {t('gameSettings.tabs.gamemodes', language)}
            </h3>
            <p className="text-muted lead">
              {t('gameSettings.gamemodes.description', language)}
            </p>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Points Mode */}
        <div className="col-xl-3 col-lg-6 col-md-6 mb-4">
          <div className={`card h-100 border-0 shadow-sm position-relative overflow-hidden ${settings.isPointsMode ? 'border-success shadow-lg' : ''}`}>
            {settings.isPointsMode && (
              <div className="position-absolute top-0 end-0 p-2">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '1.2rem' }}></i>
              </div>
            )}
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <div 
                  className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: settings.isPointsMode 
                      ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' 
                      : 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
                    fontSize: '2rem'
                  }}
                >
                  🏆
                </div>
                <h5 className="card-title fw-bold mb-2">
                  {t('gameSettings.gamemodes.pointsMode', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch d-flex justify-content-center mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="pointsModeSwitch"
                  checked={settings.isPointsMode}
                  onChange={(e) => onSettingsChange({ isPointsMode: e.target.checked })}
                  style={{ transform: 'scale(1.2)' }}
                />
                <label className="form-check-label ms-2 fw-semibold" htmlFor="pointsModeSwitch">
                  {t('gameSettings.gamemodes.enablePointsMode', language)}
                </label>
              </div>
              
              <p className="card-text text-center text-muted small">
                {t('gameSettings.gamemodes.pointsModeDesc', language)}
              </p>
            </div>
          </div>
        </div>

        {/* Community Voting Mode */}
        <div className="col-xl-3 col-lg-6 col-md-6 mb-4">
          <div className={`card h-100 border-0 shadow-sm position-relative overflow-hidden ${settings.isCommunityVotingMode ? 'border-info shadow-lg' : ''}`}>
            {settings.isCommunityVotingMode && (
              <div className="position-absolute top-0 end-0 p-2">
                <i className="bi bi-check-circle-fill text-info" style={{ fontSize: '1.2rem' }}></i>
              </div>
            )}
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <div 
                  className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: settings.isCommunityVotingMode 
                      ? 'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)' 
                      : 'linear-gradient(135deg, #6610f2 0%, #e83e8c 100%)',
                    fontSize: '2rem'
                  }}
                >
                  🗳️
                </div>
                <h5 className="card-title fw-bold mb-2">
                  {t('gameSettings.gamemodes.communityVoting', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch d-flex justify-content-center mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="communityVotingSwitch"
                  checked={settings.isCommunityVotingMode}
                  onChange={(e) => onSettingsChange({ isCommunityVotingMode: e.target.checked })}
                  style={{ transform: 'scale(1.2)' }}
                />
                <label className="form-check-label ms-2 fw-semibold" htmlFor="communityVotingSwitch">
                  {t('gameSettings.gamemodes.enableCommunityVoting', language)}
                </label>
              </div>
              
              <p className="card-text text-center text-muted small">
                {t('gameSettings.gamemodes.communityVotingDesc', language)}
              </p>
            </div>
          </div>
        </div>

        {/* Streamer Mode */}
        <div className="col-xl-3 col-lg-6 col-md-6 mb-4">
          <div className={`card h-100 border-0 shadow-sm position-relative overflow-hidden ${settings.isStreamerMode ? 'border-warning shadow-lg' : ''}`}>
            {settings.isStreamerMode && (
              <div className="position-absolute top-0 end-0 p-2">
                <i className="bi bi-check-circle-fill text-warning" style={{ fontSize: '1.2rem' }}></i>
              </div>
            )}
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <div 
                  className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: settings.isStreamerMode 
                      ? 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)' 
                      : 'linear-gradient(135deg, #dc3545 0%, #6610f2 100%)',
                    fontSize: '2rem'
                  }}
                >
                  📺
                </div>
                <h5 className="card-title fw-bold mb-2">
                  {t('gameSettings.gamemodes.streamerMode', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch d-flex justify-content-center mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="streamerModeSwitch"
                  checked={settings.isStreamerMode}
                  onChange={(e) => onSettingsChange({ isStreamerMode: e.target.checked })}
                  style={{ transform: 'scale(1.2)' }}
                />
                <label className="form-check-label ms-2 fw-semibold" htmlFor="streamerModeSwitch">
                  {t('gameSettings.gamemodes.enableStreamerMode', language)}
                </label>
              </div>
              
              <p className="card-text text-center text-muted small">
                {t('gameSettings.gamemodes.streamerModeDesc', language)}
              </p>
            </div>
          </div>
        </div>

        {/* Game Mode Combinations Status */}
        <div className="col-xl-3 col-lg-6 col-md-6 mb-4">
          <div className="card h-100 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <div 
                  className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                    fontSize: '2rem'
                  }}
                >
                  ⚙️
                </div>
                <h5 className="card-title fw-bold mb-2">
                  {t('gameSettings.gamemodes.combinations', language)}
                </h5>
              </div>
              
              <div className="text-center">
                {settings.isPointsMode && settings.isCommunityVotingMode && (
                  <div className="badge bg-success bg-gradient p-2 mb-2 d-block">
                    <strong>{t('gameSettings.gamemodes.competitive', language)}</strong>
                  </div>
                )}
                
                {settings.isStreamerMode && (
                  <div className="badge bg-warning bg-gradient p-2 mb-2 d-block">
                    <strong>{t('gameSettings.gamemodes.streaming', language)}</strong>
                  </div>
                )}
                
                {!settings.isPointsMode && !settings.isCommunityVotingMode && !settings.isStreamerMode && (
                  <div className="badge bg-secondary bg-gradient p-2 mb-2 d-block">
                    <strong>{t('gameSettings.gamemodes.classic', language)}</strong>
                  </div>
                )}
                
                <small className="text-muted d-block mt-2">
                  Current mode configuration
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Mode Compatibility Information */}
      {settings.isPointsMode && settings.isCommunityVotingMode && (
        <div className="alert alert-success border-0 shadow-sm">
          <div className="row align-items-center">
            <div className="col-auto">
              <i className="bi bi-lightbulb-fill text-success" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <div className="col">
              <h6 className="alert-heading mb-1">{t('gameSettings.gamemodes.tip', language)}</h6>
              <p className="mb-0">
                {t('gameSettings.gamemodes.competitiveTip', language)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamemodesTab; 
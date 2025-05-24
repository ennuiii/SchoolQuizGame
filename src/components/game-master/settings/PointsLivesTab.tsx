import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';

interface PointsLivesTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Points and Lives tab for configuring scoring and elimination systems
 */
const PointsLivesTab: React.FC<PointsLivesTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {

  return (
    <div className="points-lives-tab">
      <h4>{t('gameSettings.tabs.points', language)}</h4>
      <p className="text-muted mb-4">
        {t('gameSettings.points.description', language)}
      </p>

      <div className="row">
        {/* Lives System */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>❤️</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.points.livesSystem', language)}
                </h5>
              </div>
              
              <div className="mb-3">
                <label htmlFor="initialLives" className="form-label">
                  {t('gameSettings.points.initialLives', language)}
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="initialLives"
                  min="1"
                  max="10"
                  value={settings.initialLives}
                  onChange={(e) => onSettingsChange({ initialLives: parseInt(e.target.value) || 3 })}
                />
                <div className="form-text">
                  {t('gameSettings.points.initialLivesHelp', language)}
                </div>
              </div>
              
              <div className="alert alert-info py-2">
                <small>
                  <strong>{t('gameSettings.points.currentSetting', language)}:</strong><br />
                  {t('gameSettings.points.playersStart', language)} {settings.initialLives} {t('gameSettings.points.lives', language)}
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Points System */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>⭐</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.points.pointsSystem', language)}
                </h5>
              </div>
              
              <div className="mb-3">
                <label htmlFor="pointsPerCorrect" className="form-label">
                  {t('gameSettings.points.pointsPerCorrect', language)}
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="pointsPerCorrect"
                  min="1"
                  max="1000"
                  value={settings.pointsPerCorrectAnswer}
                  onChange={(e) => onSettingsChange({ pointsPerCorrectAnswer: parseInt(e.target.value) || 100 })}
                  disabled={!settings.isPointsMode}
                />
                <div className="form-text">
                  {settings.isPointsMode 
                    ? t('gameSettings.points.pointsPerCorrectHelp', language)
                    : t('gameSettings.points.enablePointsMode', language)
                  }
                </div>
              </div>
              
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="bonusPointsForSpeed"
                  checked={settings.bonusPointsForSpeed}
                  onChange={(e) => onSettingsChange({ bonusPointsForSpeed: e.target.checked })}
                  disabled={!settings.isPointsMode}
                />
                <label className="form-check-label" htmlFor="bonusPointsForSpeed">
                  {t('gameSettings.points.bonusForSpeed', language)}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Scoring Examples */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">📊</span>
                {t('gameSettings.points.scoringExamples', language)}
              </h5>
              
              {settings.isPointsMode ? (
                <div className="row">
                  <div className="col-md-4">
                    <div className="p-3 bg-success bg-opacity-10 rounded">
                      <h6 className="text-success">{t('gameSettings.points.correctAnswer', language)}</h6>
                      <div className="fs-4 fw-bold text-success">
                        +{settings.pointsPerCorrectAnswer}
                      </div>
                      <small className="text-muted">
                        {t('gameSettings.points.basePoints', language)}
                      </small>
                    </div>
                  </div>
                  
                  {settings.bonusPointsForSpeed && (
                    <div className="col-md-4">
                      <div className="p-3 bg-primary bg-opacity-10 rounded">
                        <h6 className="text-primary">{t('gameSettings.points.speedBonus', language)}</h6>
                        <div className="fs-4 fw-bold text-primary">
                          +{Math.round(settings.pointsPerCorrectAnswer * 0.5)}
                        </div>
                        <small className="text-muted">
                          {t('gameSettings.points.fastAnswer', language)}
                        </small>
                      </div>
                    </div>
                  )}
                  
                  <div className="col-md-4">
                    <div className="p-3 bg-danger bg-opacity-10 rounded">
                      <h6 className="text-danger">{t('gameSettings.points.wrongAnswer', language)}</h6>
                      <div className="fs-4 fw-bold text-danger">
                        -1 ❤️
                      </div>
                      <small className="text-muted">
                        {t('gameSettings.points.loseLife', language)}
                      </small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-secondary">
                  <small>
                    {t('gameSettings.points.enablePointsModeToSee', language)}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Game Balancing */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">⚖️</span>
                {t('gameSettings.points.gameBalance', language)}
              </h5>
              
              <div className="row">
                <div className="col-md-6">
                  <h6>{t('gameSettings.points.recommended', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.points.rec1', language)}</li>
                    <li>{t('gameSettings.points.rec2', language)}</li>
                    <li>{t('gameSettings.points.rec3', language)}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>{t('gameSettings.points.considerations', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.points.con1', language)}</li>
                    <li>{t('gameSettings.points.con2', language)}</li>
                    <li>{t('gameSettings.points.con3', language)}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointsLivesTab; 
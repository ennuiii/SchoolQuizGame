import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';

interface JokerTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Joker tab for configuring powerups and special abilities
 */
const JokerTab: React.FC<JokerTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {

  return (
    <div className="joker-tab">
      <h4>{t('gameSettings.tabs.joker', language)}</h4>
      <p className="text-muted mb-4">
        {t('gameSettings.joker.description', language)}
      </p>

      <div className="row">
        {/* Enable Jokers */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>🃏</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.joker.enableJokers', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="enableJokers"
                  checked={settings.enableJokers}
                  onChange={(e) => onSettingsChange({ enableJokers: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="enableJokers">
                  {t('gameSettings.joker.enableJokersLabel', language)}
                </label>
              </div>
              
              <p className="card-text small text-muted">
                {t('gameSettings.joker.enableJokersDesc', language)}
              </p>
            </div>
          </div>
        </div>

        {/* Jokers Per Player */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>🎯</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.joker.jokersPerPlayer', language)}
                </h5>
              </div>
              
              <div className="mb-3">
                <label htmlFor="jokersPerPlayer" className="form-label">
                  {t('gameSettings.joker.numberOfJokers', language)}
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="jokersPerPlayer"
                  min="1"
                  max="5"
                  value={settings.jokersPerPlayer}
                  onChange={(e) => onSettingsChange({ jokersPerPlayer: parseInt(e.target.value) || 2 })}
                  disabled={!settings.enableJokers}
                />
                <div className="form-text">
                  {settings.enableJokers 
                    ? t('gameSettings.joker.numberOfJokersHelp', language)
                    : t('gameSettings.joker.enableJokersFirst', language)
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Joker Types */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">🎪</span>
                {t('gameSettings.joker.availableTypes', language)}
              </h5>
              
              {settings.enableJokers ? (
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <div className="p-3 bg-warning bg-opacity-10 rounded border">
                      <div className="mb-2 text-center">
                        <span style={{ fontSize: '2rem' }}>🕐</span>
                      </div>
                      <h6 className="text-center">{t('gameSettings.joker.extraTime', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.joker.extraTimeDesc', language)}
                      </small>
                      <div className="mt-2">
                        <small className="badge bg-warning text-dark">
                          +30s
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <div className="p-3 bg-info bg-opacity-10 rounded border">
                      <div className="mb-2 text-center">
                        <span style={{ fontSize: '2rem' }}>💡</span>
                      </div>
                      <h6 className="text-center">{t('gameSettings.joker.hint', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.joker.hintDesc', language)}
                      </small>
                      <div className="mt-2">
                        <small className="badge bg-info text-dark">
                          {t('gameSettings.joker.oneTime', language)}
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <div className="p-3 bg-success bg-opacity-10 rounded border">
                      <div className="mb-2 text-center">
                        <span style={{ fontSize: '2rem' }}>❤️</span>
                      </div>
                      <h6 className="text-center">{t('gameSettings.joker.extraLife', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.joker.extraLifeDesc', language)}
                      </small>
                      <div className="mt-2">
                        <small className="badge bg-success text-dark">
                          +1 ❤️
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <div className="p-3 bg-primary bg-opacity-10 rounded border">
                      <div className="mb-2 text-center">
                        <span style={{ fontSize: '2rem' }}>👥</span>
                      </div>
                      <h6 className="text-center">{t('gameSettings.joker.askAudience', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.joker.askAudienceDesc', language)}
                      </small>
                      <div className="mt-2">
                        <small className="badge bg-primary text-dark">
                          {t('gameSettings.joker.voting', language)}
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <div className="p-3 bg-secondary bg-opacity-10 rounded border">
                      <div className="mb-2 text-center">
                        <span style={{ fontSize: '2rem' }}>⏭️</span>
                      </div>
                      <h6 className="text-center">{t('gameSettings.joker.skip', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.joker.skipDesc', language)}
                      </small>
                      <div className="mt-2">
                        <small className="badge bg-secondary text-dark">
                          {t('gameSettings.joker.noLoss', language)}
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <div className="p-3 bg-light rounded border border-dashed">
                      <div className="mb-2 text-center">
                        <span style={{ fontSize: '2rem' }}>🚀</span>
                      </div>
                      <h6 className="text-center text-muted">{t('gameSettings.joker.moreTypes', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.joker.moreTypesDesc', language)}
                      </small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-secondary">
                  <small>
                    {t('gameSettings.joker.enableToSeeTypes', language)}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Game Balance */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">⚖️</span>
                {t('gameSettings.joker.gameBalance', language)}
              </h5>
              
              <div className="row">
                <div className="col-md-6">
                  <h6>{t('gameSettings.joker.benefits', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.joker.benefit1', language)}</li>
                    <li>{t('gameSettings.joker.benefit2', language)}</li>
                    <li>{t('gameSettings.joker.benefit3', language)}</li>
                    <li>{t('gameSettings.joker.benefit4', language)}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>{t('gameSettings.joker.considerations', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.joker.con1', language)}</li>
                    <li>{t('gameSettings.joker.con2', language)}</li>
                    <li>{t('gameSettings.joker.con3', language)}</li>
                    <li>{t('gameSettings.joker.con4', language)}</li>
                  </ul>
                </div>
              </div>
              
              {settings.enableJokers && (
                <div className="alert alert-info mt-3">
                  <small>
                    <strong>{t('gameSettings.joker.currentConfig', language)}:</strong> {t('gameSettings.joker.playersWillGet', language)} {settings.jokersPerPlayer} {t('gameSettings.joker.jokersEach', language)}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JokerTab; 
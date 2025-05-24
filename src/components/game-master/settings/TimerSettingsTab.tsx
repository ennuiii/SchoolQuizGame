import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';

interface TimerSettingsTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Timer settings tab for configuring time limits and timing behavior
 */
const TimerSettingsTab: React.FC<TimerSettingsTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {

  /**
   * Handle time limit change with validation
   */
  const handleTimeLimitChange = (value: string) => {
    const timeLimit = value ? parseInt(value) : null;
    onSettingsChange({ timeLimit });
  };

  /**
   * Handle question time limit change
   */
  const handleQuestionTimeLimitChange = (value: string) => {
    const questionTimeLimit = value ? parseInt(value) : null;
    onSettingsChange({ questionTimeLimit });
  };

  /**
   * Set preset time limits
   */
  const setPresetTime = (seconds: number) => {
    onSettingsChange({ timeLimit: seconds });
  };

  return (
    <div className="timer-settings-tab">
      <h4>{t('gameSettings.tabs.timer', language)}</h4>
      <p className="text-muted mb-4">
        {t('gameSettings.timer.description', language)}
      </p>

      <div className="row">
        {/* Main Time Limit */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>⏰</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.timer.mainTimeLimit', language)}
                </h5>
              </div>

              <div className="mb-3">
                <label htmlFor="timeLimit" className="form-label">
                  {t('gameSettings.timer.timePerQuestion', language)}
                </label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    id="timeLimit"
                    min="0"
                    max="99999"
                    value={settings.timeLimit || ''}
                    onChange={(e) => handleTimeLimitChange(e.target.value)}
                    placeholder={t('gameSettings.timer.noTimeLimit', language)}
                  />
                  <span className="input-group-text">
                    {t('gameSettings.timer.seconds', language)}
                  </span>
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => handleTimeLimitChange('')}
                    title={t('gameSettings.timer.clearTimeLimit', language)}
                  >
                    ✕
                  </button>
                </div>
                <div className="form-text">
                  {t('gameSettings.timer.timeLimitHelp', language)}
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="mb-3">
                <small className="text-muted mb-2 d-block">
                  {t('gameSettings.timer.quickPresets', language)}:
                </small>
                <div className="btn-group-sm" role="group">
                  <button 
                    className="btn btn-sm btn-outline-primary me-1 mb-1"
                    onClick={() => setPresetTime(30)}
                  >
                    30s
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-primary me-1 mb-1"
                    onClick={() => setPresetTime(60)}
                  >
                    1m
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-primary me-1 mb-1"
                    onClick={() => setPresetTime(90)}
                  >
                    1.5m
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-primary me-1 mb-1"
                    onClick={() => setPresetTime(120)}
                  >
                    2m
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-primary me-1 mb-1"
                    onClick={() => setPresetTime(300)}
                  >
                    5m
                  </button>
                </div>
              </div>

              {/* Current Setting Display */}
              <div className="alert alert-info py-2">
                <small>
                  <strong>{t('gameSettings.timer.currentSetting', language)}:</strong><br />
                  {settings.timeLimit 
                    ? `${settings.timeLimit} ${t('gameSettings.timer.seconds', language)} ${t('gameSettings.timer.perQuestion', language)}`
                    : t('gameSettings.timer.noLimitSet', language)
                  }
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Timer Settings */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>⚙️</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.timer.advanced', language)}
                </h5>
              </div>

              {/* Question-specific time limit */}
              <div className="mb-3">
                <label htmlFor="questionTimeLimit" className="form-label">
                  {t('gameSettings.timer.questionSpecific', language)}
                </label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    id="questionTimeLimit"
                    min="0"
                    max="99999"
                    value={settings.questionTimeLimit || ''}
                    onChange={(e) => handleQuestionTimeLimitChange(e.target.value)}
                    placeholder={t('gameSettings.timer.useMainTimer', language)}
                  />
                  <span className="input-group-text">
                    {t('gameSettings.timer.seconds', language)}
                  </span>
                </div>
                <div className="form-text">
                  {t('gameSettings.timer.questionSpecificHelp', language)}
                </div>
              </div>

              {/* Timer Behavior Settings */}
              <div className="mb-3">
                <h6>{t('gameSettings.timer.behavior', language)}</h6>
                
                <div className="form-check mb-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="showTimerToPlayers"
                    defaultChecked
                    disabled
                  />
                  <label className="form-check-label" htmlFor="showTimerToPlayers">
                    {t('gameSettings.timer.showToPlayers', language)}
                  </label>
                </div>
                
                <div className="form-check mb-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="autoAdvanceOnTimeout"
                    defaultChecked
                    disabled
                  />
                  <label className="form-check-label" htmlFor="autoAdvanceOnTimeout">
                    {t('gameSettings.timer.autoAdvance', language)}
                  </label>
                </div>
                
                <div className="form-check mb-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="warningBeforeTimeout"
                    defaultChecked
                    disabled
                  />
                  <label className="form-check-label" htmlFor="warningBeforeTimeout">
                    {t('gameSettings.timer.warning', language)}
                  </label>
                </div>
                
                <small className="text-muted">
                  {t('gameSettings.timer.futureFeature', language)}
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Timer Statistics */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">📊</span>
                {t('gameSettings.timer.gameEstimate', language)}
              </h5>
              
              <div className="row">
                <div className="col-md-3">
                  <div className="text-center p-2 bg-light rounded">
                    <div className="fs-4 fw-bold text-primary">
                      {settings.timeLimit ? Math.round(settings.timeLimit / 60) || 1 : '?'}
                    </div>
                    <small className="text-muted">
                      {t('gameSettings.timer.minutesPerQuestion', language)}
                    </small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center p-2 bg-light rounded">
                    <div className="fs-4 fw-bold text-info">
                      {settings.timeLimit ? '~5-15' : '?'}
                    </div>
                    <small className="text-muted">
                      {t('gameSettings.timer.estimatedTotal', language)}
                    </small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-2">
                    <small className="text-muted">
                      {settings.timeLimit 
                        ? t('gameSettings.timer.estimateNote', language)
                        : t('gameSettings.timer.noTimerNote', language)
                      }
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerSettingsTab; 
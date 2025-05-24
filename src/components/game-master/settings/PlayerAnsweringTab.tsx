import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';

interface PlayerAnsweringTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Player answering tab for configuring how players can submit answers
 */
const PlayerAnsweringTab: React.FC<PlayerAnsweringTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {

  return (
    <div className="player-answering-tab">
      <h4>{t('gameSettings.tabs.answering', language)}</h4>
      <p className="text-muted mb-4">
        {t('gameSettings.answering.description', language)}
      </p>

      <div className="row">
        {/* Answer Types */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>✏️</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.answering.answerTypes', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="allowTextAnswers"
                  checked={settings.allowTextAnswers}
                  onChange={(e) => onSettingsChange({ allowTextAnswers: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="allowTextAnswers">
                  {t('gameSettings.answering.allowText', language)}
                </label>
              </div>
              
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="allowDrawingAnswers"
                  checked={settings.allowDrawingAnswers}
                  onChange={(e) => onSettingsChange({ allowDrawingAnswers: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="allowDrawingAnswers">
                  {t('gameSettings.answering.allowDrawing', language)}
                </label>
              </div>
              
              <div className="form-text">
                {t('gameSettings.answering.answerTypesHelp', language)}
              </div>
            </div>
          </div>
        </div>

        {/* Answer Constraints */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>📏</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.answering.constraints', language)}
                </h5>
              </div>
              
              <div className="mb-3">
                <label htmlFor="maxAnswerLength" className="form-label">
                  {t('gameSettings.answering.maxLength', language)}
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="maxAnswerLength"
                  min="10"
                  max="500"
                  value={settings.maxAnswerLength}
                  onChange={(e) => onSettingsChange({ maxAnswerLength: parseInt(e.target.value) || 100 })}
                  disabled={!settings.allowTextAnswers}
                />
                <div className="form-text">
                  {settings.allowTextAnswers 
                    ? t('gameSettings.answering.maxLengthHelp', language)
                    : t('gameSettings.answering.enableTextFirst', language)
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Answer Formats */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">📝</span>
                {t('gameSettings.answering.formats', language)}
              </h5>
              
              <div className="row">
                {settings.allowTextAnswers && (
                  <div className="col-md-4">
                    <div className="p-3 bg-primary bg-opacity-10 rounded">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>💬</span>
                      </div>
                      <h6 className="text-primary">{t('gameSettings.answering.textAnswers', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.answering.textAnswersDesc', language)}
                      </small>
                      <div className="mt-2">
                        <small className="badge bg-light text-dark">
                          {t('gameSettings.answering.maxChars', language)}: {settings.maxAnswerLength}
                        </small>
                      </div>
                    </div>
                  </div>
                )}
                
                {settings.allowDrawingAnswers && (
                  <div className="col-md-4">
                    <div className="p-3 bg-success bg-opacity-10 rounded">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>🎨</span>
                      </div>
                      <h6 className="text-success">{t('gameSettings.answering.drawingAnswers', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.answering.drawingAnswersDesc', language)}
                      </small>
                    </div>
                  </div>
                )}
                
                <div className="col-md-4">
                  <div className="p-3 bg-info bg-opacity-10 rounded">
                    <div className="mb-2">
                      <span style={{ fontSize: '2rem' }}>📋</span>
                    </div>
                    <h6 className="text-info">{t('gameSettings.answering.multiChoice', language)}</h6>
                    <small className="text-muted">
                      {t('gameSettings.answering.multiChoiceDesc', language)}
                    </small>
                    <div className="mt-2">
                      <small className="badge bg-light text-dark">
                        {t('gameSettings.answering.comingSoon', language)}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
              
              {!settings.allowTextAnswers && !settings.allowDrawingAnswers && (
                <div className="alert alert-warning">
                  <small>
                    <strong>{t('gameSettings.answering.warning', language)}:</strong> {t('gameSettings.answering.warningDesc', language)}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Player Experience */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">👥</span>
                {t('gameSettings.answering.playerExperience', language)}
              </h5>
              
              <div className="row">
                <div className="col-md-6">
                  <h6>{t('gameSettings.answering.tips', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.answering.tip1', language)}</li>
                    <li>{t('gameSettings.answering.tip2', language)}</li>
                    <li>{t('gameSettings.answering.tip3', language)}</li>
                    <li>{t('gameSettings.answering.tip4', language)}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>{t('gameSettings.answering.considerations', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.answering.con1', language)}</li>
                    <li>{t('gameSettings.answering.con2', language)}</li>
                    <li>{t('gameSettings.answering.con3', language)}</li>
                    <li>{t('gameSettings.answering.con4', language)}</li>
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

export default PlayerAnsweringTab; 
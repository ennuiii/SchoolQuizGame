import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';

interface CommunityVotingTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Community voting tab for configuring voting and crowd participation features
 */
const CommunityVotingTab: React.FC<CommunityVotingTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {

  return (
    <div className="community-voting-tab">
      <h4>{t('gameSettings.tabs.voting', language)}</h4>
      <p className="text-muted mb-4">
        {t('gameSettings.voting.description', language)}
      </p>

      <div className="row">
        {/* Voting Time Limit */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>⏱️</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.voting.timeLimit', language)}
                </h5>
              </div>
              
              <div className="mb-3">
                <label htmlFor="votingTimeLimit" className="form-label">
                  {t('gameSettings.voting.votingDuration', language)}
                </label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    id="votingTimeLimit"
                    min="10"
                    max="300"
                    value={settings.votingTimeLimit}
                    onChange={(e) => onSettingsChange({ votingTimeLimit: parseInt(e.target.value) || 30 })}
                    disabled={!settings.isCommunityVotingMode}
                  />
                  <span className="input-group-text">
                    {t('gameSettings.voting.seconds', language)}
                  </span>
                </div>
                <div className="form-text">
                  {settings.isCommunityVotingMode 
                    ? t('gameSettings.voting.timeLimitHelp', language)
                    : t('gameSettings.voting.enableVotingFirst', language)
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Voting Options */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>⚙️</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.voting.options', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="allowMultipleVotes"
                  checked={settings.allowMultipleVotes}
                  onChange={(e) => onSettingsChange({ allowMultipleVotes: e.target.checked })}
                  disabled={!settings.isCommunityVotingMode}
                />
                <label className="form-check-label" htmlFor="allowMultipleVotes">
                  {t('gameSettings.voting.allowMultiple', language)}
                </label>
              </div>
              
              <div className="form-text">
                {t('gameSettings.voting.allowMultipleHelp', language)}
              </div>
            </div>
          </div>
        </div>

        {/* Voting Process */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">🗳️</span>
                {t('gameSettings.voting.process', language)}
              </h5>
              
              {settings.isCommunityVotingMode ? (
                <div className="row">
                  <div className="col-md-3">
                    <div className="text-center p-3 bg-light rounded">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>1️⃣</span>
                      </div>
                      <h6>{t('gameSettings.voting.step1', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.voting.step1Desc', language)}
                      </small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="text-center p-3 bg-light rounded">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>2️⃣</span>
                      </div>
                      <h6>{t('gameSettings.voting.step2', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.voting.step2Desc', language)}
                      </small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="text-center p-3 bg-light rounded">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>3️⃣</span>
                      </div>
                      <h6>{t('gameSettings.voting.step3', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.voting.step3Desc', language)}
                      </small>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="text-center p-3 bg-light rounded">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>4️⃣</span>
                      </div>
                      <h6>{t('gameSettings.voting.step4', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.voting.step4Desc', language)}
                      </small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-secondary">
                  <small>
                    {t('gameSettings.voting.enableToSeeProcess', language)}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Voting Statistics */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">📊</span>
                {t('gameSettings.voting.statistics', language)}
              </h5>
              
              <div className="row">
                <div className="col-md-6">
                  <h6>{t('gameSettings.voting.benefits', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.voting.benefit1', language)}</li>
                    <li>{t('gameSettings.voting.benefit2', language)}</li>
                    <li>{t('gameSettings.voting.benefit3', language)}</li>
                    <li>{t('gameSettings.voting.benefit4', language)}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>{t('gameSettings.voting.tips', language)}</h6>
                  <ul className="small">
                    <li>{t('gameSettings.voting.tip1', language)}</li>
                    <li>{t('gameSettings.voting.tip2', language)}</li>
                    <li>{t('gameSettings.voting.tip3', language)}</li>
                    <li>{t('gameSettings.voting.tip4', language)}</li>
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

export default CommunityVotingTab; 
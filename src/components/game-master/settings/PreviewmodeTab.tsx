import React from 'react';
import { GameSettingsState } from '../GameSettings';
import { t } from '../../../i18n';

interface PreviewmodeTabProps {
  settings: GameSettingsState;
  onSettingsChange: (settings: Partial<GameSettingsState>) => void;
  language: string;
}

/**
 * Preview mode tab for configuring preview and spectator features
 */
const PreviewmodeTab: React.FC<PreviewmodeTabProps> = ({ 
  settings, 
  onSettingsChange, 
  language 
}) => {

  return (
    <div className="preview-mode-tab">
      <h4>{t('gameSettings.tabs.preview', language)}</h4>
      <p className="text-muted mb-4">
        {t('gameSettings.preview.description', language)}
      </p>

      <div className="row">
        {/* Enable Preview Mode */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>👁️</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.preview.enablePreview', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="enablePreviewMode"
                  checked={settings.enablePreviewMode}
                  onChange={(e) => onSettingsChange({ enablePreviewMode: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="enablePreviewMode">
                  {t('gameSettings.preview.enablePreviewLabel', language)}
                </label>
              </div>
              
              <p className="card-text small text-muted">
                {t('gameSettings.preview.enablePreviewDesc', language)}
              </p>
            </div>
          </div>
        </div>

        {/* Auto-Switch Players */}
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>🔄</span>
                <h5 className="card-title mb-0">
                  {t('gameSettings.preview.autoSwitch', language)}
                </h5>
              </div>
              
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="autoSwitchPlayers"
                  checked={settings.autoSwitchPlayers}
                  onChange={(e) => onSettingsChange({ autoSwitchPlayers: e.target.checked })}
                  disabled={!settings.enablePreviewMode}
                />
                <label className="form-check-label" htmlFor="autoSwitchPlayers">
                  {t('gameSettings.preview.autoSwitchLabel', language)}
                </label>
              </div>
              
              <p className="card-text small text-muted">
                {t('gameSettings.preview.autoSwitchDesc', language)}
              </p>
            </div>
          </div>
        </div>

        {/* Preview Controls */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">
                <span className="me-2">🎛️</span>
                {t('gameSettings.preview.controls', language)}
              </h5>
              
              {settings.enablePreviewMode ? (
                <div className="row">
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded text-center">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>📺</span>
                      </div>
                      <h6>{t('gameSettings.preview.spectatorView', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.preview.spectatorViewDesc', language)}
                      </small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded text-center">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>🖼️</span>
                      </div>
                      <h6>{t('gameSettings.preview.playerFocus', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.preview.playerFocusDesc', language)}
                      </small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded text-center">
                      <div className="mb-2">
                        <span style={{ fontSize: '2rem' }}>🔴</span>
                      </div>
                      <h6>{t('gameSettings.preview.streamMode', language)}</h6>
                      <small className="text-muted">
                        {t('gameSettings.preview.streamModeDesc', language)}
                      </small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-secondary">
                  <small>
                    {t('gameSettings.preview.enableToSeeControls', language)}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Future Features */}
        <div className="col-12">
          <div className="card border-dashed">
            <div className="card-body">
              <h6 className="card-title text-muted">
                <span className="me-2">🚀</span>
                {t('gameSettings.preview.comingSoon', language)}
              </h6>
              <div className="row">
                <div className="col-md-6">
                  <ul className="list-unstyled small text-muted">
                    <li>• {t('gameSettings.preview.feature1', language)}</li>
                    <li>• {t('gameSettings.preview.feature2', language)}</li>
                    <li>• {t('gameSettings.preview.feature3', language)}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <ul className="list-unstyled small text-muted">
                    <li>• {t('gameSettings.preview.feature4', language)}</li>
                    <li>• {t('gameSettings.preview.feature5', language)}</li>
                    <li>• {t('gameSettings.preview.feature6', language)}</li>
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

export default PreviewmodeTab; 
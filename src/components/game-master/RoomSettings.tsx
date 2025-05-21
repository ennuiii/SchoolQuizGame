import React from 'react';
import { useRoom } from '../../contexts/RoomContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface RoomSettingsProps {
  timeLimit: number | null;
  onTimeLimitChange: (timeLimit: number | null) => void;
}

const RoomSettings: React.FC<RoomSettingsProps> = ({ timeLimit, onTimeLimitChange }) => {
  const { roomCode } = useRoom();
  const { language } = useLanguage();

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">{t('roomSettings.title', language)}</h6>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <label htmlFor="timeLimit" className="form-label">{t('roomSettings.timeLimit', language)}</label>
          <div className="input-group">
            <input
              type="number"
              className="form-control"
              id="timeLimit"
              min="0"
              max="99999"
              value={timeLimit || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                onTimeLimitChange(value);
              }}
              placeholder={t('roomSettings.noTimeLimit', language)}
            />
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => onTimeLimitChange(null)}
            >
              {t('roomSettings.clear', language)}
            </button>
          </div>
          <div className="form-text">
            {t('roomSettings.timeLimitHelp', language)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomSettings; 
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface KickedNotificationModalProps {
  isOpen: boolean;
  reason: string;
  onAcknowledge: () => void;
}

const KickedNotificationModal: React.FC<KickedNotificationModalProps> = ({ 
  isOpen, 
  reason, 
  onAcknowledge 
}) => {
  const { language } = useLanguage();

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="modal fade show d-block" 
      tabIndex={-1} 
      role="dialog" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} // Backdrop style
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t('notification', language)}</h5>
            {/* No close button in header, force acknowledgement */}
          </div>
          <div className="modal-body">
            <p>{t('kickedFromRoom', language)}</p>
            <p><strong>{t('reason', language)}:</strong> {reason || t('noReasonProvided', language)}</p>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={onAcknowledge}
            >
              {t('ok', language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KickedNotificationModal; 
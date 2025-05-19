import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface NotificationProps {
  type: 'success' | 'danger' | 'warning' | 'info';
  message: string;
  details?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
}

const Notification: React.FC<NotificationProps> = ({
  type,
  message,
  details,
  icon,
  onClose
}) => {
  const { language } = useLanguage();

  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return <span role="img" aria-label={t('notificationTypes.success', language)} style={{ fontSize: '1.5rem' }}>✓</span>;
      case 'danger':
        return <span role="img" aria-label={t('notificationTypes.error', language)} style={{ fontSize: '1.5rem' }}>✗</span>;
      case 'warning':
        return <span role="img" aria-label={t('notificationTypes.warning', language)} style={{ fontSize: '1.5rem' }}>⚠</span>;
      case 'info':
        return <span role="img" aria-label={t('notificationTypes.info', language)} style={{ fontSize: '1.5rem' }}>ℹ</span>;
      default:
        return null;
    }
  };

  return (
    <div className={`alert alert-${type} mb-4 d-flex align-items-center`} role="alert">
      <div className="me-3">
        {getIcon()}
      </div>
      <div className="flex-grow-1">
        <strong>{message}</strong>
        {details && <div className="small">{details}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
          aria-label={t('notificationTypes.close', language)}
        />
      )}
    </div>
  );
};

export default Notification; 
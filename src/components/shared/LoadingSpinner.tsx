import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = '#4a90e2',
  message
}) => {
  const { language } = useLanguage();
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56
  };

  const spinnerSize = sizeMap[size];
  const defaultMessage = t('loading', language);

  return (
    <div className="loading-spinner-container" style={{ textAlign: 'center' }}>
      <div
        className="loading-spinner"
        style={{
          display: 'inline-block',
          width: spinnerSize,
          height: spinnerSize,
          border: `4px solid ${color}20`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '8px'
        }}
      />
      <div
        className="loading-message"
        style={{
          marginTop: '8px',
          color: '#666',
          fontSize: size === 'small' ? '14px' : '16px'
        }}
      >
        {message || defaultMessage}
      </div>
      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}; 
import React, { useEffect, useState } from 'react';
import socketService, { ConnectionStatusType } from '../../services/socketService';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from 'react-toastify';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface ConnectionStatusProps {
  showDetails?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ showDetails = false }) => {
  const [connectionState, setConnectionState] = useState<ConnectionStatusType>('disconnected');
  const [details, setDetails] = useState<any | null>(null);
  const [recoveryAttempt, setRecoveryAttempt] = useState<number | null>(null);
  const [isSessionRecovered, setIsSessionRecovered] = useState<boolean>(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);
  const { language } = useLanguage();

  useEffect(() => {
    const handleConnectionStateChange = (state: string, detailInfo: any) => {
      setConnectionState(state as ConnectionStatusType);
      setDetails(detailInfo);
      
      // Handle recovery info
      if (state === 'reconnecting' && detailInfo?.attempt) {
        setRecoveryAttempt(detailInfo.attempt);
      } else if (state === 'connected') {
        setRecoveryAttempt(null);
        // Check if the connection was recovered
        if (detailInfo?.recovered) {
          setIsSessionRecovered(true);
          toast.success(t('connectionRestored', language));
        } else if (recoveryAttempt !== null) {
          // Connection was re-established after a disconnection
          toast.success(t('connectionReestablished', language));
        }
      } else if (state === 'error') {
        // Store the error message for display
        setConnectionErrorMessage(detailInfo?.message || t('connectionErrorUnknown', language));
        toast.error(`${t('connectionError', language)}: ${detailInfo?.message || t('connectionErrorUnknown', language)}`);
      } else if (state === 'reconnect_failed') {
        setConnectionErrorMessage(t('connectionReconnectFailed', language));
        toast.error(t('connectionReconnectFailed', language));
      }
    };
    
    socketService.onConnectionStateChange(handleConnectionStateChange);
    return () => {
      // This cleanup is intentionally empty as there's no specific off method
      // for onConnectionStateChange in the socketService
    };
  }, [recoveryAttempt, language]);

  // Function to retry connection
  const handleRetryConnection = () => {
    toast.info(t('connectionAttempting', language));
    setConnectionErrorMessage(null);
    socketService.connect()
      .catch(error => {
        console.error('Retry connection error:', error);
      });
  };

  if (!showDetails && connectionState === 'connected') {
    return null; // No need to show anything when connected and details not requested
  }

  // Return a more detailed error display if connection failed
  if (connectionState === 'error' || connectionState === 'reconnect_failed') {
    return (
      <div className="alert alert-danger">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <strong>{t('connectionFailed', language)}</strong>
            {connectionErrorMessage && (
              <p className="mb-1">{connectionErrorMessage}</p>
            )}
            <p className="mb-0 small">
              {t('connectionCheckInternet', language)}
            </p>
          </div>
          <button 
            className="btn btn-sm btn-outline-light" 
            onClick={handleRetryConnection}
          >
            {t('connectionRetry', language)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`alert ${getAlertClass(connectionState)}`}>
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <strong>{getConnectionLabel(connectionState, language)}</strong>
          {showDetails && details && Object.keys(details).length > 0 && (
            <div className="mt-1 small">
              {details.recovered && <span className="badge bg-success me-2">{t('sessionRecovered', language)}</span>}
              {details.attempt && <span className="badge bg-warning text-dark">{t('attempt', language).replace('{number}', details.attempt)}</span>}
            </div>
          )}
        </div>
        {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
          <LoadingSpinner size="small" />
        )}
      </div>
    </div>
  );
};

// Helper function to get the appropriate alert class based on connection state
function getAlertClass(state: ConnectionStatusType): string {
  switch (state) {
    case 'connected':
      return 'alert-success';
    case 'connecting':
    case 'reconnecting':
      return 'alert-warning';
    case 'disconnected':
      return 'alert-secondary';
    case 'error':
    case 'reconnect_failed':
      return 'alert-danger';
    default:
      return 'alert-info';
  }
}

// Helper function to get a user-friendly label for the connection state
function getConnectionLabel(state: ConnectionStatusType, language: string): string {
  switch (state) {
    case 'connected':
      return t('connectionConnected', language);
    case 'connecting':
      return t('connectionConnecting', language);
    case 'reconnecting':
      return t('connectionReconnecting', language);
    case 'disconnected':
      return t('connectionDisconnected', language);
    case 'error':
      return t('connectionError', language);
    case 'reconnect_failed':
      return t('connectionFailedToReconnect', language);
    default:
      return t('connectionUnknownState', language);
  }
} 
import React, { useEffect, useState } from 'react';
import socketService, { ConnectionStatusType } from '../../services/socketService';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from 'react-toastify';

interface ConnectionStatusProps {
  showDetails?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ showDetails = false }) => {
  const [connectionState, setConnectionState] = useState<ConnectionStatusType>('disconnected');
  const [details, setDetails] = useState<any | null>(null);
  const [recoveryAttempt, setRecoveryAttempt] = useState<number | null>(null);
  const [isSessionRecovered, setIsSessionRecovered] = useState<boolean>(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);

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
          toast.success('Connection restored with session recovery!');
        } else if (recoveryAttempt !== null) {
          // Connection was re-established after a disconnection
          toast.success('Connection re-established!');
        }
      } else if (state === 'error') {
        // Store the error message for display
        setConnectionErrorMessage(detailInfo?.message || 'Unknown error');
        toast.error(`Connection error: ${detailInfo?.message || 'Unknown error'}`);
      } else if (state === 'reconnect_failed') {
        setConnectionErrorMessage('Unable to reconnect after multiple attempts');
        toast.error('Unable to reconnect to the server after multiple attempts');
      }
    };
    
    socketService.onConnectionStateChange(handleConnectionStateChange);
    return () => {
      // This cleanup is intentionally empty as there's no specific off method
      // for onConnectionStateChange in the socketService
    };
  }, [recoveryAttempt]);

  // Function to retry connection
  const handleRetryConnection = () => {
    toast.info('Attempting to reconnect...');
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
            <strong>Connection Failed</strong>
            {connectionErrorMessage && (
              <p className="mb-1">{connectionErrorMessage}</p>
            )}
            <p className="mb-0 small">
              The application cannot connect to the server. Please check your internet connection or try again later.
            </p>
          </div>
          <button 
            className="btn btn-sm btn-outline-light" 
            onClick={handleRetryConnection}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`alert ${getAlertClass(connectionState)}`}>
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <strong>{getConnectionLabel(connectionState)}</strong>
          {showDetails && details && Object.keys(details).length > 0 && (
            <div className="mt-1 small">
              {details.recovered && <span className="badge bg-success me-2">Session Recovered</span>}
              {details.attempt && <span className="badge bg-warning text-dark">Attempt {details.attempt}</span>}
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
function getConnectionLabel(state: ConnectionStatusType): string {
  switch (state) {
    case 'connected':
      return 'Connected to Game Server';
    case 'connecting':
      return 'Connecting to Game Server...';
    case 'reconnecting':
      return 'Reconnecting to Game Server...';
    case 'disconnected':
      return 'Disconnected from Game Server';
    case 'error':
      return 'Connection Error';
    case 'reconnect_failed':
      return 'Failed to Reconnect';
    default:
      return 'Unknown Connection State';
  }
} 
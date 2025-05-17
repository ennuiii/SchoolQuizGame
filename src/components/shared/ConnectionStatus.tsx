import React from 'react';
import { useRoom } from '../../contexts/RoomContext';
import { LoadingSpinner } from './LoadingSpinner';
import { ConnectionStatusType } from '../../services/socketService';

interface ConnectionStatusProps {
  showDetails?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ showDetails = true }) => {
  const { connectionStatus, attemptRejoin, errorMsg, isLoading } = useRoom();

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
      case 'reconnecting':
        return '#FFA726';
      case 'disconnected':
      case 'reconnect_failed':
      case 'error':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'reconnect_failed':
        return 'Reconnect failed';
      case 'error':
        return errorMsg || 'Connection error';
      default:
        return 'Unknown';
    }
  };

  const showRejoinButton = connectionStatus === 'disconnected' || 
                           connectionStatus === 'reconnect_failed' || 
                           connectionStatus === 'error';

  const disableRejoinButton = isLoading || 
                              connectionStatus === 'connecting' || 
                              connectionStatus === 'reconnecting';

  return (
    <div
      className="connection-status-widget"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '10px 15px',
        borderRadius: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        zIndex: 1050,
        textAlign: 'center',
        minWidth: '150px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            transition: 'background-color 0.3s ease',
            flexShrink: 0,
          }}
        />
        {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
          <LoadingSpinner size="small" color={getStatusColor()} />
        )}
        <span style={{ color: '#333', fontWeight: 500 }}>
          {showDetails ? getStatusMessage() : 'Status'}
        </span>
      </div>
      {showRejoinButton && (
        <button
          onClick={attemptRejoin}
          disabled={disableRejoinButton}
          style={{
            padding: '6px 12px',
            fontSize: '0.85em',
            backgroundColor: getStatusColor(),
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: disableRejoinButton ? 'not-allowed' : 'pointer',
            marginTop: '5px',
            opacity: disableRejoinButton ? 0.5 : 1,
          }}
        >
          Attempt Rejoin
        </button>
      )}
    </div>
  );
}; 
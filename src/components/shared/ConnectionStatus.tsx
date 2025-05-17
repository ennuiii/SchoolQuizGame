import React, { useEffect, useState } from 'react';
import socketService from '../../services/socketService';
import { LoadingSpinner } from './LoadingSpinner';

interface ConnectionStatusProps {
  showDetails?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ showDetails = false }) => {
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  useEffect(() => {
    socketService.onConnectionStateChange((state) => {
      setConnectionState(state);
    });
  }, []);

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
      case 'reconnecting':
        return '#FFA726';
      case 'disconnected':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusMessage = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div
      className="connection-status"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '8px 16px',
        borderRadius: '20px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 1000
      }}
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          transition: 'background-color 0.3s ease'
        }}
      />
      {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
        <LoadingSpinner size="small" color={getStatusColor()} />
      )}
      <span style={{ color: '#333' }}>
        {showDetails ? getStatusMessage() : 'Connection'}
      </span>
    </div>
  );
}; 
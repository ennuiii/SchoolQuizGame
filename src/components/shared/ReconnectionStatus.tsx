import React from 'react';
import { useRoom } from '../../contexts/RoomContext';

const ReconnectionStatus: React.FC = () => {
  const { isReconnecting } = useRoom();

  if (!isReconnecting) return null;

  return (
    <div className="reconnection-status">
      <div className="alert alert-warning d-flex align-items-center" role="alert">
        <div className="spinner-border spinner-border-sm me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <div>
          Connection lost. Attempting to reconnect...
        </div>
      </div>
    </div>
  );
};

export default ReconnectionStatus; 
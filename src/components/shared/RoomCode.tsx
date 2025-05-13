import React, { useState } from 'react';
import { useRoom } from '../../contexts/RoomContext';

const RoomCode: React.FC = () => {
  const { roomCode } = useRoom();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join?room=${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!roomCode) return null;

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Room Code</h6>
      </div>
      <div className="card-body">
        <div className="d-flex flex-column gap-2">
          <div className="room-code-display p-2 bg-light rounded text-center">
            <h3 className="mb-0">{roomCode}</h3>
          </div>
          <div className="d-flex gap-2">
            <button 
              className="btn btn-primary flex-grow-1"
              onClick={handleCopyCode}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button 
              className="btn btn-outline-primary flex-grow-1"
              onClick={handleCopyInviteLink}
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCode; 
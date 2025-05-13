import React from 'react';
import { useRoom } from '../../contexts/RoomContext';

const RoomCode: React.FC = () => {
  const { roomCode, copied, setCopied } = useRoom();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join?code=${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Room Code</h6>
      </div>
      <div className="card-body">
        <div className="room-code-display mb-3">
          {roomCode}
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary flex-grow-1"
            onClick={handleCopyCode}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button
            className="btn btn-outline-secondary flex-grow-1"
            onClick={handleCopyInviteLink}
          >
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomCode; 
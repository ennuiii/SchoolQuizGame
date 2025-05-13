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
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Room Code</h5>
      </div>
      <div className="card-body">
        <div className="d-flex align-items-center mb-3">
          <code className="fs-4 me-3">{roomCode}</code>
          <button
            className="btn btn-outline-primary"
            onClick={handleCopyCode}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <button
          className="btn btn-outline-secondary"
          onClick={handleCopyInviteLink}
        >
          {copied ? 'Copied!' : 'Copy Invite Link'}
        </button>
      </div>
    </div>
  );
};

export default RoomCode; 
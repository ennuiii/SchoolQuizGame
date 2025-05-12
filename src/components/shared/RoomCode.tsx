import React, { useState } from 'react';

interface RoomCodeProps {
  roomCode: string;
}

const RoomCode: React.FC<RoomCodeProps> = ({ roomCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Room Code</h6>
      </div>
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between">
          <div className="room-code-display">
            <span className="h4 mb-0">{roomCode}</span>
          </div>
          <button
            className="btn btn-outline-primary"
            onClick={handleCopy}
            title="Copy room code"
          >
            {copied ? (
              <>
                <i className="bi bi-check2 me-1"></i>
                Copied!
              </>
            ) : (
              <>
                <i className="bi bi-clipboard me-1"></i>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomCode; 
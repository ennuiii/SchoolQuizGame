import React from 'react';
import { useRoom } from '../../contexts/RoomContext';

interface RoomSettingsProps {
  timeLimit: number | null;
  onTimeLimitChange: (timeLimit: number | null) => void;
}

const RoomSettings: React.FC<RoomSettingsProps> = ({ timeLimit, onTimeLimitChange }) => {
  const { roomCode } = useRoom();

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Room Settings</h6>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <label htmlFor="timeLimit" className="form-label">Time Limit (seconds)</label>
          <div className="input-group">
            <input
              type="number"
              className="form-control"
              id="timeLimit"
              min="0"
              max="99999"
              value={timeLimit || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                onTimeLimitChange(value);
              }}
              placeholder="No time limit"
            />
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => onTimeLimitChange(null)}
            >
              Clear
            </button>
          </div>
          <div className="form-text">
            Set to 0 for no time limit
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomSettings; 
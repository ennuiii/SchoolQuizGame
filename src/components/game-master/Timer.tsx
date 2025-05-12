import React from 'react';

interface TimerProps {
  timeRemaining: number;
  timeLimit: number;
  isRunning: boolean;
}

const Timer: React.FC<TimerProps> = ({ timeRemaining, timeLimit, isRunning }) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h3 className="mb-0">Timer</h3>
      </div>
      <div className="card-body">
        <div className={`timer-display ${timeRemaining <= 10 ? 'text-danger' : ''}`}>
          <h3>
            <span className="me-2">Time:</span>
            <span>{formatTime(timeRemaining)}</span>
          </h3>
          {timeRemaining <= 10 && (
            <p className="text-danger mb-0">Answer will be auto-submitted when time is up!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Timer; 
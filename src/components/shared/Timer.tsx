import React from 'react';

interface TimerProps {
  timeLimit: number | null;
  timeRemaining: number | null;
  isActive: boolean;
  showSeconds?: boolean;
}

const Timer: React.FC<TimerProps> = ({
  timeLimit,
  timeRemaining,
  isActive,
  showSeconds = false
}) => {
  if (timeLimit === null || timeRemaining === null || timeLimit >= 99999) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="d-flex justify-content-center align-items-center gap-2">
      <div className={`timer ${timeRemaining <= 10 ? 'text-danger' : ''}`}>
        {showSeconds ? (
          <span>{timeRemaining}s</span>
        ) : (
          <span>{formatTime(timeRemaining)}</span>
        )}
      </div>
      {isActive && (
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      )}
    </div>
  );
};

export default Timer; 
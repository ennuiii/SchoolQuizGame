import React from 'react';

interface TimerProps {
  timeLimit: number | null;
  timeRemaining: number | null;
  isActive?: boolean;
  onTimeUp?: () => void;
  showProgressBar?: boolean;
  className?: string;
  showSeconds?: boolean;
}

const Timer: React.FC<TimerProps> = ({
  timeLimit,
  timeRemaining,
  isActive = true,
  onTimeUp,
  showProgressBar = true,
  className = '',
  showSeconds = false
}) => {
  if (timeLimit === null || timeRemaining === null) {
    return null;
  }

  const progress = (timeRemaining / timeLimit) * 100;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeString = showSeconds 
    ? `${timeRemaining}s`
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const getProgressColor = () => {
    if (!isActive) return 'bg-secondary';
    const percentage = (timeRemaining / timeLimit) * 100;
    if (percentage > 60) return 'bg-success';
    if (percentage > 30) return 'bg-warning';
    return 'bg-danger';
  };

  if (!showProgressBar) {
    return (
      <div className={`timer-display ${timeRemaining <= 10 ? 'text-danger' : ''} ${className}`}>
        <h3>
          <span className="me-2">Time:</span>
          <span>{timeRemaining}</span>
          <span className="ms-1">sec</span>
        </h3>
      </div>
    );
  }

  return (
    <div className="timer mt-3">
      <div className="progress">
        <div
          className={`progress-bar ${getProgressColor()}`}
          role="progressbar"
          style={{ width: `${progress}%` }}
          aria-valuenow={timeRemaining}
          aria-valuemin={0}
          aria-valuemax={timeLimit}
        >
          {timeString}
        </div>
      </div>
    </div>
  );
};

export default Timer; 
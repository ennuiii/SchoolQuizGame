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
  // If timeLimit is null, we'll use 99999 but hide the timer
  const effectiveTimeLimit = timeLimit ?? 99999;
  const effectiveTimeRemaining = timeRemaining ?? 99999;

  // If both are null, don't show the timer
  if (timeLimit === null && timeRemaining === null) {
    return null;
  }

  const progress = (effectiveTimeRemaining / effectiveTimeLimit) * 100;
  const minutes = Math.floor(effectiveTimeRemaining / 60);
  const seconds = effectiveTimeRemaining % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const getProgressColor = () => {
    if (!isActive) return 'bg-secondary';
    const percentage = (effectiveTimeRemaining / effectiveTimeLimit) * 100;
    if (percentage > 60) return 'bg-success';
    if (percentage > 30) return 'bg-warning';
    return 'bg-danger';
  };

  if (!showProgressBar) {
    return (
      <div className={`timer-display ${effectiveTimeRemaining <= 10 ? 'text-danger' : ''} ${className}`}>
        <h3>
          <span className="me-2">Time:</span>
          <span>{timeString}</span>
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
          aria-valuenow={effectiveTimeRemaining}
          aria-valuemin={0}
          aria-valuemax={effectiveTimeLimit}
        >
          {timeString}
        </div>
      </div>
    </div>
  );
};

export default Timer; 
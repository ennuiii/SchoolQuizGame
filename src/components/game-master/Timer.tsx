import React from 'react';

interface TimerProps {
  timeRemaining: number | null;
  timeLimit?: number;
  isRunning?: boolean;
}

const Timer: React.FC<TimerProps> = ({ timeRemaining, timeLimit, isRunning }) => {
  if (timeRemaining === null) return null;

  const progress = timeLimit ? (timeRemaining / timeLimit) * 100 : 100;

  return (
    <div className="timer mt-3">
      <div className="progress">
        <div
          className={`progress-bar ${!isRunning ? 'bg-secondary' : ''}`}
          role="progressbar"
          style={{ width: `${progress}%` }}
          aria-valuenow={timeRemaining}
          aria-valuemin={0}
          aria-valuemax={timeLimit || 60}
        >
          {timeRemaining}s
        </div>
      </div>
    </div>
  );
};

export default Timer; 
import React from 'react';

interface TimerProps {
  timeRemaining: number | null;
}

const Timer: React.FC<TimerProps> = ({ timeRemaining }) => {
  if (timeRemaining === null) return null;

  return (
    <div className="timer mt-3">
      <div className="progress">
        <div
          className="progress-bar"
          role="progressbar"
          style={{ width: '100%' }}
          aria-valuenow={timeRemaining}
          aria-valuemin={0}
          aria-valuemax={60}
        >
          {timeRemaining}s
        </div>
      </div>
    </div>
  );
};

export default Timer; 
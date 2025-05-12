import React, { useEffect, useState } from 'react';

interface TimerProps {
  timeLimit: number | null;
  onTimeUp: () => void;
  isActive: boolean;
  showProgressBar?: boolean;
  className?: string;
}

const Timer: React.FC<TimerProps> = ({
  timeLimit,
  onTimeUp,
  isActive,
  showProgressBar = true,
  className = ''
}) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(timeLimit);

  useEffect(() => {
    if (!isActive || timeLimit === null) {
      setTimeLeft(timeLimit);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLimit, isActive, onTimeUp]);

  if (timeLimit === null) {
    return null;
  }

  const minutes = Math.floor((timeLeft || 0) / 60);
  const seconds = (timeLeft || 0) % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const getProgressColor = () => {
    if (!timeLeft || !timeLimit) return 'bg-secondary';
    const percentage = (timeLeft / timeLimit) * 100;
    if (percentage > 60) return 'bg-success';
    if (percentage > 30) return 'bg-warning';
    return 'bg-danger';
  };

  if (!showProgressBar) {
    return (
      <div className={`timer-display ${timeLeft && timeLeft <= 10 ? 'text-danger' : ''} ${className}`}>
        <h3>
          <span className="me-2">Time:</span>
          <span>{timeLeft}</span>
          <span className="ms-1">sec</span>
        </h3>
      </div>
    );
  }

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">Time Remaining</h6>
      </div>
      <div className="card-body">
        <div className="d-flex align-items-center">
          <div className="flex-grow-1">
            <div className="progress" style={{ height: '20px' }}>
              <div
                className={`progress-bar ${getProgressColor()}`}
                role="progressbar"
                style={{
                  width: `${((timeLeft || 0) / timeLimit) * 100}%`,
                  transition: 'width 1s linear'
                }}
                aria-valuenow={timeLeft || 0}
                aria-valuemin={0}
                aria-valuemax={timeLimit}
              />
            </div>
          </div>
          <div className="ms-3">
            <h3 className="mb-0">{timeString}</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timer; 
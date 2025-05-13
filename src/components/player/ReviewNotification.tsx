import React from 'react';

interface ReviewNotificationProps {
  isCorrect: boolean;
  message: string;
  timestamp: number;
}

const ReviewNotification: React.FC<ReviewNotificationProps> = ({
  isCorrect,
  message,
  timestamp
}) => {
  return (
    <div className={`alert ${isCorrect ? 'alert-success' : 'alert-danger'} mb-4 d-flex align-items-center`} role="alert">
      <div className="me-3">
        {isCorrect ? (
          <span role="img" aria-label="thumbs up" style={{ fontSize: '1.5rem' }}>👍</span>
        ) : (
          <span role="img" aria-label="thumbs down" style={{ fontSize: '1.5rem' }}>👎</span>
        )}
      </div>
      <div>
        <strong>{message}</strong>
        <div className="small">
          {isCorrect ? 'Your answer was correct!' : 'Your answer was incorrect.'}
        </div>
      </div>
    </div>
  );
};

export default ReviewNotification; 
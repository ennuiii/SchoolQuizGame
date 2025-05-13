import React from 'react';
import { ReviewNotificationProps } from '../../types/game';

const ReviewNotification: React.FC<ReviewNotificationProps> = ({
  answer,
  isCorrect,
  timestamp,
  onClose
}) => {
  return (
    <div className="review-notification">
      <div className="notification-content">
        <div className="notification-header">
          <h4>Answer Review</h4>
          <button onClick={onClose}>×</button>
        </div>
        <div className="notification-body">
          <p className="answer-text">{answer}</p>
          <p className={`result ${isCorrect ? 'correct' : 'incorrect'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="timestamp">
            {new Date(timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReviewNotification; 
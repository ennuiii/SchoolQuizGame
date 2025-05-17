import React from 'react';
import { useGame } from '../../contexts/GameContext';

interface ReviewNotificationProps {
  playerId: string;
}

const ReviewNotification: React.FC<ReviewNotificationProps> = ({ playerId }) => {
  const { evaluatedAnswers } = useGame();
  const evaluation = evaluatedAnswers[playerId];

  if (evaluation === undefined) return null;

  const isCorrect = evaluation === true;
  const message = isCorrect ? 'Correct!' : 'Incorrect!';

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
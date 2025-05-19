import React from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface ReviewNotificationProps {
  playerId: string;
}

const ReviewNotification: React.FC<ReviewNotificationProps> = ({ playerId }) => {
  const { evaluatedAnswers } = useGame();
  const { language } = useLanguage();
  const evaluation = evaluatedAnswers[playerId];

  if (evaluation === undefined) return null;

  const isCorrect = evaluation === true;
  const message = isCorrect ? t('reviewNotification.correct', language) : t('reviewNotification.incorrect', language);

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
          {isCorrect ? t('reviewNotification.correctMessage', language) : t('reviewNotification.incorrectMessage', language)}
        </div>
      </div>
    </div>
  );
};

export default ReviewNotification; 
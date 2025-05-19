import React, { useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

interface AnswerInputProps {
  answer: string;
  onAnswerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitAnswer: () => void;
}

const AnswerInput: React.FC<AnswerInputProps> = ({
  answer,
  onAnswerChange,
  onSubmitAnswer
}) => {
  const { timeLimit, timeRemaining, submittedAnswer } = useGame();
  const { language } = useLanguage();
  const isDisabled = submittedAnswer || !!(timeLimit && (!timeRemaining || timeRemaining <= 0));

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control form-control-lg"
            placeholder={t('answerInput.placeholder', language)}
            value={answer}
            onChange={onAnswerChange}
            disabled={isDisabled}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={onSubmitAnswer}
            disabled={isDisabled}
          >
            {t('answerInput.submit', language)}
          </button>
        </div>
        
        {timeLimit !== null && timeRemaining !== null && timeLimit < 99999 && (
          <div className={`text-center ${timeRemaining <= 10 ? 'text-danger fw-bold' : ''}`}>
            {t('answerInput.timeRemaining', language)}: {formatTime(timeRemaining)}
            {timeRemaining <= 10 && (
              <span className="ms-1">{t('answerInput.autoSubmit', language)}</span>
            )}
          </div>
        )}
        
        {submittedAnswer && (
          <div className="alert alert-info">
            {t('answerInput.submitted', language)}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default AnswerInput; 